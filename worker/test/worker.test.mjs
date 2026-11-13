// node --test worker/test/
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import worker, {
  parseSubscription,
  isActive,
  signJwt,
  handleRtdn,
  sha256Hex,
  aggregate,
  _resetForTests,
} from "../src/index.js";

// ---------- Khoá RSA + service account giả ----------
const kp = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", kp.privateKey)).toString("base64");
const PEM = `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
const SA_JSON = JSON.stringify({ client_email: "billing@solpha-test.iam.gserviceaccount.com", private_key: PEM });

// ---------- KV giả ----------
class FakeKV {
  constructor() {
    this.m = new Map();
  }
  async get(key, type) {
    const v = this.m.get(key);
    if (v === undefined) return null;
    return type === "json" ? JSON.parse(v) : v;
  }
  async put(key, val) {
    this.m.set(key, String(val));
  }
}

const ORIGIN = "https://solpha.pages.dev";
const DEVICE = "11111111-2222-4333-8444-555555555555";
const TOKEN = "tok_abcdefghijklmnopqrstuvwxyz_0123456789";
const SKU = "solpha_pro_monthly";
const H = 3600_000;

function mkEnv(over = {}) {
  return {
    ENT: new FakeKV(),
    PACKAGE_NAME: "app.solpha.desk",
    ALLOWED_ORIGINS: ORIGIN,
    GOOGLE_SA_JSON: SA_JSON,
    RTDN_KEY: "rtdn-secret-key-0123456789abcdef0123456789",
    ...over,
  };
}

function sub({ state = "ACTIVE", expiry = Date.now() + 30 * 24 * H, ack = false, sku = SKU, linked } = {}) {
  return {
    subscriptionState: "SUBSCRIPTION_STATE_" + state,
    acknowledgementState: ack ? "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" : "ACKNOWLEDGEMENT_STATE_PENDING",
    lineItems: [{ productId: sku, expiryTime: new Date(expiry).toISOString() }],
    ...(linked ? { linkedPurchaseToken: linked } : {}),
  };
}

// ---------- Mock fetch của Google ----------
let google;
const realFetch = globalThis.fetch;
const realConsole = { log: console.log, info: console.info, warn: console.warn, error: console.error };
let logged;

function installGoogle() {
  google = { subs: new Map(), oauth: 0, gets: 0, acks: [], ackOk: true, failGet: false };
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u === "https://oauth2.googleapis.com/token") {
      google.oauth++;
      const body = new URLSearchParams(init.body);
      assert.equal(body.get("grant_type"), "urn:ietf:params:oauth:grant-type:jwt-bearer");
      assert.match(body.get("assertion"), /^[\w-]+\.[\w-]+\.[\w-]+$/);
      return Response.json({ access_token: "at-" + google.oauth, expires_in: 3600 });
    }
    assert.match(init.headers.authorization, /^Bearer at-\d+$/);
    const m = u.match(/\/applications\/([^/]+)\/purchases\/(subscriptionsv2\/tokens\/([^/:]+)|subscriptions\/([^/]+)\/tokens\/([^/:]+):acknowledge)$/);
    assert.ok(m, "URL Google không mong đợi: " + u);
    assert.equal(m[1], "app.solpha.desk");
    if (m[3]) {
      assert.equal((init.method || "GET"), "GET");
      google.gets++;
      if (google.failGet) return new Response("boom", { status: 500 });
      const s = google.subs.get(decodeURIComponent(m[3]));
      if (!s) return Response.json({ error: { code: 404 } }, { status: 404 });
      return Response.json(s);
    }
    assert.equal(init.method, "POST");
    google.acks.push({ sku: m[4], token: decodeURIComponent(m[5]) });
    if (!google.ackOk) return new Response("nope", { status: 500 });
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
const nextIp = () => `203.0.113.${++ipN}`;

function verifyReq(body, { ip = nextIp(), origin = ORIGIN } = {}) {
  return new Request("https://w.test/api/verify", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip, ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });
}
const entReq = (device = DEVICE, ip = nextIp()) =>
  new Request("https://w.test/api/entitlement?deviceId=" + device, {
    headers: { origin: ORIGIN, "cf-connecting-ip": ip },
  });
const rtdnReq = (payload, key) =>
  new Request("https://w.test/api/rtdn" + (key === undefined ? "" : "?key=" + encodeURIComponent(key)), {
    method: "POST",
    body: JSON.stringify(payload),
  });
const pubsub = (obj) => ({ message: { data: Buffer.from(JSON.stringify(obj)).toString("base64"), messageId: "1" } });
const snote = (token = TOKEN, type = 2) =>
  pubsub({
    version: "1.0",
    packageName: "app.solpha.desk",
    eventTimeMillis: String(Date.now()),
    subscriptionNotification: { version: "1.0", notificationType: type, purchaseToken: token, subscriptionId: SKU },
  });

// ---------- Hàm thuần ----------
test("parseSubscription lấy state, hạn dùng lớn nhất, sku, acknowledge", () => {
  const now = Date.now();
  const p = parseSubscription({
    subscriptionState: "SUBSCRIPTION_STATE_IN_GRACE_PERIOD",
    acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    linkedPurchaseToken: "old",
    testPurchase: {},
    lineItems: [
      { productId: "a", expiryTime: new Date(now - H).toISOString() },
      { productId: "b", expiryTime: new Date(now + H).toISOString() },
    ],
  });
  assert.equal(p.state, "IN_GRACE_PERIOD");
  assert.equal(p.sku, "b");
  assert.equal(p.expiryMs, Date.parse(new Date(now + H).toISOString()));
  assert.equal(p.acknowledged, true);
  assert.equal(p.linkedPurchaseToken, "old");
  assert.equal(p.testPurchase, true);
  assert.deepEqual(p.productIds, ["a", "b"]);
  assert.equal(parseSubscription(null), null);
  assert.equal(parseSubscription({}).expiryMs, 0);
});

test("isActive theo trạng thái và hạn", () => {
  const now = 1_000_000;
  assert.equal(isActive("ACTIVE", now + 1, now), true);
  assert.equal(isActive("ACTIVE", now - 1, now), false);
  assert.equal(isActive("CANCELED", now + 1, now), true);
  assert.equal(isActive("IN_GRACE_PERIOD", now + 1, now), true);
  for (const s of ["ON_HOLD", "PAUSED", "EXPIRED", "PENDING", "UNKNOWN", "REVOKED"])
    assert.equal(isActive(s, now + 1e9, now), false, s);
});

test("aggregate chọn token còn hạn xa nhất", () => {
  const now = 1000;
  const r = aggregate(
    [
      { sku: "a", state: "ACTIVE", expiryMs: 2000 },
      { sku: "b", state: "ACTIVE", expiryMs: 5000 },
      { sku: "c", state: "EXPIRED", expiryMs: 9000 },
    ],
    now,
  );
  assert.deepEqual(r, { active: true, expiryMs: 5000, sku: "b" });
  assert.deepEqual(aggregate([], now), { active: false, expiryMs: 0, sku: null });
});

test("signJwt ký RS256 và xác minh ngược được bằng crypto.subtle", async () => {
  const claims = { iss: "x@y", scope: "s", aud: "a", iat: 1, exp: 2 };
  const jwt = await signJwt(claims, PEM);
  const [h, p, s] = jwt.split(".");
  const dec = (x) => JSON.parse(Buffer.from(x, "base64url").toString());
  assert.deepEqual(dec(h), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(dec(p), claims);
  const ok = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    kp.publicKey,
    Buffer.from(s, "base64url"),
    new TextEncoder().encode(h + "." + p),
  );
  assert.equal(ok, true);
  const bad = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    kp.publicKey,
    Buffer.from(s, "base64url"),
    new TextEncoder().encode(h + "." + Buffer.from('{"iss":"evil"}').toString("base64url")),
  );
  assert.equal(bad, false);
});

// ---------- /api/verify ----------
test("verify thành công: acknowledge đúng 1 lần, lưu KV bằng băm, không log token", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  const res = await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), ORIGIN);
  const j = await res.json();
  assert.equal(j.active, true);
  assert.equal(j.sku, SKU);
  assert.equal(j.state, "ACTIVE");
  assert.ok(j.expiryMs > Date.now());
  assert.equal(google.acks.length, 1);
  assert.deepEqual(google.acks[0], { sku: SKU, token: TOKEN });

  const hash = await sha256Hex(TOKEN);
  const rec = await env.ENT.get("tok:" + hash, "json");
  assert.equal(rec.deviceId, DEVICE);
  assert.equal(rec.state, "ACTIVE");
  assert.ok(rec.ackedAt > 0);
  assert.deepEqual(await env.ENT.get("dev:" + DEVICE, "json"), [hash]);

  // Token không xuất hiện nguyên văn trong KV (đã mã hoá) hay log.
  for (const v of env.ENT.m.values()) assert.ok(!v.includes(TOKEN));
  assert.ok(!logged.join("\n").includes(TOKEN));

  // Verify lần 2 (Google đã báo acknowledged): không acknowledge thêm.
  const res2 = await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env);
  assert.equal((await res2.json()).active, true);
  assert.equal(google.acks.length, 1);
  assert.equal(google.oauth, 1, "access token được cache");
});

test("token đã hết hạn -> active=false và không acknowledge", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub({ state: "EXPIRED", expiry: Date.now() - 2 * H }));
  const j = await (await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env)).json();
  assert.equal(j.active, false);
  assert.equal(j.state, "EXPIRED");
  assert.equal(google.acks.length, 0);
  const ent = await (await worker.fetch(entReq(), env)).json();
  assert.equal(ent.active, false);
});

test("trạng thái ACTIVE nhưng expiryTime đã qua -> không active", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub({ state: "ACTIVE", expiry: Date.now() - 1000, ack: true }));
  const j = await (await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env)).json();
  assert.equal(j.active, false);
});

test("IN_GRACE_PERIOD vẫn active", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub({ state: "IN_GRACE_PERIOD", expiry: Date.now() + 2 * H, ack: true }));
  const j = await (await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env)).json();
  assert.equal(j.active, true);
  assert.equal(j.state, "IN_GRACE_PERIOD");
  assert.equal((await (await worker.fetch(entReq(), env)).json()).active, true);
});

test("ON_HOLD không active", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub({ state: "ON_HOLD", expiry: Date.now() + 2 * H, ack: true }));
  const j = await (await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env)).json();
  assert.equal(j.active, false);
});

test("verify từ chối đầu vào sai, token lạ, sku không khớp", async () => {
  const env = mkEnv();
  let r = await worker.fetch(verifyReq({ deviceId: "x", sku: SKU, purchaseToken: TOKEN }), env);
  assert.equal(r.status, 400);
  r = await worker.fetch(verifyReq({ deviceId: DEVICE, sku: "hack", purchaseToken: TOKEN }), env);
  assert.equal(r.status, 400);
  r = await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env); // Google 404
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, "invalid_token");
  google.subs.set(TOKEN, sub({ sku: "solpha_pro_yearly" }));
  r = await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env);
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, "sku_mismatch");
  r = await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }, { origin: "https://evil.example" }), env);
  assert.equal(r.status, 403);
});

test("Google lỗi 5xx -> 502; acknowledge lỗi -> ackPending và thử lại ở entitlement sau 10 phút", async () => {
  const env = mkEnv();
  google.failGet = true;
  let r = await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env);
  assert.equal(r.status, 502);

  google.failGet = false;
  google.ackOk = false;
  google.subs.set(TOKEN, sub());
  r = await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env);
  const j = await r.json();
  assert.equal(j.active, true);
  assert.equal(j.ackPending, true);
  const hash = await sha256Hex(TOKEN);
  const rec = await env.ENT.get("tok:" + hash, "json");
  assert.equal(rec.ackedAt, null);

  // Chưa đủ 10 phút -> không gọi lại.
  const before = google.gets;
  await worker.fetch(entReq(), env);
  assert.equal(google.gets, before);

  // Lùi updatedAt 11 phút -> thử lại, lần này ack thành công.
  rec.updatedAt = Date.now() - 11 * 60_000;
  await env.ENT.put("tok:" + hash, JSON.stringify(rec));
  google.ackOk = true;
  const ent = await (await worker.fetch(entReq(), env)).json();
  assert.equal(ent.active, true);
  assert.equal((await env.ENT.get("tok:" + hash, "json")).ackedAt > 0, true);
});

// ---------- /api/entitlement ----------
test("entitlement: hết hạn cục bộ -> làm mới từ Google tối đa 1 lần / 10 phút", async () => {
  const env = mkEnv();
  const hash = await sha256Hex(TOKEN);
  const past = Date.now() - 5 * 60_000;
  // Bản ghi cũ: đã hết hạn cục bộ, cập nhật từ 1 giờ trước.
  await env.ENT.put(
    "tok:" + hash,
    JSON.stringify({ sku: SKU, deviceId: DEVICE, state: "ACTIVE", expiryMs: past, ackedAt: 1, updatedAt: Date.now() - H }),
  );
  await env.ENT.put("dev:" + DEVICE, JSON.stringify([hash]));
  // tokenEnc: tạo qua verify thật để có token mã hoá -> dùng cách khác: verify rồi chỉnh bản ghi.
  google.subs.set(TOKEN, sub({ ack: true }));
  await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env);
  const rec = await env.ENT.get("tok:" + hash, "json");
  rec.expiryMs = past;
  rec.updatedAt = Date.now() - H;
  await env.ENT.put("tok:" + hash, JSON.stringify(rec));

  // Google đã gia hạn.
  google.subs.set(TOKEN, sub({ ack: true, expiry: Date.now() + 30 * 24 * H }));
  const base = google.gets;
  const e1 = await (await worker.fetch(entReq(), env)).json();
  assert.equal(e1.active, true);
  assert.equal(google.gets, base + 1);
  const e2 = await (await worker.fetch(entReq(), env)).json();
  assert.equal(e2.active, true);
  assert.equal(google.gets, base + 1, "còn hạn -> không gọi Google");

  // Google báo hết hạn thật; giả lập hết hạn cục bộ lần nữa nhưng vừa kiểm tra <10 phút -> không gọi.
  const r2 = await env.ENT.get("tok:" + hash, "json");
  r2.expiryMs = Date.now() - 1000;
  r2.updatedAt = Date.now() - 60_000;
  await env.ENT.put("tok:" + hash, JSON.stringify(r2));
  const e3 = await (await worker.fetch(entReq(), env)).json();
  assert.equal(e3.active, false);
  assert.equal(google.gets, base + 1);
});

test("entitlement: thiết bị lạ -> active=false; deviceId sai -> 400", async () => {
  const env = mkEnv();
  const j = await (await worker.fetch(entReq("99999999-2222-4333-8444-555555555555"), env)).json();
  assert.deepEqual(j, { active: false, expiryMs: 0, sku: null });
  assert.equal((await worker.fetch(entReq("abc"), env)).status, 400);
});

test("khôi phục trên thiết bị mới chuyển token sang thiết bị đó", async () => {
  const env = mkEnv();
  const dev2 = "aaaaaaaa-2222-4333-8444-555555555555";
  google.subs.set(TOKEN, sub());
  await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env);
  await worker.fetch(verifyReq({ deviceId: dev2, sku: SKU, purchaseToken: TOKEN }), env);
  assert.equal((await (await worker.fetch(entReq(dev2), env)).json()).active, true);
  assert.equal((await (await worker.fetch(entReq(DEVICE), env)).json()).active, false);
});

// ---------- RTDN ----------
test("RTDN sai hoặc thiếu key -> 401", async () => {
  const env = mkEnv();
  assert.equal((await handleRtdn(rtdnReq(snote(), "sai"), env)).status, 401);
  assert.equal((await handleRtdn(rtdnReq(snote()), env)).status, 401);
  assert.equal((await worker.fetch(rtdnReq(snote(), "sai"), env)).status, 401);
  assert.equal((await handleRtdn(rtdnReq(snote(), "x"), mkEnv({ RTDN_KEY: "" }))).status, 401);
  assert.equal(google.gets, 0);
});

test("RTDN hợp lệ làm mới trạng thái theo token (huỷ/hết hạn)", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env);
  assert.equal((await (await worker.fetch(entReq(), env)).json()).active, true);

  google.subs.set(TOKEN, sub({ state: "EXPIRED", expiry: Date.now() - 1000, ack: true }));
  const res = await worker.fetch(rtdnReq(snote(TOKEN, 13), env.RTDN_KEY), env);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).state, "EXPIRED");
  assert.equal((await (await worker.fetch(entReq(), env)).json()).active, false);
  assert.ok(!logged.join("\n").includes(TOKEN));
});

test("RTDN: testNotification, token lạ, dữ liệu hỏng, lỗi Google đều trả 200", async () => {
  const env = mkEnv();
  const k = env.RTDN_KEY;
  let r = await handleRtdn(rtdnReq(pubsub({ packageName: "app.solpha.desk", testNotification: { version: "1.0" } }), k), env);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).test, true);
  assert.equal(google.gets, 0);

  r = await handleRtdn(rtdnReq(snote("token-chua-tung-verify-123"), k), env);
  assert.equal(r.status, 200);
  assert.equal(google.gets, 0);

  r = await handleRtdn(rtdnReq({ message: { data: "!!!không-phải-base64" } }, k), env);
  assert.equal(r.status, 200);
  r = await handleRtdn(new Request("https://w.test/api/rtdn?key=" + k, { method: "POST", body: "không phải json" }), env);
  assert.equal(r.status, 200);

  google.subs.set(TOKEN, sub());
  await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env);
  google.failGet = true;
  r = await handleRtdn(rtdnReq(snote(TOKEN), k), env);
  assert.equal(r.status, 200);
  assert.ok(logged.some((l) => l.includes("rtdn_error")));
});

test("RTDN voidedPurchase thu hồi quyền lợi ngay", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await worker.fetch(verifyReq({ deviceId: DEVICE, sku: SKU, purchaseToken: TOKEN }), env);
  const note = pubsub({
    packageName: "app.solpha.desk",
    voidedPurchaseNotification: { purchaseToken: TOKEN, orderId: "GPA.1", productType: 1, refundType: 1 },
  });
  assert.equal((await handleRtdn(rtdnReq(note, env.RTDN_KEY), env)).status, 200);
  assert.equal((await (await worker.fetch(entReq(), env)).json()).active, false);
});

// ---------- CORS, health, rate limit ----------
test("CORS: preflight cho origin hợp lệ, chặn origin lạ, ALLOWED_ORIGINS bổ sung", async () => {
  const env = mkEnv({ ALLOWED_ORIGINS: "https://solpha.pages.dev, https://staging.example.dev" });
  const pre = (origin) =>
    worker.fetch(new Request("https://w.test/api/verify", { method: "OPTIONS", headers: { origin } }), env);
  let r = await pre(ORIGIN);
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  assert.match(r.headers.get("access-control-allow-methods"), /POST/);
  assert.match(r.headers.get("access-control-allow-headers"), /content-type/i);
  r = await pre("https://staging.example.dev");
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), "https://staging.example.dev");
  r = await pre("https://evil.example");
  assert.equal(r.status, 403);
  assert.equal(r.headers.get("access-control-allow-origin"), null);

  const h = await worker.fetch(new Request("https://w.test/api/health", { headers: { origin: ORIGIN } }), env);
  assert.equal(h.status, 200);
  assert.equal((await h.json()).ok, true);
  assert.equal(h.headers.get("access-control-allow-origin"), ORIGIN);
});

test("định tuyến: 404 và 405", async () => {
  const env = mkEnv();
  assert.equal((await worker.fetch(new Request("https://w.test/nope"), env)).status, 404);
  assert.equal((await worker.fetch(new Request("https://w.test/api/verify"), env)).status, 405);
  assert.equal((await worker.fetch(new Request("https://w.test/api/rtdn"), env)).status, 405);
});

test("rate limit /api/verify theo IP: yêu cầu thứ 11 trong 1 phút -> 429", async () => {
  const env = mkEnv();
  const ip = "198.51.100.7";
  const bad = { deviceId: "x" }; // 400 nhanh, không gọi Google
  for (let i = 0; i < 10; i++) {
    const r = await worker.fetch(verifyReq(bad, { ip }), env);
    assert.equal(r.status, 400, "lần " + (i + 1));
  }
  const r = await worker.fetch(verifyReq(bad, { ip }), env);
  assert.equal(r.status, 429);
  assert.ok(Number(r.headers.get("retry-after")) >= 1);
  assert.equal(r.headers.get("access-control-allow-origin"), ORIGIN);
  // IP khác không bị ảnh hưởng.
  assert.equal((await worker.fetch(verifyReq(bad, { ip: "198.51.100.8" }), env)).status, 400);
});
