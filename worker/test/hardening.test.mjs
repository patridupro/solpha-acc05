// Kiểm thử các hành vi MỚI sau đợt vá theo docs/audit/BILLING-AUDIT.md:
// retry token chờ xác minh (client), RTDN 503/200, REVOKED dính, làm mới định kỳ, TTL, xoá dữ liệu,
// OIDC, khoá mã hoá có kid, ALLOW_TEST_PURCHASES, giới hạn body, rate limit.
// Chạy:  node --test worker/test/hardening.test.mjs
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import worker, { handleRtdn, sha256Hex, rateLimit, ipKey, _resetForTests } from "../src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "../..");

const mkKey = async () =>
  crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
const kp = await mkKey();
const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", kp.privateKey)).toString("base64");
const PEM = `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
const SA_JSON = JSON.stringify({ client_email: "billing@solpha-test.iam.gserviceaccount.com", private_key: PEM });

class FakeKV {
  constructor() {
    this.m = new Map();
    this.opts = new Map();
    this.failGet = false;
    this.failPut = false;
  }
  async get(key, type) {
    if (this.failGet) throw new Error("kv down");
    const v = this.m.get(key);
    if (v === undefined) return null;
    return type === "json" ? JSON.parse(v) : v;
  }
  async put(key, val, opts) {
    if (this.failPut) throw new Error("kv down");
    this.m.set(key, String(val));
    this.opts.set(key, opts || null);
  }
  async delete(key) {
    this.m.delete(key);
    this.opts.delete(key);
  }
}

const ORIGIN = "https://solpha.pages.dev";
const DEVICE = "11111111-2222-4333-8444-555555555555";
const DEV_B = "bbbbbbbb-2222-4333-8444-555555555555";
const TOKEN = "tok_abcdefghijklmnopqrstuvwxyz_0123456789";
const SKU = "solpha_pro_monthly";
const H = 3600_000;
const D = 24 * H;

const mkEnv = (over = {}) => ({
  ENT: new FakeKV(),
  PACKAGE_NAME: "app.solpha.desk",
  ALLOWED_ORIGINS: ORIGIN,
  GOOGLE_SA_JSON: SA_JSON,
  RTDN_KEY: "rtdn-secret-key-0123456789abcdef0123456789",
  TOKEN_ENC_KEY: "enc-secret-key-0123456789abcdef0123456789",
  ...over,
});

function sub({ state = "ACTIVE", expiry = Date.now() + 30 * D, ack = true, sku = SKU, extra = {} } = {}) {
  return {
    subscriptionState: "SUBSCRIPTION_STATE_" + state,
    acknowledgementState: ack ? "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" : "ACKNOWLEDGEMENT_STATE_PENDING",
    lineItems: [{ productId: sku, expiryTime: new Date(expiry).toISOString() }],
    ...extra,
  };
}

let google;
let logged;
const realFetch = globalThis.fetch;
const realConsole = { log: console.log, info: console.info, warn: console.warn, error: console.error };
function installGoogle() {
  google = { subs: new Map(), gets: 0, acks: [], failGet: false, certs: null, certFetches: 0 };
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "at", expires_in: 3600 });
    if (u === "https://www.googleapis.com/oauth2/v3/certs") {
      google.certFetches++;
      return google.certs ? Response.json({ keys: google.certs }) : new Response("no", { status: 500 });
    }
    const m = u.match(/\/applications\/([^/]+)\/purchases\/(subscriptionsv2\/tokens\/([^/:]+)|subscriptions\/([^/]+)\/tokens\/([^/:]+):acknowledge)$/);
    assert.ok(m, "URL Google không mong đợi: " + u);
    if (m[3]) {
      google.gets++;
      if (google.failGet) return new Response("boom", { status: 503 });
      const s = google.subs.get(decodeURIComponent(m[3]));
      return s ? Response.json(s) : Response.json({ error: { code: 404 } }, { status: 404 });
    }
    google.acks.push({ sku: m[4], token: decodeURIComponent(m[5]) });
    const s = google.subs.get(decodeURIComponent(m[5]));
    if (s) s.acknowledgementState = "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";
    return Response.json({});
  };
}
beforeEach(() => {
  _resetForTests();
  installGoogle();
  logged = [];
  for (const k of Object.keys(realConsole)) console[k] = (...a) => logged.push(a.join(" "));
});
afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(console, realConsole);
});

let ipN = 0;
const nextIp = () => `203.0.113.${(++ipN % 250) + 1}`;
const post = (p, body, { ip = nextIp(), origin = ORIGIN } = {}) =>
  new Request("https://w.test" + p, {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });
const doVerify = (env, device = DEVICE, token = TOKEN, sku = SKU, extra = {}) =>
  worker.fetch(post("/api/verify", { deviceId: device, sku, purchaseToken: token, ...extra }), env);
const ent = async (env, device = DEVICE) =>
  (await worker.fetch(new Request("https://w.test/api/entitlement?deviceId=" + device, { headers: { origin: ORIGIN, "cf-connecting-ip": nextIp() } }), env)).json();
const rtdnReq = (payload, key, headers = {}) =>
  new Request("https://w.test/api/rtdn" + (key === undefined ? "" : "?key=" + encodeURIComponent(key)), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
const pubsub = (obj) => ({ message: { data: Buffer.from(JSON.stringify(obj)).toString("base64"), messageId: "1" } });
const snote = (token = TOKEN, type = 2) =>
  pubsub({ packageName: "app.solpha.desk", subscriptionNotification: { version: "1.0", notificationType: type, purchaseToken: token, subscriptionId: SKU } });
const voidNote = (token = TOKEN, orderId = "GPA.1") =>
  pubsub({ packageName: "app.solpha.desk", voidedPurchaseNotification: { purchaseToken: token, orderId, productType: 1, refundType: 1 } });
const getRec = async (env, token = TOKEN) => env.ENT.get("tok:" + (await sha256Hex(token)), "json");
const setRec = async (env, patch, token = TOKEN) => {
  const h = await sha256Hex(token);
  const r = await env.ENT.get("tok:" + h, "json");
  await env.ENT.put("tok:" + h, JSON.stringify({ ...r, ...patch }));
};

// =====================================================================================
// F1/F3 máy chủ: RTDN
// =====================================================================================
test("RTDN: lỗi KV -> 503 (gửi lại); dữ liệu hỏng vĩnh viễn / gói khác / thiếu packageName -> 200", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await doVerify(env);
  env.ENT.failGet = true;
  const r = await handleRtdn(rtdnReq(snote(), env.RTDN_KEY), env);
  env.ENT.failGet = false;
  assert.equal(r.status, 503);

  for (const bad of [{ message: { data: "@@@" } }, { message: {} }, { message: { data: Buffer.from("[1,2").toString("base64") } }]) {
    const x = await handleRtdn(rtdnReq(bad, env.RTDN_KEY), env);
    assert.equal(x.status, 200);
  }
  const big = await handleRtdn(rtdnReq({ message: { data: "A".repeat(40_000) } }, env.RTDN_KEY), env);
  assert.equal(big.status, 200, "payload quá lớn là lỗi vĩnh viễn");
  const noPkg = await handleRtdn(rtdnReq(pubsub({ subscriptionNotification: { purchaseToken: TOKEN } }), env.RTDN_KEY), env);
  assert.equal((await noPkg.json()).ignored, "other_package");
});

test("RTDN: token lạ + Google lỗi tạm thời -> 503; token lạ với sku không thuộc app -> bỏ qua, không acknowledge", async () => {
  const env = mkEnv();
  google.failGet = true;
  assert.equal((await handleRtdn(rtdnReq(snote("unknown_token_0123456789"), env.RTDN_KEY), env)).status, 503);
  google.failGet = false;
  google.subs.set("other_sku_token_0123456789", sub({ ack: false, sku: "khac_hoan_toan" }));
  const r = await handleRtdn(rtdnReq(snote("other_sku_token_0123456789"), env.RTDN_KEY), env);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ignored, "other_sku");
  assert.equal(google.acks.length, 0);
  assert.equal(env.ENT.m.size, 0);
});

test("F3 server: RTDN token lạ -> acknowledge + bản ghi chưa gắn thiết bị; verify sau đó gắn vào thiết bị, không ack lần hai", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub({ ack: false }));
  const r = await handleRtdn(rtdnReq(snote(TOKEN, 4), env.RTDN_KEY), env);
  assert.equal((await r.json()).adopted, true);
  assert.equal(google.acks.length, 1);
  const rec = await getRec(env);
  assert.equal(rec.deviceId, null);
  assert.ok(rec.ackedAt > 0);
  assert.ok(rec.tokenEnc.startsWith("v2.k1."));
  assert.equal((await ent(env)).active, false, "chưa gắn thiết bị nào");
  const v = await (await doVerify(env)).json();
  assert.equal(v.active, true);
  assert.equal(google.acks.length, 1);
  assert.equal((await getRec(env)).deviceId, DEVICE);
  assert.equal((await ent(env)).active, true);
});

// =====================================================================================
// F1/F6: thu hồi độc lập với Google và "dính"
// =====================================================================================
test("void: ghi REVOKED không gọi Google; replay void và verify lại không hồi sinh; đơn hàng MỚI thì hồi sinh", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub({ extra: { latestOrderId: "GPA.1" } }));
  await doVerify(env);
  const gets = google.gets;
  assert.equal((await handleRtdn(rtdnReq(voidNote(TOKEN, "GPA.1"), env.RTDN_KEY), env)).status, 200);
  assert.equal(google.gets, gets, "thu hồi không phụ thuộc Google");
  assert.equal((await ent(env)).active, false);

  assert.equal((await (await doVerify(env)).json()).active, false, "cùng đơn hàng: vẫn REVOKED");
  assert.equal((await handleRtdn(rtdnReq(snote(TOKEN, 2), env.RTDN_KEY), env)).status, 200);
  assert.equal((await getRec(env)).state, "REVOKED", "RTDN làm mới cũng không hồi sinh");

  google.subs.set(TOKEN, sub({ extra: { latestOrderId: "GPA.2" } })); // kỳ gia hạn sau, đơn khác
  const v = await (await doVerify(env)).json();
  assert.equal(v.active, true);
  const rec = await getRec(env);
  assert.equal(rec.voidedAt, undefined);
});

test("void cho token chưa từng thấy: lưu dấu REVOKED; verify sau đó không cấp quyền", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  assert.equal((await handleRtdn(rtdnReq(voidNote(TOKEN, "GPA.9"), env.RTDN_KEY), env)).status, 200);
  assert.equal(google.gets, 0);
  assert.equal((await (await doVerify(env)).json()).active, false);
});

// =====================================================================================
// F2: làm mới định kỳ cả token đang active
// =====================================================================================
test("entitlement: token active được đối chiếu lại sau >= 6 giờ, không sớm hơn; Google lỗi -> thử lại tối đa 10 phút/lần", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await doVerify(env);
  const g0 = google.gets;
  await setRec(env, { updatedAt: Date.now() - 5 * H });
  await ent(env);
  assert.equal(google.gets, g0, "dưới 6 giờ: không gọi Google");
  await setRec(env, { updatedAt: Date.now() - 7 * H });
  google.failGet = true;
  assert.equal((await ent(env)).active, true, "Google lỗi: giữ trạng thái đã biết");
  assert.equal(google.gets, g0 + 1);
  await ent(env);
  assert.equal(google.gets, g0 + 1, "vừa thử lỗi: chưa thử lại trong 10 phút");
  assert.ok((await getRec(env)).lastTryAt > 0);
  google.failGet = false;
  google.subs.set(TOKEN, sub({ state: "EXPIRED", expiry: Date.now() - 1000 }));
  await setRec(env, { lastTryAt: Date.now() - 11 * 60_000 });
  assert.equal((await ent(env)).active, false);
});

// =====================================================================================
// F4/F5/F12/F13
// =====================================================================================
test("F4: obfuscatedExternalAccountId do client gửi phải khớp sha256(deviceId); Google trả khớp thì được", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  assert.equal((await doVerify(env, DEVICE, TOKEN, SKU, { obfuscatedExternalAccountId: "x".repeat(64) })).status, 403);
  assert.equal((await doVerify(env, DEVICE, TOKEN, SKU, { obfuscatedExternalAccountId: await sha256Hex(DEVICE) })).status, 200);
  const t2 = "tok_bound_to_device_B_0123456789";
  google.subs.set(t2, sub({ extra: { externalAccountIdentifiers: { obfuscatedExternalAccountId: await sha256Hex(DEV_B) } } }));
  assert.equal((await doVerify(env, DEV_B, t2)).status, 200);
});

test("F4a: chuyển token tối đa 3 lần/30 ngày; từ chối bằng 429 và không đổi chủ", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  const devs = [DEVICE, DEV_B];
  const codes = [];
  for (let i = 0; i < 6; i++) codes.push((await doVerify(env, devs[i % 2])).status);
  // lần 1 tạo; 2-4 là 3 lần chuyển; lần 5 (DEVICE giành lại) bị chặn; lần 6 là chủ hiện tại (DEV_B) nên không phải chuyển.
  assert.deepEqual(codes, [200, 200, 200, 200, 429, 200]);
  assert.equal((await getRec(env)).deviceId, DEV_B);
  const r = await doVerify(env, DEVICE);
  assert.equal(r.status, 429);
  assert.equal((await r.json()).error, "transfer_limited");
  assert.equal((await getRec(env)).deviceId, DEV_B, "bị từ chối thì không đổi chủ");
});

test("F12: ALLOW_TEST_PURCHASES=true cho phép giao dịch thử; mặc định từ chối và entitlement không tính", async () => {
  const test1 = sub({ extra: { testPurchase: {} } });
  const a = mkEnv();
  google.subs.set(TOKEN, test1);
  const r = await doVerify(a);
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, "test_purchase_not_allowed");
  assert.equal((await ent(a)).active, false);

  const b = mkEnv({ ALLOW_TEST_PURCHASES: "true" });
  assert.equal((await (await doVerify(b)).json()).active, true);
  assert.equal((await getRec(b)).test, true);
  const c = { ...b, ALLOW_TEST_PURCHASES: "false" };
  assert.equal((await ent(c)).active, false, "tắt cờ thì giao dịch thử đang lưu cũng không còn quyền");
});

test("F13: deviceId toàn số 0 bị từ chối ở verify/entitlement/delete", async () => {
  const env = mkEnv();
  const z = "00000000-0000-4000-8000-000000000000";
  assert.equal((await doVerify(env, z)).status, 400);
  assert.equal((await worker.fetch(new Request("https://w.test/api/entitlement?deviceId=" + z, { headers: { "cf-connecting-ip": nextIp() } }), env)).status, 400);
  assert.equal((await worker.fetch(post("/api/delete", { deviceId: z, proof: z }), env)).status, 400);
});

// =====================================================================================
// F7: OIDC + khoá yếu; F8: khoá mã hoá
// =====================================================================================
async function oidcFixture(overClaims = {}, overHeader = {}) {
  const k = await mkKey();
  const jwk = { ...(await crypto.subtle.exportKey("jwk", k.publicKey)), kid: "kid-1", alg: "RS256", use: "sig" };
  google.certs = [jwk];
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const claims = {
    iss: "https://accounts.google.com",
    aud: "https://w.test/api/rtdn",
    email: "pubsub-push@solpha.iam.gserviceaccount.com",
    email_verified: true,
    exp: Math.floor(Date.now() / 1000) + 600,
    ...overClaims,
  };
  const head = b64({ alg: "RS256", typ: "JWT", kid: "kid-1", ...overHeader });
  const body = b64(claims);
  const sig = Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", k.privateKey, new TextEncoder().encode(head + "." + body))).toString("base64url");
  return `Bearer ${head}.${body}.${sig}`;
}
const oidcEnv = () => mkEnv({ RTDN_KEY: undefined, RTDN_AUDIENCE: "https://w.test/api/rtdn", PUSH_SA_EMAIL: "pubsub-push@solpha.iam.gserviceaccount.com" });

test("F7 OIDC: JWT do Google ký hợp lệ -> chấp nhận; sai aud/email/hết hạn/không ký/không có header -> 401; không cần ?key=", async () => {
  const env = oidcEnv();
  const note = pubsub({ packageName: "app.solpha.desk", testNotification: { version: "1.0" } });
  assert.equal((await handleRtdn(rtdnReq(note, undefined, { authorization: await oidcFixture() }), env)).status, 200);
  for (const over of [{ aud: "https://khac" }, { email: "ke-tan-cong@x.iam.gserviceaccount.com" }, { exp: Math.floor(Date.now() / 1000) - 5 }, { email_verified: false }, { iss: "https://evil.example" }]) {
    assert.equal((await handleRtdn(rtdnReq(note, undefined, { authorization: await oidcFixture(over) }), env)).status, 401, JSON.stringify(over));
  }
  assert.equal((await handleRtdn(rtdnReq(note, undefined, { authorization: await oidcFixture({}, { alg: "none" }) }), env)).status, 401);
  const good = await oidcFixture();
  const tampered = good.replace(/\.[\w-]+$/, ".AAAA");
  assert.equal((await handleRtdn(rtdnReq(note, undefined, { authorization: tampered }), env)).status, 401);
  assert.equal((await handleRtdn(rtdnReq(note, undefined), env)).status, 401);
  assert.equal((await handleRtdn(rtdnReq(note, "bat-ky-key-nao-0123456789abcdef0123456789"), env)).status, 401, "khi bật OIDC thì ?key= không còn đủ");
});

test("F7 OIDC: không lấy được JWKS -> 503 (gửi lại), không phải 401", async () => {
  const env = oidcEnv();
  const auth = await oidcFixture();
  google.certs = null;
  _resetForTests();
  const r = await handleRtdn(rtdnReq(pubsub({ packageName: "app.solpha.desk", testNotification: {} }), undefined, { authorization: auth }), env);
  assert.equal(r.status, 503);
});

test("F7 khoá RTDN: < 32 ký tự bị từ chối kể cả khi khớp; đủ 32 thì nhận", async () => {
  const note = pubsub({ packageName: "app.solpha.desk", testNotification: {} });
  const short = "a".repeat(31);
  assert.equal((await handleRtdn(rtdnReq(note, short), mkEnv({ RTDN_KEY: short }))).status, 401);
  assert.ok(logged.some((l) => l.includes("rtdn_key_missing_or_weak")));
  const ok = "b".repeat(32);
  assert.equal((await handleRtdn(rtdnReq(note, ok), mkEnv({ RTDN_KEY: ok }))).status, 200);
});

test("F8: thiếu/ngắn TOKEN_ENC_KEY -> verify 500, health báo configured=false, RTDN 500; không dùng RTDN_KEY làm khoá", async () => {
  google.subs.set(TOKEN, sub());
  for (const bad of [undefined, "", "ngan"]) {
    const env = mkEnv({ TOKEN_ENC_KEY: bad });
    assert.equal((await doVerify(env)).status, 500);
    assert.equal(env.ENT.m.size, 0);
    assert.equal((await handleRtdn(rtdnReq(snote(), env.RTDN_KEY), env)).status, 500);
    const h = await (await worker.fetch(new Request("https://w.test/api/health"), env)).json();
    assert.equal(h.configured, false);
  }
  assert.equal((await (await worker.fetch(new Request("https://w.test/api/health"), mkEnv())).json()).configured, true);
});

test("F8: bản mã v2.<kid>, xoay khoá bằng TOKEN_ENC_KEYS_OLD tự mã hoá lại; bản mã bị tráo sang bản ghi khác thì giải mã lỗi và có log", async () => {
  const k1 = "key-one-0123456789abcdef0123456789abcd";
  const k2 = "key-two-0123456789abcdef0123456789abcd";
  const env1 = mkEnv({ TOKEN_ENC_KEY: k1, TOKEN_ENC_KEY_ID: "a1" });
  google.subs.set(TOKEN, sub());
  await doVerify(env1);
  assert.ok((await getRec(env1)).tokenEnc.startsWith("v2.a1."));
  await setRec(env1, { updatedAt: Date.now() - 7 * H });
  const env2 = { ...env1, TOKEN_ENC_KEY: k2, TOKEN_ENC_KEY_ID: "a2", TOKEN_ENC_KEYS_OLD: "a1:" + k1 };
  const g = google.gets;
  assert.equal((await ent(env2)).active, true);
  assert.equal(google.gets, g + 1, "giải mã được bằng khoá cũ nên làm mới được");
  const encA = (await getRec(env1)).tokenEnc;
  assert.ok(encA.startsWith("v2.a2."), "đã mã hoá lại bằng khoá hiện hành");

  // kid lạ -> log lý do cụ thể
  const env3 = { ...env2, TOKEN_ENC_KEYS_OLD: "" };
  await setRec(env1, { tokenEnc: "v2.zz.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", updatedAt: Date.now() - 7 * H });
  await ent(env3);
  assert.ok(logged.some((l) => l.includes("token_decrypt_failed") && l.includes("unknown_kid")));

  // AAD: bản mã của token A đặt vào bản ghi của token B
  const T2 = "tok_second_0123456789_abcdefghij";
  google.subs.set(T2, sub());
  await doVerify(env2, DEV_B, T2);
  await setRec(env2, { tokenEnc: encA, updatedAt: Date.now() - 7 * H }, T2);
  logged.length = 0;
  await ent(env2, DEV_B);
  assert.ok(logged.some((l) => l.includes("token_decrypt_failed") && l.includes("auth_failed")));
});

// =====================================================================================
// F9, F15, F18, F19
// =====================================================================================
test("F9: ipKey gộp IPv6 /64, giữ IPv4, idempotent; store không bị xoá toàn bộ khi đầy", () => {
  assert.equal(ipKey("2001:db8:abcd:1234::1"), ipKey("2001:DB8:abcd:1234:ffff:0:0:2"));
  assert.notEqual(ipKey("2001:db8:abcd:1234::1"), ipKey("2001:db8:abcd:1235::1"));
  assert.equal(ipKey("203.0.113.5"), "203.0.113.5");
  assert.equal(ipKey("::ffff:203.0.113.5"), "203.0.113.5");
  assert.equal(ipKey(ipKey("2001:db8::1")), ipKey("2001:db8::1"));
  const store = new Map();
  for (let i = 0; i < 20_000; i++) rateLimit("verify", "10.0." + (i >> 8) + "." + (i & 255), 1000, store);
  assert.ok(store.size <= 5000, "store bị chặn kích thước: " + store.size);
  assert.ok(store.size > 0);
});

test("F19: không tin x-forwarded-for (đổi XFF không đổi bucket)", async () => {
  const env = mkEnv();
  let last;
  for (let i = 0; i < 11; i++) {
    const req = new Request("https://w.test/api/verify", {
      method: "POST",
      headers: { "x-forwarded-for": "9.9.9." + i, origin: ORIGIN },
      body: JSON.stringify({ deviceId: "x" }),
    });
    last = (await worker.fetch(req, env)).status;
  }
  assert.equal(last, 429, "mọi yêu cầu không có cf-connecting-ip dùng chung một bucket");
});

test("F15: body > 16KB -> 413 (verify và delete)", async () => {
  const env = mkEnv();
  const big = { deviceId: DEVICE, sku: SKU, purchaseToken: "x".repeat(20_000) };
  assert.equal((await worker.fetch(post("/api/verify", big), env)).status, 413);
  assert.equal((await worker.fetch(post("/api/delete", { deviceId: DEVICE, proof: "x".repeat(20_000) }), env)).status, 413);
});

test("F18: log lỗi không chứa mảnh nội dung đầu vào ở /api/verify (JSON hỏng)", async () => {
  const env = mkEnv();
  const req = new Request("https://w.test/api/verify", { method: "POST", headers: { origin: ORIGIN, "cf-connecting-ip": nextIp() }, body: "SECRETTOKENXYZ{" });
  assert.equal((await worker.fetch(req, env)).status, 400);
  assert.ok(!logged.join("\n").includes("SECRETTOKE"));
});

// =====================================================================================
// F10: TTL và xoá dữ liệu
// =====================================================================================
test("F10 TTL: tok active = hạn gói + 90 ngày; kết thúc = 90 ngày; dev: không ngắn hơn token; gia hạn thì dev: được kéo dài", async () => {
  const env = mkEnv();
  const exp = Date.now() + 30 * D;
  google.subs.set(TOKEN, sub({ expiry: exp }));
  await doVerify(env);
  const hash = await sha256Hex(TOKEN);
  const ttl = env.ENT.opts.get("tok:" + hash).expirationTtl;
  assert.ok(Math.abs(ttl - (30 + 90) * 86400) < 120, "ttl=" + ttl);
  assert.ok(env.ENT.opts.get("dev:" + DEVICE).expirationTtl >= ttl - 5);

  const T2 = "tok_expired_0123456789abcdef";
  google.subs.set(T2, sub({ state: "EXPIRED", expiry: Date.now() - D }));
  await doVerify(env, DEVICE, T2);
  assert.equal(env.ENT.opts.get("tok:" + (await sha256Hex(T2))).expirationTtl, 90 * 86400);

  // gia hạn qua RTDN: dev: được kéo dài tương ứng
  const exp2 = Date.now() + 60 * D;
  google.subs.set(TOKEN, sub({ expiry: exp2 }));
  assert.equal((await handleRtdn(rtdnReq(snote(TOKEN, 2), env.RTDN_KEY), env)).status, 200);
  assert.ok(env.ENT.opts.get("dev:" + DEVICE).expirationTtl > (55 + 90) * 86400);
  assert.ok(env.ENT.opts.get("tok:" + hash).expirationTtl > (55 + 90) * 86400);
});

test("F10 /api/delete: bằng chứng = purchaseToken đang gắn hoặc deviceId v4; sai chứng -> 403; xoá xong RTDN muộn không tạo lại; verify lại được", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await doVerify(env);
  const T2 = "tok_other_device_0123456789abc";
  google.subs.set(T2, sub());
  await doVerify(env, DEV_B, T2);

  assert.equal((await worker.fetch(post("/api/delete", { deviceId: DEVICE, proof: "khong-phai-bang-chung-0123" }), env)).status, 403);
  assert.equal((await worker.fetch(post("/api/delete", { deviceId: DEVICE, proof: T2 }), env)).status, 403, "token của thiết bị khác không đủ để xoá");
  assert.equal((await worker.fetch(post("/api/delete", { deviceId: DEVICE, proof: DEV_B }), env)).status, 403, "deviceId của máy khác không đủ");

  const r = await worker.fetch(post("/api/delete", { deviceId: DEVICE, proof: TOKEN }), env);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).deleted, 1);
  assert.equal(env.ENT.m.has("dev:" + DEVICE), false);
  const rec = await getRec(env);
  assert.equal(rec.deleted, true);
  assert.equal(rec.tokenEnc, undefined, "không còn token mã hoá, deviceId, sku");
  assert.equal(rec.deviceId, undefined);
  assert.equal((await ent(env)).active, false);
  assert.equal((await ent(env, DEV_B)).active, true, "dữ liệu của thiết bị khác còn nguyên");

  const gets = google.gets;
  assert.equal((await (await handleRtdn(rtdnReq(snote(TOKEN, 2), env.RTDN_KEY), env)).json()).ignored, "deleted");
  assert.equal(google.gets, gets);
  assert.equal((await (await doVerify(env)).json()).active, true, "người dùng chủ động verify lại thì được");

  // deviceId v4 làm bằng chứng
  const d = await worker.fetch(post("/api/delete", { deviceId: DEVICE, proof: DEVICE }), env);
  assert.equal(d.status, 200);
  assert.equal((await ent(env)).active, false);
  // UUID không phải v4 không được dùng làm bằng chứng
  const notV4 = "11111111-2222-1333-8444-555555555555";
  assert.equal((await worker.fetch(post("/api/delete", { deviceId: notV4, proof: notV4 }), env)).status, 403);
});

// =====================================================================================
// Client: billing.js
// =====================================================================================
const clientSrc = fs.readFileSync(path.join(ROOT, "billing.js"), "utf8");
const API = "https://solpha-billing.test.workers.dev";
const jres = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
function clientEnv(extra = {}, preset = {}) {
  const store = new Map(Object.entries(preset));
  const listeners = {};
  const events = [];
  const win = {
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => void store.set(k, String(v)) },
    sessionStorage: { getItem: () => null, setItem() {} },
    document: { referrer: "" },
    crypto: globalThis.crypto,
    TextEncoder, Uint8Array, Array, Intl, JSON, Promise, Date, console, setTimeout, clearTimeout, AbortController, encodeURIComponent,
    CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
    dispatchEvent(ev) { events.push(ev); return true; },
    addEventListener(t, f) { (listeners[t] ||= []).push(f); },
    fetch: async () => { throw new Error("offline"); },
    ...extra,
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(clientSrc.replace("https://solpha-billing.<subdomain>.workers.dev", API), win); // API_BASE đã cấu hình ngay lúc nạp
  win.SolphaBilling.config.api = API;
  return { win, B: win.SolphaBilling, store, events, fire: (t) => Promise.all((listeners[t] || []).map((f) => f())) };
}
const twa = (opts = {}) => {
  const state = { completed: null, verifies: [], online: false, reply: null, requests: [] };
  const e = clientEnv({
    getDigitalGoodsService: async () => ({ getDetails: async () => [], listPurchases: async () => opts.purchases || [] }),
    PaymentRequest: class {
      constructor(m) { state.requests.push(m); }
      async canMakePayment() { return true; }
      async show() { return { details: { purchaseToken: "PTOKEN-1234567890" }, complete: async (r) => void (state.completed = r) }; }
    },
    fetch: async (u, init) => {
      if (String(u).endsWith("/api/verify")) {
        state.verifies.push(JSON.parse(init.body));
        if (!state.online) return jres({ error: "upstream" }, opts.status || 502);
        return jres(state.reply || { active: true, expiryMs: Date.now() + 30 * D, sku: "solpha_pro_monthly", state: "ACTIVE" });
      }
      return jres({ active: false, expiryMs: 0, sku: null });
    },
  });
  return { ...e, state };
};

test("client F3: trả tiền xong backend 502 -> pending_verification, giữ token, hiện 'đang xác minh', KHÔNG fail với Play; online/ mở app thì tự thử lại cho tới khi thành công", async () => {
  const c = twa();
  const r = await c.B.purchase("solpha_pro_monthly");
  assert.equal(r.ok, false);
  assert.equal(r.status, "pending_verification");
  assert.equal(c.state.completed, "success");
  assert.equal(c.B.pending(), 1);
  assert.equal(c.B.isPro(), false);
  assert.ok(c.events.some((e) => e.detail.pending === true));
  assert.match(c.store.get("solpha_pending"), /PTOKEN-1234567890/);

  // vẫn lỗi: giữ nguyên
  await c.fire("online");
  await c.B.retryPending();
  assert.equal(c.B.pending(), 1);
  assert.ok(c.state.verifies.length >= 2);

  // backend hồi phục khi mạng về
  c.state.online = true;
  await c.fire("online");
  await c.B.retryPending();
  assert.equal(c.B.pending(), 0);
  assert.equal(c.B.isPro(), true);
  assert.ok(c.events.some((e) => e.detail.active === true && e.detail.source === "retry"));
});

test("client F3: mở app lại (nạp billing.js với token chờ trong localStorage) tự thử lại; token quá 3 ngày bị bỏ; tối đa 5 token", async () => {
  const now = Date.now();
  const mk = (i, at) => ({ sku: "solpha_pro_monthly", token: "TOKEN-" + i + "-0123456789", at });
  const preset = { solpha_pending: JSON.stringify([mk(0, now - 4 * D), ...[1, 2, 3, 4, 5, 6, 7].map((i) => mk(i, now - H))]) };
  const calls = [];
  const c = clientEnv(
    { fetch: async (u, init) => (calls.push(JSON.parse(init.body).purchaseToken), jres({ active: false, state: "EXPIRED", expiryMs: 0, sku: null })) },
    preset,
  );
  await new Promise((r) => setTimeout(r, 50)); // retryPending() chạy lúc nạp script
  assert.ok(!calls.includes("TOKEN-0-0123456789"), "token 4 ngày tuổi đã hết hạn chờ");
  assert.ok(calls.length <= 5, "chỉ tối đa 5 token: " + calls.length);
  assert.equal(c.B.pending(), 0, "bị từ chối hẳn (EXPIRED) thì bỏ khỏi hàng chờ");

  // lỗi tạm thời thì giữ, và đã apply Pro khi thành công
  const d = clientEnv(
    { fetch: async () => jres({ active: true, state: "ACTIVE", expiryMs: now + 5 * D, sku: "solpha_pro_monthly" }) },
    { solpha_pending: JSON.stringify([mk(9, now - H)]) },
  );
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(d.B.isPro(), true);
  assert.equal(d.B.pending(), 0);
});

test("client F3: purchase bị từ chối hẳn (400) không giữ token; Google PENDING giữ token", async () => {
  const a = twa({ status: 400 });
  a.state.online = false;
  const r = await a.B.purchase("solpha_pro_monthly");
  assert.equal(r.status, "verify_failed");
  assert.equal(a.state.completed, "fail");
  assert.equal(a.B.pending(), 0);

  const b = twa();
  b.state.online = true;
  b.state.reply = { active: false, state: "PENDING", expiryMs: 0, sku: "solpha_pro_monthly" };
  const r2 = await b.B.purchase("solpha_pro_monthly");
  assert.equal(r2.status, "verify_failed");
  assert.equal(b.B.pending(), 1);
});

test("client F11: restore() gặp 429/502 -> verify_failed + pending (không phải 'inactive'); sau khi backend ổn thì retry cấp Pro", async () => {
  for (const status of [502, 429, 500]) {
    const c = twa({ status, purchases: [{ itemId: "solpha_pro_monthly", purchaseToken: "TOKEN-A-1234567890" }] });
    const r = await c.B.restore();
    assert.equal(r.ok, false, String(status));
    assert.equal(r.status, "verify_failed");
    assert.equal(r.transient, true);
    assert.equal(c.B.pending(), 1);
  }
  const c = twa({ purchases: [{ itemId: "solpha_pro_monthly", purchaseToken: "TOKEN-A-1234567890" }] });
  c.state.online = true;
  const ok = await c.B.restore();
  assert.equal(ok.ok, true);
  assert.equal(c.B.pending(), 0);
});

test("client F4: bindAccount=false (mặc định) giữ nguyên PaymentRequest; =true thêm obfuscatedAccountId = sha256(deviceId) và gửi kèm khi verify", async () => {
  const a = twa();
  await a.B.purchase("solpha_pro_monthly");
  assert.equal(JSON.stringify(a.state.requests[0][0].data), JSON.stringify({ sku: "solpha_pro_monthly" }));
  assert.equal(a.state.verifies[0].obfuscatedExternalAccountId, undefined);

  const b = twa();
  b.B.config.bindAccount = true;
  await b.B.purchase("solpha_pro_monthly");
  const expect = await sha256Hex(b.B.deviceId());
  assert.equal(b.state.requests[0][0].data.obfuscatedAccountId, expect);
  assert.equal(b.state.verifies[0].obfuscatedExternalAccountId, expect);
});

test("client F13/F10: deviceId dự phòng không phải hằng số công khai; deleteData gọi /api/delete với bằng chứng và xoá cache cục bộ", async () => {
  const broken = clientEnv({
    localStorage: { getItem() { throw new Error("x"); }, setItem() { throw new Error("x"); } },
  });
  const id = broken.B.deviceId();
  assert.notEqual(id, "00000000-0000-4000-8000-000000000000");
  assert.equal(broken.B.deviceId(), id);

  let sent;
  const c = clientEnv({ fetch: async (u, init) => ((sent = { u, body: JSON.parse(init.body) }), jres({ ok: true, deleted: 1 })) });
  const old = c.B.deviceId();
  c.store.set("solpha_ent", JSON.stringify({ active: true, expiryMs: Date.now() + D, fetchedAt: Date.now() }));
  const r = await c.B.deleteData();
  assert.equal(r.ok, true);
  assert.equal(sent.u, API + "/api/delete");
  assert.equal(JSON.stringify(sent.body), JSON.stringify({ deviceId: old, proof: old }));
  assert.equal(c.B.isPro(), false);
  assert.notEqual(c.B.deviceId(), old);

  const f = clientEnv({ fetch: async () => jres({ error: "x" }, 403) });
  const keep = f.B.deviceId();
  assert.equal((await f.B.deleteData()).ok, false);
  assert.equal(f.B.deviceId(), keep, "xoá thất bại thì giữ nguyên định danh");
});
