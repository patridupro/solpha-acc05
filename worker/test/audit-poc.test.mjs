// BẰNG CHỨNG KHAI THÁC - kiểm toán bảo mật backend Google Play Billing của SOLPHA.
// Chạy:  node --test worker/test/audit-poc.test.mjs
//
// Quy ước: mỗi test mô tả hành vi ĐÚNG mong muốn. Test FAIL = lỗi thật (mã phát hiện F# trong tên test,
// xem docs/audit/BILLING-AUDIT.md). Test "CONTROL-*" là đối chứng: PHẢI qua, chứng minh điều đã làm đúng.
// Không sửa mã nguồn; chỉ dùng API đã export của worker/src/index.js và billing.js.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import worker, { handleRtdn, sha256Hex, rateLimit, _resetForTests } from "../src/index.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "../..");

// ---------- Khoá RSA + service account giả ----------
const kp = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const pkcs8 = Buffer.from(await crypto.subtle.exportKey("pkcs8", kp.privateKey)).toString("base64");
const PEM = `-----BEGIN PRIVATE KEY-----\n${pkcs8.match(/.{1,64}/g).join("\n")}\n-----END PRIVATE KEY-----\n`;
const SA_JSON = JSON.stringify({ client_email: "billing@solpha-test.iam.gserviceaccount.com", private_key: PEM });

// ---------- KV giả (ghi lại tuỳ chọn put để kiểm TTL) ----------
class FakeKV {
  constructor() {
    this.m = new Map();
    this.opts = new Map();
  }
  async get(key, type) {
    const v = this.m.get(key);
    if (v === undefined) return null;
    return type === "json" ? JSON.parse(v) : v;
  }
  async put(key, val, opts) {
    this.m.set(key, String(val));
    this.opts.set(key, opts || null);
  }
}

const ORIGIN = "https://solpha.pages.dev";
const DEVICE = "11111111-2222-4333-8444-555555555555";
const DEV_B = "bbbbbbbb-2222-4333-8444-555555555555";
const DEV_C = "cccccccc-2222-4333-8444-555555555555";
const TOKEN = "tok_abcdefghijklmnopqrstuvwxyz_0123456789";
const SKU = "solpha_pro_monthly";
const H = 3600_000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mkEnv(over = {}) {
  return {
    ENT: new FakeKV(),
    PACKAGE_NAME: "app.solpha.desk",
    ALLOWED_ORIGINS: ORIGIN,
    GOOGLE_SA_JSON: SA_JSON,
    RTDN_KEY: "rtdn-secret-key-0123456789abcdef0123456789",
    TOKEN_ENC_KEY: "enc-secret-key-0123456789abcdef0123456789",
    ...over,
  };
}

function sub({ state = "ACTIVE", expiry = Date.now() + 30 * 24 * H, ack = true, sku = SKU, extra = {} } = {}) {
  return {
    subscriptionState: "SUBSCRIPTION_STATE_" + state,
    acknowledgementState: ack ? "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED" : "ACKNOWLEDGEMENT_STATE_PENDING",
    lineItems: [{ productId: sku, expiryTime: new Date(expiry).toISOString() }],
    ...extra,
  };
}

// ---------- Mock fetch của Google ----------
let google;
let logged;
const realFetch = globalThis.fetch;
const realConsole = { log: console.log, info: console.info, warn: console.warn, error: console.error };

