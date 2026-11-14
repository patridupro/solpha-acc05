// SOLPHA Billing - Cloudflare Worker
// Xác minh gói trả phí Google Play Billing (TWA app.solpha.desk) và lưu quyền lợi (entitlement) trong KV.
// Không phụ thuộc npm: chỉ dùng chuẩn Web (fetch, crypto.subtle, KV).
//
// Endpoint:
//   POST /api/verify       {deviceId, sku, purchaseToken[, obfuscatedExternalAccountId]}
//   GET  /api/entitlement  ?deviceId=
//   POST /api/delete       {deviceId, proof}   (xoá dữ liệu của thiết bị)
//   POST /api/rtdn         Pub/Sub push (OIDC hoặc ?key=<RTDN_KEY>)
//   GET  /api/health
//
// Secret bắt buộc: GOOGLE_SA_JSON, TOKEN_ENC_KEY (>= 32 ký tự, KHÔNG dùng chung với RTDN_KEY),
// và (RTDN_KEY >= 32 ký tự HOẶC cặp RTDN_AUDIENCE + PUSH_SA_EMAIL cho xác thực OIDC).
// KHÔNG BAO GIỜ log purchaseToken / secret / nội dung đầu vào nguyên văn.

const GOOGLE_API = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";

const DEFAULT_ORIGINS = ["https://solpha.pages.dev"];
const DEFAULT_SKUS = ["solpha_pro_monthly", "solpha_pro_yearly"];
const REFRESH_MIN_MS = 10 * 60 * 1000; // làm mới từ Google tối đa 1 lần / token / 10 phút khi cần gấp (chưa ack, hết hạn cục bộ)
const REVALIDATE_MS = 6 * 3600_000; // đối chiếu lại cả token đang active (bắt hoàn tiền/huỷ/thu hồi bị lỡ RTDN)
const MAX_BODY = 16 * 1024;
const MAX_TOKENS_PER_DEVICE = 20;
const RETENTION_MS = 90 * 86400_000; // giữ bản ghi thêm 90 ngày sau khi hết hạn gói
const TRANSFER_MAX = 3; // số lần chuyển token giữa các thiết bị
const TRANSFER_WINDOW_MS = 30 * 86400_000; // ... trong cửa sổ này
const KEY_MIN_LEN = 32;

// Trạng thái (đã bỏ tiền tố SUBSCRIPTION_STATE_) được coi là còn quyền lợi nếu chưa quá expiryTime.
// CANCELED = đã huỷ gia hạn nhưng vẫn dùng được tới hết kỳ. IN_GRACE_PERIOD = Google cho dùng tiếp khi thanh toán lỗi.
const ACTIVE_STATES = new Set(["ACTIVE", "CANCELED", "IN_GRACE_PERIOD"]);
// Trạng thái kết thúc: không đối chiếu lại với Google.
const TERMINAL = new Set(["EXPIRED", "INVALID", "REPLACED", "REVOKED"]);
// Các trường lấy từ Google/RTDN: khi bản ghi trong KV mới hơn ảnh chụp đang xử lý thì giữ bản mới.
const GOOGLE_FIELDS = ["state", "expiryMs", "ackedAt", "updatedAt", "voidedAt", "voidedOrderId", "latestOrderId", "test"];

const RATE = {
  verify: { max: 10, windowMs: 60_000 },
  entitlement: { max: 60, windowMs: 60_000 },
};
const RATE_MAX_ENTRIES = 5000;
const RATE_TRIM_TO = 4000;

// ---------------------------------------------------------------------------
// Hàm thuần
// ---------------------------------------------------------------------------

/** Chuyển JSON SubscriptionPurchaseV2 của Google thành object gọn. */
export function parseSubscription(json) {
  if (!json || typeof json !== "object") return null;
  const items = Array.isArray(json.lineItems) ? json.lineItems : [];
  let best = null;
  for (const li of items) {
    if (!li || typeof li !== "object") continue;
    const t = Date.parse(li.expiryTime);
    const ms = Number.isFinite(t) ? t : 0;
    if (!best || ms > best.ms) best = { ms, li };
  }
  const rawState = typeof json.subscriptionState === "string" ? json.subscriptionState : "";
  const ext = json.externalAccountIdentifiers;
  return {
    state: rawState.replace(/^SUBSCRIPTION_STATE_/, "") || "UNKNOWN",
    expiryMs: best ? best.ms : 0,
    sku: best && typeof best.li.productId === "string" ? best.li.productId : null,
    productIds: items.map((l) => l && l.productId).filter((x) => typeof x === "string"),
    acknowledged: json.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    linkedPurchaseToken: typeof json.linkedPurchaseToken === "string" ? json.linkedPurchaseToken : null,
    testPurchase: !!json.testPurchase,
    latestOrderId: typeof json.latestOrderId === "string" ? json.latestOrderId : null,
    extAccount: ext && typeof ext.obfuscatedExternalAccountId === "string" ? ext.obfuscatedExternalAccountId : null,
  };
}

/** Còn quyền lợi khi trạng thái cho phép VÀ chưa quá hạn. */
export function isActive(state, expiryMs, now = Date.now()) {
  return ACTIVE_STATES.has(state) && Number.isFinite(expiryMs) && expiryMs > now;
}

/** Tổng hợp nhiều bản ghi token của một thiết bị. */
export function aggregate(records, now = Date.now()) {
  let best = null;
  let maxExpiry = 0;
  for (const r of records) {
    if (!r) continue;
    if (r.expiryMs > maxExpiry) maxExpiry = r.expiryMs;
    if (isActive(r.state, r.expiryMs, now) && (!best || r.expiryMs > best.expiryMs)) best = r;
  }
  return best
    ? { active: true, expiryMs: best.expiryMs, sku: best.sku }
    : { active: false, expiryMs: maxExpiry, sku: null };
}