function installGoogle() {
  google = { subs: new Map(), oauth: 0, gets: 0, acks: [], failGet: false, hook: null, assertions: [] };
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u === "https://oauth2.googleapis.com/token") {
      google.oauth++;
      google.assertions.push(new URLSearchParams(init.body).get("assertion"));
      return Response.json({ access_token: "at-" + google.oauth, expires_in: 3600 });
    }
    const m = u.match(/\/applications\/([^/]+)\/purchases\/(subscriptionsv2\/tokens\/([^/:]+)|subscriptions\/([^/]+)\/tokens\/([^/:]+):acknowledge)$/);
    assert.ok(m, "URL Google không mong đợi: " + u);
    if (m[3]) {
      google.gets++;
      const n = google.gets;
      if (google.failGet) return new Response("boom", { status: 500 });
      const s = google.subs.get(decodeURIComponent(m[3]));
      if (!s) return Response.json({ error: { code: 404 } }, { status: 404 });
      const snap = JSON.stringify(s); // chụp trạng thái TẠI THỜI ĐIỂM gọi (trước khi trễ)
      if (google.hook) await google.hook(n);
      return new Response(snap, { headers: { "content-type": "application/json" } });
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
function verifyReq(body, { ip = nextIp(), origin = ORIGIN, extraHeaders = {} } = {}) {
  return new Request("https://w.test/api/verify", {
    method: "POST",
    headers: { "content-type": "application/json", ...(ip ? { "cf-connecting-ip": ip } : {}), ...(origin ? { origin } : {}), ...extraHeaders },
    body: JSON.stringify(body),
  });
}
const entReq = (device = DEVICE, ip = nextIp()) =>
  new Request("https://w.test/api/entitlement?deviceId=" + device, { headers: { origin: ORIGIN, "cf-connecting-ip": ip } });
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
const voidNote = (token = TOKEN) =>
  pubsub({
    packageName: "app.solpha.desk",
    voidedPurchaseNotification: { purchaseToken: token, orderId: "GPA.1", productType: 1, refundType: 1 },
  });

const doVerify = async (env, device = DEVICE, token = TOKEN, sku = SKU, opts) =>
  worker.fetch(verifyReq({ deviceId: device, sku, purchaseToken: token }, opts), env);
const ent = async (env, device = DEVICE) => (await worker.fetch(entReq(device), env)).json();

// =====================================================================================
// F1 [CAO] RTDN nuốt lỗi Google bằng HTTP 200 -> thông báo hoàn tiền (void) bị mất vĩnh viễn
// =====================================================================================
test("[F1] RTDN void khi Google lỗi tạm thời: phải được thử lại (non-2xx) hoặc thu hồi ngay", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await doVerify(env);
  assert.equal((await ent(env)).active, true);

  google.failGet = true; // Google 5xx đúng lúc nhận thông báo hoàn tiền
  const res = await handleRtdn(rtdnReq(voidNote(), env.RTDN_KEY), env);
  google.failGet = false;

  const after = await ent(env);
  assert.ok(
    res.status >= 500 || after.active === false,
    `RTDN trả ${res.status} (Pub/Sub sẽ KHÔNG gửi lại) và người dùng đã hoàn tiền vẫn active=${after.active}`,
  );
});

// =====================================================================================
// F2 [CAO] Token đang active + đã acknowledge không bao giờ được kiểm lại với Google cho tới khi hết hạn cục bộ
// =====================================================================================
test("[F2] Bỏ lỡ RTDN thu hồi: sau 25 giờ entitlement phải được đối chiếu lại với Google", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await doVerify(env);
  // Google thu hồi (refund + revoke): trạng thái EXPIRED, hạn đã qua. RTDN bị mất (xem F1).
  google.subs.set(TOKEN, sub({ state: "EXPIRED", expiry: Date.now() - 1000 }));
  const hash = await sha256Hex(TOKEN);
  const rec = await env.ENT.get("tok:" + hash, "json");
  rec.updatedAt = Date.now() - 25 * H;
  await env.ENT.put("tok:" + hash, JSON.stringify(rec));

  const j = await ent(env);
  assert.equal(j.active, false, "Pro vẫn còn tới " + new Date(j.expiryMs).toISOString() + " dù Google đã thu hồi");
});

// =====================================================================================
// F3 [CAO] Đã trừ tiền nhưng backend không biết token: không ack, không lưu để thử lại
// =====================================================================================
test("[F3b] RTDN SUBSCRIPTION_PURCHASED cho token chưa từng verify: server phải acknowledge (hạn 3 ngày)", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub({ ack: false }));
  const res = await handleRtdn(rtdnReq(snote(TOKEN, 4), env.RTDN_KEY), env);
  assert.equal(res.status, 200);
  assert.equal(google.acks.length, 1, "token lạ bị bỏ qua (ignored:unknown_token) -> không acknowledge -> Google tự hoàn tiền sau 3 ngày");
});

// ---------- khung dựng billing.js trong vm ----------
const clientSrc = fs.readFileSync(path.join(ROOT, "billing.js"), "utf8");
const API = "https://solpha-billing.test.workers.dev";
const jsonRes = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
function clientEnv(extra = {}, purchases = []) {
  const store = new Map();
  const win = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => void store.set(k, String(v)),
    },
    sessionStorage: { getItem: () => null, setItem() {} },
    document: { referrer: "" },
    crypto: globalThis.crypto,
    Intl, JSON, Promise, Date, console, setTimeout, clearTimeout, AbortController, encodeURIComponent,
    CustomEvent: class { constructor(t, i) { this.type = t; this.detail = i && i.detail; } },
    dispatchEvent() { return true; },
    getDigitalGoodsService: async () => ({
      getDetails: async () => [],
      listPurchases: async () => purchases,
    }),
    PaymentRequest: class {
      async canMakePayment() { return true; }
      async show() {
        return { details: { purchaseToken: "PTOKEN-1234567890" }, complete: async () => {} };
      }
    },
    fetch: async () => { throw new Error("offline"); },
    ...extra,
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(clientSrc, win);
  win.SolphaBilling.config.api = API;
  return { win, B: win.SolphaBilling, store };
}

test("[F3a] Client: verify thất bại sau khi Google đã tính tiền -> purchaseToken phải được lưu để tự thử lại", async () => {
  const { B, store } = clientEnv({ fetch: async () => { throw new Error("offline"); } });
  const r = await B.purchase("solpha_pro_monthly");
  assert.equal(r.ok, false);
  const persisted = [...store.values()].some((v) => String(v).includes("PTOKEN-1234567890"));
  assert.equal(persisted, true, "token chỉ nằm trong RAM; đóng app là mất, không có cơ chế thử lại tự động");
});

// =====================================================================================
// F4 [TRUNG BÌNH] purchaseToken là bearer: chuyển quyền không giới hạn, không gắn tài khoản Google
// =====================================================================================
test("[F4a] Một token không được lật qua lại giữa các thiết bị không giới hạn (chống cướp/chia sẻ gói)", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  const devs = [DEVICE, DEV_B];
  let refused = false;
  for (let i = 0; i < 8; i++) {
    const r = await doVerify(env, devs[i % 2]);
    if (r.status !== 200) refused = true;
  }
  assert.equal(refused, true, "8 lần chuyển liên tiếp trong vài mili-giây đều được chấp nhận");
});

test("[F4b] Nếu Google trả obfuscatedExternalAccountId thì phải khớp thiết bị yêu cầu (giả định quy ước sha256(deviceId))", async () => {
  const env = mkEnv();
  const owner = await sha256Hex(DEVICE);
  google.subs.set(TOKEN, sub({ extra: { externalAccountIdentifiers: { obfuscatedExternalAccountId: owner } } }));
  const res = await doVerify(env, DEV_B); // thiết bị khác trình token của DEVICE
  assert.notEqual(res.status, 200, "server không hề đọc externalAccountIdentifiers (parseSubscription bỏ qua)");
});