function b64urlFromBytes(bytes) {
  let s = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlFromString(str) {
  return b64urlFromBytes(new TextEncoder().encode(str));
}
function bytesFromB64(b64) {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm + "=".repeat((4 - (norm.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function pemToDer(pem) {
  const body = String(pem).replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  return bytesFromB64(body);
}

/** Ký JWT RS256 bằng khoá PKCS#8 PEM (khoá service account). Trả chuỗi compact JWS. */
export async function signJwt(claims, privateKeyPem, header = { alg: "RS256", typ: "JWT" }) {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signingInput = b64urlFromString(JSON.stringify(header)) + "." + b64urlFromString(JSON.stringify(claims));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  return signingInput + "." + b64urlFromBytes(sig);
}

export async function sha256Hex(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** So sánh thời gian hằng (băm SHA-256 cả hai rồi XOR). */
export async function timingSafeEqual(a, b) {
  const ha = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(a))));
  const hb = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(b))));
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

/**
 * Khoá giới hạn tốc độ theo địa chỉ: IPv4 giữ nguyên; IPv6 gộp theo /64 (một máy có 2^64 địa chỉ).
 * Idempotent: ipKey(ipKey(x)) === ipKey(x).
 */
export function ipKey(ip) {
  const s = String(ip || "unknown").trim().toLowerCase();
  if (!s.includes(":")) return s || "unknown";
  if (s.includes(".")) return s.slice(s.lastIndexOf(":") + 1) || s; // ::ffff:1.2.3.4 -> IPv4
  const [head, tail = ""] = s.split("::");
  const a = head ? head.split(":") : [];
  const b = tail ? tail.split(":") : [];
  const full = [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b];
  return full.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "")).join(":");
}

/**
 * Giới hạn tốc độ cửa sổ cố định, trong bộ nhớ isolate (best-effort; dùng thêm Cloudflare Rate Limiting nếu cần chặt).
 * Store có giới hạn kích thước: khi đầy chỉ loại các khoá hết hạn, rồi các khoá ít nguy hiểm trước;
 * KHÔNG xoá toàn bộ, và các khoá đã chạm ngưỡng chặn được giữ lại.
 */
const rateStore = new Map();
export function rateLimit(bucket, ip, now = Date.now(), store = rateStore) {
  const cfg = RATE[bucket];
  const k = bucket + ":" + ip;
  if (store.size >= RATE_MAX_ENTRIES) {
    for (const [key, v] of store) if (v.resetAt <= now) store.delete(key);
    if (store.size >= RATE_MAX_ENTRIES) {
      for (const [key, v] of store) {
        if (store.size < RATE_TRIM_TO) break;
        if (v.count < v.max) store.delete(key); // giữ các khoá đã bị/sắp bị chặn
      }
    }
    if (store.size >= RATE_MAX_ENTRIES) {
      for (const key of store.keys()) {
        if (store.size < RATE_TRIM_TO) break;
        store.delete(key); // biện pháp cuối: loại khoá cũ nhất
      }
    }
  }
  let e = store.get(k);
  if (!e || e.resetAt <= now) {
    e = { count: 0, resetAt: now + cfg.windowMs, max: cfg.max };
    store.set(k, e);
  }
  e.count++;
  return { ok: e.count <= cfg.max, retryAfter: Math.max(1, Math.ceil((e.resetAt - now) / 1000)) };
}

async function checkRate(env, bucket, ip) {
  const key = ipKey(ip);
  const binding = bucket === "entitlement" ? env.RL_ENTITLEMENT : env.RL_VERIFY;
  if (binding && typeof binding.limit === "function") {
    try {
      const r = await binding.limit({ key: bucket + ":" + key });
      return { ok: !!r.success, retryAfter: 60 };
    } catch {
      /* binding lỗi -> dùng bộ đếm trong bộ nhớ */
    }
  }
  return rateLimit(bucket, key);
}

// ---------------------------------------------------------------------------
// Log an toàn
// ---------------------------------------------------------------------------

function log(level, msg, extra) {
  // extra chỉ chứa dữ liệu đã được làm sạch (mã trạng thái, tiền tố băm ngắn...).
  try {
    console[level](JSON.stringify({ msg, ...(extra || {}) }));
  } catch {
    /* bỏ qua */
  }
}
const shortId = (hash) => String(hash || "").slice(0, 8);

/** Mã lỗi an toàn để log: KHÔNG dùng e.message (JSON.parse của V8 chèn đoạn đầu của dữ liệu đầu vào). */
function errCode(e) {
  if (e instanceof GoogleError || e instanceof RejectError) return e.message; // message do mã này tự dựng
  return (e && typeof e.name === "string" && e.name) || "error";
}

// ---------------------------------------------------------------------------
// Mã hoá purchaseToken khi lưu KV (cần để làm mới từ Google về sau)
// ---------------------------------------------------------------------------
// Định dạng: "v2.<kid>.<base64url(iv || ciphertext)>"; AES-256-GCM, khoá dẫn xuất bằng HKDF từ TOKEN_ENC_KEY,
// AAD = băm token (gắn bản mã với đúng bản ghi). Xoay khoá: đặt TOKEN_ENC_KEY_ID mới + khoá mới,
// giữ khoá cũ trong TOKEN_ENC_KEYS_OLD="kid:secret,kid2:secret2" tới khi mọi bản ghi được ghi lại.

const KID_RE = /^[A-Za-z0-9_-]{1,16}$/;
let derivedKeys = new Map();