// =====================================================================================
// F5 [TRUNG BÌNH] Bất biến "một token - một thiết bị" không được kiểm khi đọc
// =====================================================================================
test("[F5a] entitlement chỉ tính token có rec.deviceId == thiết bị đang hỏi (sau lỗi giữa chừng khi chuyển)", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await doVerify(env, DEVICE);
  // Mô phỏng sập giữa "ghi tok (deviceId=B)" và "removeTokenFromDevice(DEVICE)": index.js:461-463
  const hash = await sha256Hex(TOKEN);
  const rec = await env.ENT.get("tok:" + hash, "json");
  rec.deviceId = DEV_B;
  await env.ENT.put("tok:" + hash, JSON.stringify(rec));
  await env.ENT.put("dev:" + DEV_B, JSON.stringify([hash]));
  const a = await ent(env, DEVICE);
  const b = await ent(env, DEV_B);
  assert.ok(!(a.active && b.active), "cả hai thiết bị cùng active cho MỘT token");
});

test("[F5b] Hai verify song song cho cùng token từ hai thiết bị không được cùng thắng", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await doVerify(env, DEVICE);
  google.hook = () => sleep(30); // kéo dài cửa sổ đọc-sửa-ghi
  await Promise.all([doVerify(env, DEV_B), doVerify(env, DEV_C)]);
  google.hook = null;
  const b = await ent(env, DEV_B);
  const c = await ent(env, DEV_C);
  assert.ok(!(b.active && c.active), "đua ghi: cả B và C đều active với cùng một purchaseToken");
});

// =====================================================================================
// F6 [TRUNG BÌNH] Trạng thái REVOKED (hoàn tiền) không "dính": verify lại ghi đè bằng trạng thái Google
// =====================================================================================
test("[F6] Sau RTDN void, /api/verify lại cùng token không được hồi sinh quyền lợi", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub()); // Google vẫn báo ACTIVE (hoàn tiền không kèm revoke)
  await doVerify(env);
  assert.equal((await handleRtdn(rtdnReq(voidNote(), env.RTDN_KEY), env)).status, 200);
  assert.equal((await ent(env)).active, false, "tiền điều kiện: đã thu hồi");
  const j = await (await doVerify(env)).json();
  assert.equal(j.active, false, "verify lại ghi đè REVOKED -> active=true (index.js:437-444, 461)");
});

// =====================================================================================
// F7 [TRUNG BÌNH] Xác thực RTDN chỉ bằng khoá trong URL, không bắt buộc độ dài tối thiểu
// =====================================================================================
test("[F7a] RTDN_KEY ngắn/yếu phải bị từ chối khi cấu hình (README yêu cầu >= 32 ký tự)", async () => {
  const env = mkEnv({ RTDN_KEY: "a" });
  const res = await handleRtdn(rtdnReq(snote(), "a"), env);
  assert.notEqual(res.status, 200, "khoá 1 ký tự vẫn được chấp nhận");
});

// =====================================================================================
// F8 [TRUNG BÌNH] Không tách khoá mã hoá token khỏi khoá RTDN; giải mã hỏng thì im lặng
// =====================================================================================
test("[F8a] Thiếu TOKEN_ENC_KEY: server phải từ chối (không dùng chung RTDN_KEY làm khoá mã hoá)", async () => {
  const env = mkEnv({ TOKEN_ENC_KEY: undefined });
  google.subs.set(TOKEN, sub());
  const res = await doVerify(env);
  assert.equal(res.status, 500, "index.js:165,432: RTDN_KEY (nằm trong URL, log tail) đồng thời là khoá giải mã mọi token trong KV");
});

test("[F8b] Đổi khoá sau khi có người mua: lỗi giải mã phải được ghi log cảnh báo (hiện im lặng)", async () => {
  const env1 = mkEnv({ TOKEN_ENC_KEY: undefined, RTDN_KEY: "k1-" + "x".repeat(40) });
  google.subs.set(TOKEN, sub());
  await doVerify(env1);
  const hash = await sha256Hex(TOKEN);
  const rec = await env1.ENT.get("tok:" + hash, "json");
  rec.expiryMs = Date.now() - 1000; // hết hạn cục bộ nên cần làm mới
  rec.updatedAt = Date.now() - H;
  await env1.ENT.put("tok:" + hash, JSON.stringify(rec));
  google.subs.set(TOKEN, sub({ expiry: Date.now() + 30 * 24 * H })); // Google đã gia hạn

  const env2 = { ...env1, RTDN_KEY: "k2-" + "y".repeat(40) }; // xoay khoá
  const j = await ent(env2);
  assert.ok(j.active || logged.some((l) => /decrypt/i.test(l)), "người đã gia hạn bị mất Pro và không có dòng log nào báo nguyên nhân");
});

// =====================================================================================
// F9 [TRUNG BÌNH] Rate limit theo IP trong bộ nhớ: bỏ qua bằng xoay IPv6 /64 và làm tràn store
// =====================================================================================
test("[F9a] Các địa chỉ IPv6 cùng /64 phải dùng chung một bucket", async () => {
  const env = mkEnv();
  const bad = { deviceId: "x" };
  for (let i = 1; i <= 10; i++) {
    const r = await worker.fetch(verifyReq(bad, { ip: `2001:db8:abcd:1234::${i}` }), env);
    assert.equal(r.status, 400);
  }
  const r11 = await worker.fetch(verifyReq(bad, { ip: "2001:db8:abcd:1234::ffff" }), env);
  assert.equal(r11.status, 429, "một máy chủ IPv6 có 2^64 địa chỉ: giới hạn 10/phút/IP vô nghĩa");
});

test("[F9b] Làm tràn store (>5000 khoá) không được xoá bộ đếm của kẻ tấn công", () => {
  const store = new Map();
  const now = 1_000_000;
  for (let i = 0; i < 10; i++) rateLimit("verify", "attacker", now, store);
  assert.equal(rateLimit("verify", "attacker", now, store).ok, false, "tiền điều kiện: bị chặn ở lần 11");
  for (let i = 0; i < 5001; i++) rateLimit("verify", "198.51.100." + i, now, store);
  assert.equal(rateLimit("verify", "attacker", now, store).ok, false, "store.clear() (index.js:135) đặt lại bộ đếm của mọi IP");
});

// =====================================================================================
// F10 [TRUNG BÌNH] Quyền riêng tư / khai báo: lưu vô thời hạn, deviceId, tài liệu nói ngược
// =====================================================================================
test("[F10a] Bản ghi token đã hết hạn/vô hiệu phải có TTL (không lưu vĩnh viễn)", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub({ state: "EXPIRED", expiry: Date.now() - 2 * H }));
  await doVerify(env);
  const hash = await sha256Hex(TOKEN);
  const o = env.ENT.opts.get("tok:" + hash);
  assert.ok(o && o.expirationTtl > 0, "kvPut không bao giờ truyền expirationTtl (index.js:299)");
});

const privacy = fs.readFileSync(path.join(ROOT, "privacy.html"), "utf8");
test("[F10b] privacy.html mục 4 phải nêu mã thiết bị (UUID) gửi lên máy chủ và thời hạn lưu", () => {
  const sec = privacy.split(/<h2>4\./)[1].split(/<h2>5\./)[0];
  assert.match(sec, /mã thiết bị|UUID|deviceId|định danh/i, "mục 4 chỉ nói 'mã xác nhận mua hàng'; billing.js:254 gửi deviceId");
  assert.match(sec, /giữ|lưu trữ|xoá/i);
});

test("[F10c] privacy.html không được khẳng định 'không có máy chủ riêng / không lưu' khi bật Pro", () => {
  assert.doesNotMatch(privacy, /không có máy chủ riêng/i, "tóm tắt đầu trang mâu thuẫn với Cloudflare Worker + KV");
});