function currentKid(env) {
  const k = String(env.TOKEN_ENC_KEY_ID || "k1");
  return KID_RE.test(k) ? k : null;
}
/** true nếu TOKEN_ENC_KEY đủ mạnh và id khoá hợp lệ. */
export function encKeyConfigured(env) {
  return typeof env.TOKEN_ENC_KEY === "string" && env.TOKEN_ENC_KEY.length >= KEY_MIN_LEN && !!currentKid(env);
}
function oldKeys(env) {
  const out = new Map();
  for (const part of String(env.TOKEN_ENC_KEYS_OLD || "").split(",")) {
    const i = part.indexOf(":");
    if (i <= 0) continue;
    const kid = part.slice(0, i).trim();
    const secret = part.slice(i + 1).trim();
    if (KID_RE.test(kid) && secret.length >= KEY_MIN_LEN) out.set(kid, secret);
  }
  return out;
}
async function deriveAesKey(secret) {
  let p = derivedKeys.get(secret);
  if (!p) {
    p = (async () => {
      const ikm = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "HKDF", false, ["deriveKey"]);
      return crypto.subtle.deriveKey(
        {
          name: "HKDF",
          hash: "SHA-256",
          salt: new TextEncoder().encode("solpha-billing"),
          info: new TextEncoder().encode("tok-aes-gcm-v2"),
        },
        ikm,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
      );
    })();
    derivedKeys.set(secret, p);
    if (derivedKeys.size > 8) derivedKeys.delete(derivedKeys.keys().next().value);
  }
  return p;
}
async function encryptToken(env, token, hash) {
  if (!encKeyConfigured(env)) throw new Error("missing_TOKEN_ENC_KEY");
  const key = await deriveAesKey(env.TOKEN_ENC_KEY);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: new TextEncoder().encode(hash) }, key, new TextEncoder().encode(token)),
  );
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return "v2." + currentKid(env) + "." + b64urlFromBytes(out);
}
/** Trả {token} hoặc {reason}; KHÔNG im lặng: caller phải log khi không có token. */
async function decryptToken(env, enc, hash) {
  try {
    if (typeof enc !== "string") return { reason: "no_ciphertext" };
    const m = enc.match(/^v2\.([A-Za-z0-9_-]{1,16})\.([\w-]+)$/);
    if (!m) return { reason: "bad_format" };
    let secret = null;
    if (encKeyConfigured(env) && m[1] === currentKid(env)) secret = env.TOKEN_ENC_KEY;
    else secret = oldKeys(env).get(m[1]) || null;
    if (!secret) return { reason: "unknown_kid" };
    const key = await deriveAesKey(secret);
    const buf = bytesFromB64(m[2]);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: buf.slice(0, 12), additionalData: new TextEncoder().encode(hash) },
      key,
      buf.slice(12),
    );
    return { token: new TextDecoder().decode(pt) };
  } catch {
    return { reason: "auth_failed" };
  }
}
const tokenEncPrefix = (env) => "v2." + currentKid(env) + ".";

// ---------------------------------------------------------------------------
// Google: xác thực service account + gọi Android Publisher API
// ---------------------------------------------------------------------------

class GoogleError extends Error {
  constructor(status, kind) {
    super("google_" + kind + "_" + status);
    this.status = status;
    this.kind = kind;
  }
}
class RejectError extends Error {
  constructor(code) {
    super("reject_" + code);
    this.code = code;
  }
}

let tokenCache = { token: null, exp: 0, inflight: null };
let saCache = { raw: null, parsed: null };
let jwksCache = { at: 0, keys: null };

export function _resetForTests() {
  tokenCache = { token: null, exp: 0, inflight: null };
  saCache = { raw: null, parsed: null };
  jwksCache = { at: 0, keys: null };
  derivedKeys = new Map();
  rateStore.clear();
}

function parseSA(env) {
  const raw = env.GOOGLE_SA_JSON;
  if (!raw) throw new Error("missing_GOOGLE_SA_JSON");
  if (saCache.raw === raw) return saCache.parsed;
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!parsed.client_email || !parsed.private_key) throw new Error("invalid_GOOGLE_SA_JSON");
  saCache = { raw, parsed };
  return parsed;
}

async function getAccessToken(env, now = Date.now()) {
  if (tokenCache.token && tokenCache.exp - 60_000 > now) return tokenCache.token;
  if (tokenCache.inflight) return tokenCache.inflight;
  tokenCache.inflight = (async () => {
    const sa = parseSA(env);
    const iat = Math.floor(now / 1000);
    const assertion = await signJwt(
      { iss: sa.client_email, scope: GOOGLE_SCOPE, aud: GOOGLE_TOKEN_URL, iat, exp: iat + 3600 },
      sa.private_key,
    );
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new GoogleError(res.status, "oauth");
    const j = await res.json();
    if (!j.access_token) throw new GoogleError(502, "oauth");
    tokenCache.token = j.access_token;
    tokenCache.exp = now + (Number(j.expires_in) || 3600) * 1000;
    return tokenCache.token;
  })();
  try {
    return await tokenCache.inflight;
  } finally {
    tokenCache.inflight = null;
  }
}

async function googleFetch(env, url, init = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const at = await getAccessToken(env);
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers || {}), authorization: "Bearer " + at },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 && attempt === 0) {
      tokenCache = { token: null, exp: 0, inflight: null };
      continue;
    }
    return res;
  }
  throw new GoogleError(401, "auth");
}