// =====================================================================================
// F11 [TRUNG BÌNH] Client: lỗi 5xx/429 của backend bị coi như "không có giao dịch hiệu lực"
// =====================================================================================
test("[F11] restore() khi /api/verify trả 502: phải báo lỗi tạm thời, không phải 'inactive'", async () => {
  const { B } = clientEnv(
    {
      fetch: async (u) => (String(u).endsWith("/api/verify") ? jsonRes({ error: "upstream" }, 502) : jsonRes({ active: false, expiryMs: 0, sku: null })),
    },
    [{ itemId: "solpha_pro_monthly", purchaseToken: "TOKEN-A-1234567890" }],
  );
  const r = await B.restore();
  assert.equal(r.ok, false, "trả " + JSON.stringify({ ok: r.ok, status: r.status }) + ": người đã trả tiền thấy 'không còn hiệu lực'");
});

// =====================================================================================
// F12 [THẤP] testPurchase được chấp nhận ở production, không đánh dấu, không có cấu hình
// =====================================================================================
test("[F12a] Bản ghi phải lưu cờ test để kiểm toán/doanh thu", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub({ extra: { testPurchase: {} } }));
  await doVerify(env);
  const rec = await env.ENT.get("tok:" + (await sha256Hex(TOKEN)), "json");
  assert.equal(rec.test, true, "parseSubscription đọc testPurchase nhưng bị bỏ đi (_test không bao giờ dùng)");
});

test("[F12b] Có tuỳ chọn từ chối giao dịch thử ở production (REJECT_TEST_PURCHASES=1)", async () => {
  const env = mkEnv({ REJECT_TEST_PURCHASES: "1" });
  google.subs.set(TOKEN, sub({ extra: { testPurchase: {} } }));
  const j = await (await doVerify(env)).json();
  assert.notEqual(j.active, true);
});

// =====================================================================================
// F13 [THẤP] deviceId không có bằng chứng sở hữu: đẩy token thật khỏi danh sách; UUID hằng số công khai
// =====================================================================================
test("[F13a] Kẻ biết deviceId nạn nhân + 20 token hợp lệ không được đẩy token thật của nạn nhân ra", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await doVerify(env, DEVICE); // nạn nhân
  assert.equal((await ent(env, DEVICE)).active, true);
  for (let i = 0; i < 20; i++) {
    const t = "attacker_token_" + String(i).padStart(3, "0") + "_abcdefghijklmnop";
    google.subs.set(t, sub({ state: "EXPIRED", expiry: Date.now() - H }));
    const r = await doVerify(env, DEVICE, t);
    assert.equal(r.status, 200);
  }
  assert.equal((await ent(env, DEVICE)).active, true, "list.slice(-20) (index.js:305) đã loại token thật; deviceId không có bí mật đi kèm");
});

test("[F13b] deviceId dự phòng cố định của billing.js (00000000-0000-4000-8000-000000000000) phải bị từ chối", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  const r = await doVerify(env, "00000000-0000-4000-8000-000000000000");
  assert.equal(r.status, 400, "UUID công khai trong mã nguồn: ai cũng đọc được entitlement và mọi người dùng lỗi-localStorage dùng chung");
});

// =====================================================================================
// F14 [THẤP] verify ghi đè trạng thái mới hơn của RTDN bằng ảnh chụp Google cũ (đọc-sửa-ghi không có phiên bản)
// =====================================================================================
test("[F14] RTDN thu hồi hoàn tất trong lúc verify đang chờ Google: kết quả cuối phải là bị thu hồi", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await doVerify(env);
  const base = google.gets;
  google.hook = async (n) => {
    if (n === base + 1) await sleep(120); // GET của verify bị trễ; ảnh chụp = ACTIVE
  };
  const pVerify = doVerify(env);
  await sleep(30);
  google.subs.set(TOKEN, sub({ state: "EXPIRED", expiry: Date.now() - 1000 }));
  await handleRtdn(rtdnReq(snote(TOKEN, 12), env.RTDN_KEY), env); // SUBSCRIPTION_REVOKED
  await pVerify;
  google.hook = null;
  assert.equal((await ent(env)).active, false, "verify ghi đè bằng ACTIVE cũ ở index.js:461");
});

// =====================================================================================
// F15 [THẤP] Đọc toàn bộ body trước khi kiểm giới hạn 16 KB
// =====================================================================================
test("[F15] /api/verify phải ngừng đọc body sau ~16 KB", async () => {
  const env = mkEnv();
  let pulled = 0;
  const stream = new ReadableStream({
    pull(c) {
      pulled++;
      c.enqueue(new Uint8Array(64 * 1024).fill(65));
      if (pulled >= 40) c.close();
    },
  });
  const req = new Request("https://w.test/api/verify", {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, "cf-connecting-ip": nextIp() },
    body: stream,
    duplex: "half",
  });
  const res = await worker.fetch(req, env);
  assert.ok([400, 413].includes(res.status));
  assert.ok(pulled <= 4, `đã đọc ${pulled} x 64KB = ${pulled * 64}KB vào RAM (request.text() trước khi kiểm MAX_BODY)`);
});

// =====================================================================================
// F16 [TRUNG BÌNH có điều kiện] Pro chỉ là cờ phía client
// =====================================================================================
test("[F16] Cache solpha_ent do người dùng tự viết không được cấp Pro (cần bằng chứng do máy chủ ký)", () => {
  const { B, store } = clientEnv();
  store.set("solpha_ent", JSON.stringify({ active: true, expiryMs: Date.now() + 365 * 24 * H, sku: "solpha_pro_yearly", fetchedAt: Date.now() }));
  assert.equal(B.isPro(), false, "billing.js:140-180 tin hoàn toàn localStorage; bản web solpha.pages.dev công khai, mở DevTools là xong");
});

// =====================================================================================
// F18 [THÔNG TIN] Log lỗi chứa đoạn đầu của dữ liệu đầu vào (thông điệp JSON.parse của V8)
// =====================================================================================
test("[F18] Log lỗi RTDN không được chứa mảnh nội dung payload", async () => {
  const env = mkEnv();
  const data = Buffer.from("SECRETTOKENXYZ_abcdefghij").toString("base64");
  await handleRtdn(rtdnReq({ message: { data } }, env.RTDN_KEY), env);
  assert.ok(!logged.join("\n").includes("SECRETTOKE"), "rtdn_error ghi e.message của JSON.parse: " + logged.join(" | ").slice(0, 160));
});

// =====================================================================================
// ĐỐI CHỨNG (CONTROL): các điều mã đã làm ĐÚNG - các test này phải qua
// =====================================================================================
test("CONTROL-1 so sánh khoá RTDN hằng-thời-gian đúng với độ dài khác nhau / tiền tố / hậu tố", async () => {
  const env = mkEnv();
  const k = env.RTDN_KEY;
  for (const bad of ["", "x", k.slice(0, -1), k + "x", k.toUpperCase(), k + "\0"])
    assert.equal((await handleRtdn(rtdnReq(snote(), bad), env)).status, 401, JSON.stringify(bad));
  assert.equal(google.gets, 0);
});

test("CONTROL-2 CORS so khớp chính xác; không bao giờ trả '*'; không echo origin lạ", async () => {
  const env = mkEnv();
  for (const o of ["https://solpha.pages.dev.evil.com", "https://evilsolpha.pages.dev", "http://solpha.pages.dev", "null", "https://solpha.pages.dev:8443", "https://SOLPHA.pages.dev"]) {
    const pre = await worker.fetch(new Request("https://w.test/api/verify", { method: "OPTIONS", headers: { origin: o } }), env);
    assert.equal(pre.status, 403, o);
    assert.equal(pre.headers.get("access-control-allow-origin"), null);
    const r = await doVerify(env, DEVICE, TOKEN, SKU, { origin: o });
    assert.equal(r.status, 403, o);
    assert.equal(r.headers.get("access-control-allow-origin"), null);
  }
  const ok = await worker.fetch(new Request("https://w.test/api/health", { headers: { origin: ORIGIN } }), env);
  assert.equal(ok.headers.get("access-control-allow-origin"), ORIGIN);
  assert.equal(ok.headers.get("vary"), "Origin");
  const noOrigin = await worker.fetch(new Request("https://w.test/api/health"), env);
  assert.equal(noOrigin.headers.get("access-control-allow-origin"), null);
});