/** GET purchases.subscriptionsv2.get. Ném GoogleError('invalid') nếu token không tồn tại. */
export async function fetchSubscription(env, purchaseToken) {
  const url = `${GOOGLE_API}/applications/${encodeURIComponent(env.PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await googleFetch(env, url);
  if (res.status === 400 || res.status === 404 || res.status === 410) throw new GoogleError(res.status, "invalid");
  if (!res.ok) throw new GoogleError(res.status, "api");
  return parseSubscription(await res.json());
}

/** POST purchases.subscriptions.acknowledge (v1). Trả true nếu thành công. */
export async function acknowledgePurchase(env, sku, purchaseToken) {
  const url = `${GOOGLE_API}/applications/${encodeURIComponent(env.PACKAGE_NAME)}/purchases/subscriptions/${encodeURIComponent(sku)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`;
  const res = await googleFetch(env, url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  return res.ok;
}

// ---------------------------------------------------------------------------
// KV (mọi bản ghi đều có TTL: hạn gói + 90 ngày; bản ghi kết thúc: 90 ngày)
// ---------------------------------------------------------------------------

const kvGet = (env, key) => env.ENT.get(key, "json");

function recTtlSeconds(rec, now = Date.now()) {
  const live = rec && ACTIVE_STATES.has(rec.state) && rec.expiryMs > now ? rec.expiryMs - now : 0;
  return Math.max(60, Math.floor((live + RETENTION_MS) / 1000));
}
const kvPutRec = (env, key, rec, now = Date.now()) =>
  env.ENT.put(key, JSON.stringify(rec), { expirationTtl: recTtlSeconds(rec, now) });

const usable = (rec) => !!rec && !rec.deleted;

/** TTL của dev:<id> = TTL lớn nhất của các token thuộc thiết bị (không bao giờ ngắn hơn bản ghi nó trỏ tới). */
async function deviceTtl(env, deviceId, list, overrides, now) {
  let ttl = Math.floor(RETENTION_MS / 1000);
  for (const h of list) {
    const r = overrides[h] || (await kvGet(env, "tok:" + h));
    if (usable(r) && (!r.deviceId || r.deviceId === deviceId)) ttl = Math.max(ttl, recTtlSeconds(r, now));
  }
  return ttl;
}
const kvPutDev = (env, deviceId, list, ttl) => env.ENT.put("dev:" + deviceId, JSON.stringify(list), { expirationTtl: ttl });

/** Gắn token vào danh sách của thiết bị; khi quá giới hạn thì loại token vô dụng trước (không đẩy token thật ra). */
async function addTokenToDevice(env, deviceId, hash, newRec, now = Date.now()) {
  const list = (await kvGet(env, "dev:" + deviceId)) || [];
  if (!list.includes(hash)) list.push(hash);
  const recs = { [hash]: newRec };
  for (const h of list) if (!(h in recs)) recs[h] = await kvGet(env, "tok:" + h);
  const score = (h) => {
    const r = recs[h];
    if (!usable(r) || (r.deviceId && r.deviceId !== deviceId)) return 0; // không còn/đã thuộc máy khác
    if (!isActive(r.state, r.expiryMs, now)) return 1; // không còn quyền lợi
    return 2;
  };
  let next = list.filter((h) => h === hash || score(h) > 0 || false);
  while (next.length > MAX_TOKENS_PER_DEVICE) {
    let idx = -1;
    let low = 3;
    for (let i = 0; i < next.length; i++) {
      if (next[i] === hash) continue;
      const s = score(next[i]);
      if (s < low) {
        low = s;
        idx = i;
      }
    }
    next.splice(idx >= 0 ? idx : 0, 1);
  }
  await kvPutDev(env, deviceId, next, await deviceTtl(env, deviceId, next, recs, now));
}
async function removeTokenFromDevice(env, deviceId, hash, now = Date.now()) {
  const list = (await kvGet(env, "dev:" + deviceId)) || [];
  const next = list.filter((h) => h !== hash);
  if (next.length !== list.length) await kvPutDev(env, deviceId, next, await deviceTtl(env, deviceId, next, {}, now));
}
/** Gia hạn TTL của dev:<id> sau khi một token của nó được gia hạn. */
async function touchDevice(env, deviceId, now = Date.now()) {
  const list = await kvGet(env, "dev:" + deviceId);
  if (list && list.length) await kvPutDev(env, deviceId, list, await deviceTtl(env, deviceId, list, {}, now));
}

// ---------------------------------------------------------------------------
// Đồng bộ một token với Google
// ---------------------------------------------------------------------------

/**
 * Lấy trạng thái từ Google, kiểm sku, acknowledge nếu cần. KHÔNG ghi bản ghi (xem commitRecord).
 * opts.requireSku: Set sku chấp nhận (ném RejectError("sku_mismatch") TRƯỚC khi acknowledge/ghi).
 * opts.markInvalid=false: token Google không biết -> ném lại GoogleError thay vì đánh dấu INVALID.
 * Trả {rec, parsed, ackFailed}. rec là bản ghi sạch (không có trường nội bộ).
 */
async function syncFromGoogle(env, hash, purchaseToken, prev, now, opts = {}) {
  let parsed;
  try {
    parsed = await fetchSubscription(env, purchaseToken);
  } catch (e) {
    if (e instanceof GoogleError && e.kind === "invalid" && prev && opts.markInvalid !== false) {
      return { rec: { ...prev, state: "INVALID", expiryMs: 0, updatedAt: now }, parsed: null, ackFailed: false };
    }
    throw e;
  }
  if (opts.requireSku && !parsed.productIds.some((p) => opts.requireSku.has(p))) throw new RejectError("sku_mismatch");

  const sku = parsed.sku || (prev && prev.sku) || null;
  const rec = {
    ...(prev || {}),
    sku,
    state: parsed.state,
    expiryMs: parsed.expiryMs,
    // Google là nguồn sự thật cho trạng thái acknowledge.
    ackedAt: parsed.acknowledged ? (prev && prev.ackedAt) || now : null,
    updatedAt: now,
    latestOrderId: parsed.latestOrderId,
    test: parsed.testPurchase,
  };
  delete rec.lastTryAt;
  if (!rec.createdAt) rec.createdAt = now;

  // REVOKED "dính": đơn hàng đã bị void không được hồi sinh bởi ảnh chụp Google (có thể vẫn ACTIVE),
  // trừ khi Google báo một đơn hàng MỚI khác đơn bị void (ví dụ kỳ gia hạn sau).
  let revoked = false;
  if (prev && prev.voidedAt) {
    const revive = !!(parsed.latestOrderId && prev.voidedOrderId && parsed.latestOrderId !== prev.voidedOrderId);
    if (revive) {
      delete rec.voidedAt;
      delete rec.voidedOrderId;
    } else {
      revoked = true;
      rec.state = "REVOKED";
      rec.expiryMs = prev.expiryMs > 0 && prev.expiryMs <= now ? prev.expiryMs : now;
    }
  }

  // Mã hoá lại khi chưa có bản mã hoặc đang dùng khoá/kid cũ.
  if (opts.reencrypt || !rec.tokenEnc || !String(rec.tokenEnc).startsWith(tokenEncPrefix(env))) {
    rec.tokenEnc = await encryptToken(env, purchaseToken, hash);
  }

  let ackFailed = false;
  if (!revoked && !parsed.acknowledged && isActive(parsed.state, parsed.expiryMs, now)) {
    // BẮT BUỘC acknowledge trong 3 ngày, nếu không Google tự hoàn tiền.
    try {
      if (await acknowledgePurchase(env, sku, purchaseToken)) rec.ackedAt = now;
      else ackFailed = true;
    } catch (e) {
      ackFailed = true;
    }
    if (ackFailed) {
      rec.ackedAt = null;
      log("error", "acknowledge_failed", { tok: shortId(hash) });
    }
  }
  return { rec, parsed, ackFailed };
}

/**
 * Ghi bản ghi. Nếu trong lúc ta chờ Google có ai ghi bản MỚI hơn (updatedAt > startedAt: RTDN, void...),
 * giữ trạng thái của bản mới thay vì ghi đè bằng ảnh chụp cũ (F14). KV không nguyên tử nên chỉ thu hẹp cửa sổ đua.
 * opts.revive: cho phép ghi đè dấu xoá (người dùng chủ động verify lại).
 */
async function commitRecord(env, hash, rec, startedAt, now, linkedToken, opts = {}) {
  const fresh = await kvGet(env, "tok:" + hash);
  if (fresh && fresh.deleted && !opts.revive) return false; // đã bị xoá theo yêu cầu người dùng
  if (usable(fresh) && fresh.updatedAt > startedAt) {
    for (const f of GOOGLE_FIELDS) {
      if (f in fresh) rec[f] = fresh[f];
      else delete rec[f];
    }
  }
  await kvPutRec(env, "tok:" + hash, rec, now);

  // Nâng/hạ gói: token cũ được thay thế -> thu hồi bản ghi token cũ nếu có.
  if (linkedToken) {
    try {
      const oldHash = await sha256Hex(linkedToken);
      const old = await kvGet(env, "tok:" + oldHash);
      if (usable(old) && old.expiryMs > now) {
        await kvPutRec(env, "tok:" + oldHash, { ...old, state: "REPLACED", expiryMs: now, updatedAt: now }, now);
      }
    } catch {
      /* bỏ qua */
    }
  }
  return true;
}

/** sync + commit cho đường RTDN/entitlement (không đổi thiết bị). Trả bản ghi mới + cờ nội bộ. */
async function refreshRecord(env, hash, purchaseToken, prev, now = Date.now(), opts = {}) {
  const s = await syncFromGoogle(env, hash, purchaseToken, prev, now, opts);
  await commitRecord(env, hash, s.rec, now, now, s.parsed && s.parsed.linkedPurchaseToken, opts);
  if (s.rec.deviceId && s.rec.expiryMs > ((prev && prev.expiryMs) || 0)) {
    try {
      await touchDevice(env, s.rec.deviceId, now); // gia hạn TTL danh sách thiết bị khi token được gia hạn
    } catch {
      /* không làm hỏng việc làm mới */
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function allowedOrigins(env) {
  const extra = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...extra]);
}
function allowedSkus(env) {
  const list = String(env.SKUS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set(list.length ? list : DEFAULT_SKUS);
}
const allowTestPurchases = (env) => String(env.ALLOW_TEST_PURCHASES || "").toLowerCase() === "true";

function corsHeaders(origin) {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}
function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

/** Đọc body JSON có giới hạn: dừng đọc ngay khi vượt MAX_BODY (không nạp cả body vào RAM). */
async function readJson(request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) throw new Error("too_large");
  const reader = request.body && request.body.getReader();
  if (!reader) throw new Error("empty");
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) {
      try {
        await reader.cancel();
      } catch {
        /* bỏ qua */
      }
      throw new Error("too_large");
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(all));
}
const badBody = (e, cors) =>
  e && e.message === "too_large"
    ? json({ error: "too_large", message: "Yêu cầu quá lớn." }, 413, cors)
    : json({ error: "bad_request", message: "Yêu cầu không hợp lệ." }, 400, cors);

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ZERO_UUID_RE = /^0{8}-0{4}-/; // UUID hằng số công khai (dự phòng cũ của client) không được chấp nhận
const validDeviceId = (d) => typeof d === "string" && UUID_RE.test(d) && !ZERO_UUID_RE.test(d);

/** Mô tả lỗi cấu hình (null nếu ổn). Không trả giá trị secret. */
function configProblem(env) {
  if (!encKeyConfigured(env)) return "TOKEN_ENC_KEY";
  return null;
}

// ---------------------------------------------------------------------------
// Handler: /api/verify
// ---------------------------------------------------------------------------

export async function handleVerify(request, env, cors = {}) {
  let body;
  try {
    body = await readJson(request);
  } catch (e) {
    return badBody(e, cors);
  }
  const { deviceId, sku, purchaseToken, obfuscatedExternalAccountId } = body || {};
  if (!validDeviceId(deviceId)) return json({ error: "bad_device", message: "Mã thiết bị không hợp lệ." }, 400, cors);
  if (typeof sku !== "string" || !allowedSkus(env).has(sku))
    return json({ error: "bad_sku", message: "Gói không hợp lệ." }, 400, cors);
  if (typeof purchaseToken !== "string" || purchaseToken.length < 10 || purchaseToken.length > 4096)
    return json({ error: "bad_token", message: "Mã giao dịch không hợp lệ." }, 400, cors);
  // Quy ước gắn tài khoản: obfuscatedAccountId = sha256(deviceId) dạng hex.
  const expectedAcct = await sha256Hex(deviceId);
  if (obfuscatedExternalAccountId !== undefined && obfuscatedExternalAccountId !== expectedAcct)
    return json({ error: "account_mismatch", message: "Giao dịch không thuộc thiết bị này." }, 403, cors);
  if (configProblem(env)) {
    log("error", "server_misconfigured", { missing: configProblem(env) });
    return json({ error: "server_misconfigured", message: "Máy chủ chưa được cấu hình." }, 500, cors);
  }

  const now = Date.now();
  const hash = await sha256Hex(purchaseToken);
  const prevRaw = await kvGet(env, "tok:" + hash);
  const prev = usable(prevRaw) ? prevRaw : null;

  let s;
  try {
    const base = prev
      ? { ...prev }
      : { sku, deviceId: null, state: "UNKNOWN", expiryMs: 0, ackedAt: null, updatedAt: 0 };
    s = await syncFromGoogle(env, hash, purchaseToken, base, now, {
      markInvalid: false,
      requireSku: new Set([sku]),
      reencrypt: true,
    });
  } catch (e) {
    if (e instanceof RejectError) {
      log("warn", "verify_sku_mismatch", { tok: shortId(hash) });
      return json({ error: "sku_mismatch", message: "Gói không khớp với giao dịch." }, 400, cors);
    }
    if (e instanceof GoogleError && e.kind === "invalid") {
      log("warn", "verify_invalid_token", { tok: shortId(hash), status: e.status });
      return json({ error: "invalid_token", message: "Giao dịch không hợp lệ hoặc không tìm thấy." }, 400, cors);
    }
    log("error", "verify_google_error", { tok: shortId(hash), err: errCode(e) });
    return json({ error: "upstream", message: "Không liên lạc được Google Play. Vui lòng thử lại." }, 502, cors);
  }

  const { rec, parsed } = s;
  const commitOpts = { revive: true };
  const reject = async (status, error, message, extra) => {
    // Vẫn lưu bản ghi (chưa gắn thiết bị mới) để lần RTDN/verify sau có dữ liệu; không đổi chủ sở hữu.
    await commitRecord(env, hash, rec, now, now, parsed.linkedPurchaseToken, commitOpts);
    return json({ error, message, ...(extra || {}) }, status, cors);
  };

  // F4b: Google báo token đã gắn với tài khoản (obfuscatedExternalAccountId) -> phải khớp thiết bị yêu cầu.
  if (parsed.extAccount && parsed.extAccount !== expectedAcct)
    return reject(403, "account_mismatch", "Giao dịch không thuộc thiết bị này.");

  // F12: giao dịch license-tester chỉ được chấp nhận khi ALLOW_TEST_PURCHASES=true.
  if (rec.test && !allowTestPurchases(env)) {
    log("warn", "verify_test_purchase_rejected", { tok: shortId(hash) });
    return reject(403, "test_purchase_not_allowed", "Giao dịch thử không được chấp nhận.");
  }

  // F4a: giới hạn số lần chuyển token giữa các thiết bị (chặn cướp/chia sẻ gói).
  let transfers = Array.isArray(rec.transfers) ? rec.transfers.filter((t) => now - t < TRANSFER_WINDOW_MS) : [];
  const moving = !!(prev && prev.deviceId && prev.deviceId !== deviceId);
  if (moving) {
    if (transfers.length >= TRANSFER_MAX) {
      log("warn", "verify_transfer_limited", { tok: shortId(hash) });
      return reject(429, "transfer_limited", "Giao dịch đã chuyển thiết bị quá nhiều lần. Liên hệ hỗ trợ.");
    }
    transfers.push(now);
  }

  // Gắn token với thiết bị (một token chỉ thuộc một thiết bị tại một thời điểm; khôi phục trên máy mới sẽ chuyển sang máy đó).
  const finalRec = { ...rec, sku: rec.sku || sku, deviceId, transfers };
  await commitRecord(env, hash, finalRec, now, now, parsed.linkedPurchaseToken, commitOpts);
  if (moving) await removeTokenFromDevice(env, prev.deviceId, hash, now);
  await addTokenToDevice(env, deviceId, hash, finalRec, now);

  const active = isActive(finalRec.state, finalRec.expiryMs, now);
  const out = { active, expiryMs: finalRec.expiryMs, sku: finalRec.sku, state: finalRec.state };
  if (s.ackFailed) out.ackPending = true;
  return json(out, 200, cors);
}

// ---------------------------------------------------------------------------
// Handler: /api/entitlement
// ---------------------------------------------------------------------------

export async function handleEntitlement(request, env, cors = {}) {
  const deviceId = new URL(request.url).searchParams.get("deviceId") || "";
  if (!validDeviceId(deviceId)) return json({ error: "bad_device", message: "Mã thiết bị không hợp lệ." }, 400, cors);

  const now = Date.now();
  const hashes = (await kvGet(env, "dev:" + deviceId)) || [];
  const records = [];
  for (const hash of hashes) {
    let rec = await kvGet(env, "tok:" + hash);
    if (!usable(rec)) continue;
    // Bất biến một token - một thiết bị: chỉ hưởng token mà bản ghi tok: đang ghi là của mình (F5).
    if (rec.deviceId && rec.deviceId !== deviceId) continue;
    if (rec.test && !allowTestPurchases(env)) continue;

    // F2: ngoài trường hợp cần gấp (chưa ack / đã hết hạn cục bộ), cũng đối chiếu lại token đang active mỗi 6 giờ.
    const age = now - (rec.updatedAt || 0);
    const urgent = !isActive(rec.state, rec.expiryMs, now) || !rec.ackedAt;
    const due = urgent ? age >= REFRESH_MIN_MS : age >= REVALIDATE_MS;
    const needsRefresh = !TERMINAL.has(rec.state) && due && now - (rec.lastTryAt || 0) >= REFRESH_MIN_MS;
    if (needsRefresh) {
      const dec = await decryptToken(env, rec.tokenEnc, hash);
      if (!dec.token) {
        // Không được im lặng: người dùng sẽ mất quyền khi hết hạn cục bộ mà không ai biết vì sao.
        log("warn", "token_decrypt_failed", { tok: shortId(hash), reason: dec.reason });
      } else {
        try {
          rec = (await refreshRecord(env, hash, dec.token, rec, now)).rec;
        } catch (e) {
          log("warn", "entitlement_refresh_failed", { tok: shortId(hash), err: errCode(e) });
          // Ghi lastTryAt để không gọi Google dồn dập khi Google đang lỗi (đọc lại để không đè bản ghi mới hơn).
          try {
            const cur = (await kvGet(env, "tok:" + hash)) || rec;
            if (usable(cur)) {
              rec = { ...cur, lastTryAt: now };
              await kvPutRec(env, "tok:" + hash, rec, now);
            }
          } catch {
            /* bỏ qua */
          }
        }
      }
    }
    records.push(rec);
  }
  return json(aggregate(records, now), 200, cors);
}

// ---------------------------------------------------------------------------
// Handler: /api/delete (quyền xoá dữ liệu)
// ---------------------------------------------------------------------------

/**
 * POST {deviceId, proof}. Xoá dev:<deviceId> và mọi tok:<hash> gắn với thiết bị đó.
 * Bằng chứng sở hữu (proof), một trong hai:
 *  - một purchaseToken đang gắn với thiết bị (hoặc chưa gắn thiết bị nào);
 *  - chính deviceId (UUID v4 ngẫu nhiên 122 bit, đóng vai bí mật mang theo; cùng mức tin cậy với GET /api/entitlement).
 * Bản ghi bị xoá để lại dấu xoá (chỉ băm, không dữ liệu cá nhân) 90 ngày để RTDN muộn không tạo lại bản ghi.
 */
export async function handleDelete(request, env, cors = {}) {
  let body;
  try {
    body = await readJson(request);
  } catch (e) {
    return badBody(e, cors);
  }
  const { deviceId, proof } = body || {};
  if (!validDeviceId(deviceId)) return json({ error: "bad_device", message: "Mã thiết bị không hợp lệ." }, 400, cors);
  if (typeof proof !== "string" || proof.length < 10 || proof.length > 4096)
    return json({ error: "bad_proof", message: "Thiếu bằng chứng sở hữu." }, 400, cors);

  const now = Date.now();
  const list = (await kvGet(env, "dev:" + deviceId)) || [];
  const proofHash = await sha256Hex(proof);
  let authorized = false;
  if (proof.toLowerCase() === deviceId.toLowerCase()) {
    authorized = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId); // phải là UUID v4 ngẫu nhiên
  } else {
    const rec = await kvGet(env, "tok:" + proofHash);
    authorized = usable(rec) && (rec.deviceId === deviceId || !rec.deviceId || list.includes(proofHash));
  }
  if (!authorized) return json({ error: "forbidden", message: "Không xác minh được quyền sở hữu." }, 403, cors);

  const hashes = new Set(list);
  if (proof.toLowerCase() !== deviceId.toLowerCase()) hashes.add(proofHash);
  let deleted = 0;
  for (const h of hashes) {
    const r = await kvGet(env, "tok:" + h);
    if (!usable(r)) continue;
    if (r.deviceId && r.deviceId !== deviceId) continue; // token đã chuyển sang máy khác: không thuộc quyền xoá của máy này
    await kvPutRec(env, "tok:" + h, { deleted: true, updatedAt: now, state: "DELETED", expiryMs: 0 }, now);
    deleted++;
  }
  if (typeof env.ENT.delete === "function") await env.ENT.delete("dev:" + deviceId);
  else await kvPutDev(env, deviceId, [], 60);
  log("info", "device_deleted", { n: deleted });
  return json({ ok: true, deleted }, 200, cors);
}

// ---------------------------------------------------------------------------
// Handler: /api/rtdn (Pub/Sub push)
// ---------------------------------------------------------------------------

/** Xác thực JWT OIDC do Pub/Sub push gắn vào Authorization: Bearer. Ném lỗi nếu không lấy được JWKS (để Pub/Sub gửi lại). */
export async function verifyPushJwt(request, env, now = Date.now()) {
  const m = (request.headers.get("authorization") || "").match(/^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/);
  if (!m) return false;
  let header, claims;
  try {
    header = JSON.parse(new TextDecoder().decode(bytesFromB64(m[1])));
    claims = JSON.parse(new TextDecoder().decode(bytesFromB64(m[2])));
  } catch {
    return false;
  }
  if (!header || header.alg !== "RS256" || typeof header.kid !== "string" || !claims) return false;

  const load = async () => {
    const res = await fetch(GOOGLE_CERTS_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("jwks_" + res.status);
    const j = await res.json();
    if (!j || !Array.isArray(j.keys)) throw new Error("jwks_bad");
    jwksCache = { at: now, keys: j.keys };
  };
  if (!jwksCache.keys || now - jwksCache.at > 3600_000) await load();
  let jwk = jwksCache.keys.find((k) => k.kid === header.kid);
  if (!jwk && now - jwksCache.at > 60_000) {
    await load();
    jwk = jwksCache.keys.find((k) => k.kid === header.kid);
  }
  if (!jwk) return false;
  let ok = false;
  try {
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, bytesFromB64(m[3]), new TextEncoder().encode(m[1] + "." + m[2]));
  } catch {
    return false;
  }
  return (
    ok &&
    (claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com") &&
    claims.aud === env.RTDN_AUDIENCE &&
    claims.email === env.PUSH_SA_EMAIL &&
    claims.email_verified === true &&
    Number(claims.exp) * 1000 > now
  );
}

/** "ok" | "unauthorized" | "retry". OIDC nếu có RTDN_AUDIENCE + PUSH_SA_EMAIL; nếu không thì ?key= (>= 32 ký tự). */
async function authRtdn(request, env) {
  if (env.RTDN_AUDIENCE && env.PUSH_SA_EMAIL) {
    try {
      return (await verifyPushJwt(request, env)) ? "ok" : "unauthorized";
    } catch (e) {
      log("error", "rtdn_oidc_error", { err: errCode(e) });
      return "retry";
    }
  }
  if (typeof env.RTDN_KEY !== "string" || env.RTDN_KEY.length < KEY_MIN_LEN) {
    log("error", "rtdn_key_missing_or_weak", { minLen: KEY_MIN_LEN });
    return "unauthorized";
  }
  const key = new URL(request.url).searchParams.get("key") || "";
  return (await timingSafeEqual(key, env.RTDN_KEY)) ? "ok" : "unauthorized";
}

/**
 * Mã trả về cho Pub/Sub:
 *  - 200: đã xử lý, hoặc dữ liệu hỏng vĩnh viễn / testNotification / gói app khác (gửi lại cũng vô ích);
 *  - 401: xác thực sai; 500: cấu hình sai;
 *  - 503: lỗi tạm thời (Google, KV...) -> Pub/Sub gửi lại với backoff (nên cấu hình dead-letter topic).
 */
export async function handleRtdn(request, env) {
  const auth = await authRtdn(request, env);
  if (auth === "retry") return json({ ok: false, error: "retry" }, 503);
  if (auth !== "ok") return json({ error: "unauthorized" }, 401);
  if (configProblem(env)) {
    log("error", "server_misconfigured", { missing: configProblem(env) });
    return json({ error: "server_misconfigured" }, 500);
  }

  // Giai đoạn 1: đọc/giải mã payload. Lỗi ở đây là lỗi dữ liệu VĨNH VIỄN -> 200 để Pub/Sub không gửi lại.
  let note;
  try {
    const body = await readJson(request);
    const b64 = body && body.message && body.message.data;
    if (typeof b64 !== "string") return json({ ok: true, ignored: "no_data" });
    note = JSON.parse(new TextDecoder().decode(bytesFromB64(b64)));
  } catch (e) {
    log("warn", "rtdn_bad_payload", { err: errCode(e) });
    return json({ ok: true, ignored: "bad_payload" });
  }
  if (!note || typeof note !== "object") return json({ ok: true, ignored: "bad_payload" });
  if (env.PACKAGE_NAME && note.packageName !== env.PACKAGE_NAME) return json({ ok: true, ignored: "other_package" });
  if (note.testNotification) {
    log("info", "rtdn_test");
    return json({ ok: true, test: true });
  }
  const sn = note.subscriptionNotification;
  const vn = note.voidedPurchaseNotification;
  const token = (sn && sn.purchaseToken) || (vn && vn.purchaseToken);
  if (typeof token !== "string" || !token || token.length > 4096) return json({ ok: true, ignored: "no_token" });
  if (vn && vn.productType === 2) return json({ ok: true, ignored: "one_time_product" });

  // Giai đoạn 2: xử lý. MỌI lỗi (Google, KV...) là tạm thời -> 503 để Pub/Sub gửi lại.
  try {
    const now = Date.now();
    const hash = await sha256Hex(token);
    const prevRaw = await kvGet(env, "tok:" + hash);
    if (prevRaw && prevRaw.deleted) return json({ ok: true, ignored: "deleted" });
    const prev = usable(prevRaw) ? prevRaw : null;

    if (vn) {
      // Thu hồi KHÔNG phụ thuộc Google: ghi REVOKED trước (F1), và REVOKED "dính" (F6).
      const orderId = typeof vn.orderId === "string" ? vn.orderId : null;
      const rec = {
        ...(prev || { sku: null, deviceId: null, ackedAt: null, createdAt: now, tokenEnc: await encryptToken(env, token, hash) }),
        state: "REVOKED",
        expiryMs: now,
        updatedAt: now,
        voidedAt: (prev && prev.voidedAt) || now,
        voidedOrderId: orderId || (prev && prev.voidedOrderId) || null,
      };
      await kvPutRec(env, "tok:" + hash, rec, now);
      log("info", "rtdn_voided", { tok: shortId(hash), known: !!prev });
      return json({ ok: true, state: "REVOKED" });
    }

    if (!prev) {
      // Token chưa thiết bị nào xác minh (client chết giữa chừng sau khi Google đã tính tiền, F3):
      // server tự lấy trạng thái, acknowledge nếu hợp lệ, và lưu bản ghi chưa gắn thiết bị để verify/restore về sau gắn vào.
      try {
        const base = { sku: null, deviceId: null, state: "UNKNOWN", expiryMs: 0, ackedAt: null, updatedAt: 0 };
        const s = await syncFromGoogle(env, hash, token, base, now, { markInvalid: false, requireSku: allowedSkus(env) });
        await commitRecord(env, hash, s.rec, now, now, s.parsed.linkedPurchaseToken);
        log("info", "rtdn_adopted", { tok: shortId(hash), state: s.rec.state, type: sn && sn.notificationType });
        return json({ ok: true, adopted: true, state: s.rec.state });
      } catch (e) {
        if (e instanceof RejectError) return json({ ok: true, ignored: "other_sku" });
        if (e instanceof GoogleError && e.kind === "invalid") return json({ ok: true, ignored: "invalid_token" });
        throw e;
      }
    }

    const s = await refreshRecord(env, hash, token, prev, now);
    log("info", "rtdn_refreshed", { tok: shortId(hash), state: s.rec.state, type: sn ? sn.notificationType : "void" });
    return json({ ok: true, state: s.rec.state });
  } catch (e) {
    log("error", "rtdn_error", { err: errCode(e) });
    return json({ ok: false, error: "retry" }, 503);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method;
  const origin = request.headers.get("origin");
  const originOk = !origin || allowedOrigins(env).has(origin);
  const cors = origin && originOk ? corsHeaders(origin) : {};

  if (method === "OPTIONS") {
    return originOk && origin ? new Response(null, { status: 204, headers: cors }) : new Response(null, { status: 403 });
  }

  if (path === "/api/health") {
    return json({ ok: true, service: "solpha-billing", configured: !configProblem(env), time: new Date().toISOString() }, 200, cors);
  }
  if (path === "/api/rtdn") {
    if (method !== "POST") return json({ error: "method_not_allowed" }, 405);
    return handleRtdn(request, env);
  }

  if (path === "/api/verify" || path === "/api/entitlement" || path === "/api/delete") {
    const wantMethod = path === "/api/entitlement" ? "GET" : "POST";
    if (method !== wantMethod) return json({ error: "method_not_allowed" }, 405, cors);
    if (!originOk) return json({ error: "forbidden_origin" }, 403);
    // Chỉ tin cf-connecting-ip (Cloudflare tự đặt, client không giả được); không dùng x-forwarded-for.
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const rl = await checkRate(env, path === "/api/entitlement" ? "entitlement" : "verify", ip);
    if (!rl.ok) {
      return json({ error: "rate_limited", message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút." }, 429, {
        ...cors,
        "retry-after": String(rl.retryAfter),
      });
    }
    if (path === "/api/verify") return handleVerify(request, env, cors);
    if (path === "/api/delete") return handleDelete(request, env, cors);
    return handleEntitlement(request, env, cors);
  }

  return json({ error: "not_found" }, 404, cors);
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      log("error", "unhandled", { err: errCode(e) });
      return json({ error: "internal", message: "Lỗi máy chủ. Vui lòng thử lại." }, 500);
    }
  },
};