test("CONTROL-3 RTDN của gói app khác bị bỏ qua, không gọi Google", async () => {
  const env = mkEnv();
  const note = pubsub({ packageName: "com.other.app", subscriptionNotification: { notificationType: 2, purchaseToken: TOKEN } });
  const r = await handleRtdn(rtdnReq(note, env.RTDN_KEY), env);
  assert.equal((await r.json()).ignored, "other_package");
  assert.equal(google.gets, 0);
});

test("CONTROL-4 RTDN không tin loại thông báo trong payload: trạng thái luôn lấy từ Google (RTDN trễ/giả không ghi đè)", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await doVerify(env);
  await handleRtdn(rtdnReq(snote(TOKEN, 13 /* EXPIRED */), env.RTDN_KEY), env); // payload nói hết hạn, Google nói ACTIVE
  assert.equal((await ent(env)).active, true);
});

test("CONTROL-5 AES-GCM dùng IV ngẫu nhiên mỗi lần; token không lộ nguyên văn trong KV", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  const hash = await sha256Hex(TOKEN);
  await doVerify(env);
  const e1 = (await env.ENT.get("tok:" + hash, "json")).tokenEnc;
  await doVerify(env);
  const e2 = (await env.ENT.get("tok:" + hash, "json")).tokenEnc;
  assert.notEqual(e1, e2);
  for (const v of env.ENT.m.values()) assert.ok(!v.includes(TOKEN));
});

test("CONTROL-6 JWT dịch vụ: scope hẹp, aud đúng, thời hạn <= 3600 giây, iss = email service account", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub());
  await doVerify(env);
  const [, p] = google.assertions[0].split(".");
  const c = JSON.parse(Buffer.from(p, "base64url").toString());
  assert.equal(c.scope, "https://www.googleapis.com/auth/androidpublisher");
  assert.equal(c.aud, "https://oauth2.googleapis.com/token");
  assert.equal(c.iss, "billing@solpha-test.iam.gserviceaccount.com");
  assert.ok(c.exp - c.iat <= 3600);
  assert.ok(Math.abs(c.iat * 1000 - Date.now()) < 5000);
});

test("CONTROL-7 trạng thái lạ/tương lai của Google: đóng (không cấp quyền)", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub({ state: "SOME_FUTURE_STATE" }));
  assert.equal((await (await doVerify(env)).json()).active, false);
  for (const s of ["ON_HOLD", "PAUSED", "PENDING", "EXPIRED", "PENDING_PURCHASE_CANCELED"]) {
    const t = "state_token_" + s + "_0123456789";
    google.subs.set(t, sub({ state: s }));
    assert.equal((await (await doVerify(env, DEVICE, t)).json()).active, false, s);
  }
});

test("CONTROL-8 sku/đường dẫn độc hại bị từ chối trước khi gọi Google; token vô hiệu không ghi KV", async () => {
  const env = mkEnv();
  const base = google.gets;
  for (const sku of ["../../x", "solpha_pro_monthly/../../y", "", null, 5])
    assert.equal((await doVerify(env, DEVICE, TOKEN, sku)).status, 400);
  assert.equal(google.gets, base);
  const r = await doVerify(env, DEVICE, "token_khong_ton_tai_0123456789"); // Google 404
  assert.equal(r.status, 400);
  assert.equal(env.ENT.m.size, 0, "không ghi rác vào KV");
});

test("CONTROL-9 sku yêu cầu phải nằm trong lineItems thật của Google (không tin sku từ client)", async () => {
  const env = mkEnv();
  google.subs.set(TOKEN, sub({ sku: "solpha_pro_monthly" }));
  const r = await doVerify(env, DEVICE, TOKEN, "solpha_pro_yearly");
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error, "sku_mismatch");
});
