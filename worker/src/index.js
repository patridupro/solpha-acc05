// SOLPHA Billing - Cloudflare Worker
// Xác minh gói trả phí Google Play Billing (TWA app.solpha.desk) và lưu quyền lợi (entitlement) trong KV.
// Không phụ thuộc npm: chỉ dùng chuẩn Web (fetch, crypto.subtle, KV).
//
// Endpoint:
//   POST /api/verify       {deviceId, sku, purchaseToken}
//   GET  /api/entitlement  ?deviceId=
//   POST /api/rtdn         ?key=<RTDN_KEY>  (Pub/Sub push)
//   GET  /api/health
//
// Secret bắt buộc: GOOGLE_SA_JSON, RTDN_KEY. Tuỳ chọn: TOKEN_ENC_KEY (mặc định dùng RTDN_KEY).
// KHÔNG BAO GIỜ log purchaseToken / secret nguyên văn.

const GOOGLE_API = "https://androidpublisher.googleapis.com/androidpublisher/v3";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

const DEFAULT_ORIGINS = ["https://solpha.pages.dev"];
const DEFAULT_SKUS = ["solpha_pro_monthly", "solpha_pro_yearly"];
const REFRESH_MIN_MS = 10 * 60 * 1000; // làm mới từ Google tối đa 1 lần / token / 10 phút
const MAX_BODY = 16 * 1024;
const MAX_TOKENS_PER_DEVICE = 20;

// Trạng thái (đã bỏ tiền tố SUBSCRIPTION_STATE_) được coi là còn quyền lợi nếu chưa quá expiryTime.
// CANCELED = đã huỷ gia hạn nhưng vẫn dùng được tới hết kỳ. IN_GRACE_PERIOD = Google cho dùng tiếp khi thanh toán lỗi.
const ACTIVE_STATES = new Set(["ACTIVE", "CANCELED", "IN_GRACE_PERIOD"]);

const RATE = {
  verify: { max: 10, windowMs: 60_000 },
  entitlement: { max: 60, windowMs: 60_000 },
};

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
  return {
    state: rawState.replace(/^SUBSCRIPTION_STATE_/, "") || "UNKNOWN",
    expiryMs: best ? best.ms : 0,
    sku: best && typeof best.li.productId === "string" ? best.li.productId : null,
    productIds: items.map((l) => l && l.productId).filter((x) => typeof x === "string"),
    acknowledged: json.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
    linkedPurchaseToken: typeof json.linkedPurchaseToken === "string" ? json.linkedPurchaseToken : null,
    testPurchase: !!json.testPurchase,
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

/** Giới hạn tốc độ cửa sổ cố định, trong bộ nhớ isolate (best-effort). */
const rateStore = new Map();
export function rateLimit(bucket, ip, now = Date.now(), store = rateStore) {
  const cfg = RATE[bucket];
  const k = bucket + ":" + ip;
  if (store.size > 5000) {
    for (const [key, v] of store) if (v.resetAt <= now) store.delete(key);
    if (store.size > 5000) store.clear();
  }
  let e = store.get(k);
  if (!e || e.resetAt <= now) {
    e = { count: 0, resetAt: now + cfg.windowMs };
    store.set(k, e);
  }
  e.count++;
  return { ok: e.count <= cfg.max, retryAfter: Math.max(1, Math.ceil((e.resetAt - now) / 1000)) };
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

// ---------------------------------------------------------------------------
// Mã hoá purchaseToken khi lưu KV (cần để làm mới từ Google về sau)
// ---------------------------------------------------------------------------

async function encKey(env) {
  const secret = env.TOKEN_ENC_KEY || env.RTDN_KEY;
  if (!secret) return null;
  const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("solpha-billing:tok:" + secret));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function encryptToken(env, token) {
  const key = await encKey(env);
  if (!key) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token)));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return "v1." + b64urlFromBytes(out);
}
async function decryptToken(env, enc) {
  try {
    if (typeof enc !== "string" || !enc.startsWith("v1.")) return null;
    const key = await encKey(env);
    if (!key) return null;
    const buf = bytesFromB64(enc.slice(3));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: buf.slice(0, 12) }, key, buf.slice(12));
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

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

let tokenCache = { token: null, exp: 0, inflight: null };
let saCache = { raw: null, parsed: null };

export function _resetForTests() {
  tokenCache = { token: null, exp: 0, inflight: null };
  saCache = { raw: null, parsed: null };
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
// KV
// ---------------------------------------------------------------------------

const kvGet = (env, key) => env.ENT.get(key, "json");
const kvPut = (env, key, val) => env.ENT.put(key, JSON.stringify(val));

async function addTokenToDevice(env, deviceId, hash) {
  const list = (await kvGet(env, "dev:" + deviceId)) || [];
  if (!list.includes(hash)) {
    list.push(hash);
    await kvPut(env, "dev:" + deviceId, list.slice(-MAX_TOKENS_PER_DEVICE));
  }
}
async function removeTokenFromDevice(env, deviceId, hash) {
  const list = (await kvGet(env, "dev:" + deviceId)) || [];
  const next = list.filter((h) => h !== hash);
  if (next.length !== list.length) await kvPut(env, "dev:" + deviceId, next);
}

/**
 * Làm mới một token từ Google, cập nhật KV, acknowledge nếu cần.
 * Trả bản ghi mới. Ném lỗi mạng/API (GoogleError) cho caller xử lý.
 */
async function refreshRecord(env, hash, purchaseToken, prev, now = Date.now(), opts = {}) {
  let parsed;
  try {
    parsed = await fetchSubscription(env, purchaseToken);
  } catch (e) {
    if (e instanceof GoogleError && e.kind === "invalid" && prev && opts.markInvalid !== false) {
      const rec = { ...prev, state: "INVALID", expiryMs: 0, updatedAt: now };
      await kvPut(env, "tok:" + hash, rec);
      return rec;
    }
    throw e;
  }
  const sku = parsed.sku || (prev && prev.sku) || null;
  const rec = {
    ...(prev || {}),
    sku,
    state: parsed.state,
    expiryMs: parsed.expiryMs,
    // Google là nguồn sự thật cho trạng thái acknowledge.
    ackedAt: parsed.acknowledged ? (prev && prev.ackedAt) || now : null,
    updatedAt: now,
  };
  let ackFailed = false;
  if (!parsed.acknowledged && isActive(parsed.state, parsed.expiryMs, now)) {
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
  await kvPut(env, "tok:" + hash, rec);

  // Nâng/hạ gói: token cũ được thay thế -> thu hồi bản ghi token cũ nếu có.
  if (parsed.linkedPurchaseToken) {
    try {
      const oldHash = await sha256Hex(parsed.linkedPurchaseToken);
      const old = await kvGet(env, "tok:" + oldHash);
      if (old && old.expiryMs > now) await kvPut(env, "tok:" + oldHash, { ...old, state: "REPLACED", expiryMs: now, updatedAt: now });
    } catch {
      /* bỏ qua */
    }
  }
  return { ...rec, _ackFailed: ackFailed, _test: parsed.testPurchase, _productIds: parsed.productIds };
}

const stripInternal = (r) => {
  const { _ackFailed, _test, _productIds, ...rest } = r;
  return rest;
};

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
async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) throw new Error("too_large");
  return JSON.parse(text);
}
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// ---------------------------------------------------------------------------
// Handler: /api/verify
// ---------------------------------------------------------------------------

export async function handleVerify(request, env, cors = {}) {
  let body;
  try {
    body = await readJson(request);
  } catch {
    return json({ error: "bad_request", message: "Yêu cầu không hợp lệ." }, 400, cors);
  }
  const { deviceId, sku, purchaseToken } = body || {};
  if (typeof deviceId !== "string" || !UUID_RE.test(deviceId))
    return json({ error: "bad_device", message: "Mã thiết bị không hợp lệ." }, 400, cors);
  if (typeof sku !== "string" || !allowedSkus(env).has(sku))
    return json({ error: "bad_sku", message: "Gói không hợp lệ." }, 400, cors);
  if (typeof purchaseToken !== "string" || purchaseToken.length < 10 || purchaseToken.length > 4096)
    return json({ error: "bad_token", message: "Mã giao dịch không hợp lệ." }, 400, cors);
  if (!env.RTDN_KEY && !env.TOKEN_ENC_KEY)
    return json({ error: "server_misconfigured", message: "Máy chủ chưa được cấu hình." }, 500, cors);

  const now = Date.now();
  const hash = await sha256Hex(purchaseToken);
  const prev = await kvGet(env, "tok:" + hash);

  let rec;
  try {
    // Bản ghi chưa có -> tạo trước (không có state) để refreshRecord ghi đè.
    const base = prev || { sku, deviceId, state: "UNKNOWN", expiryMs: 0, ackedAt: null, updatedAt: 0 };
    base.tokenEnc = await encryptToken(env, purchaseToken);
    rec = await refreshRecord(env, hash, purchaseToken, base, now, { markInvalid: false });
  } catch (e) {
    if (e instanceof GoogleError && e.kind === "invalid") {
      log("warn", "verify_invalid_token", { tok: shortId(hash), status: e.status });
      return json({ error: "invalid_token", message: "Giao dịch không hợp lệ hoặc không tìm thấy." }, 400, cors);
    }
    log("error", "verify_google_error", { tok: shortId(hash), err: String(e && e.message) });
    return json({ error: "upstream", message: "Không liên lạc được Google Play. Vui lòng thử lại." }, 502, cors);
  }

  if (!rec._productIds.includes(sku)) {
    log("warn", "verify_sku_mismatch", { tok: shortId(hash) });
    return json({ error: "sku_mismatch", message: "Gói không khớp với giao dịch." }, 400, cors);
  }

  // Gắn token với thiết bị (một token chỉ thuộc một thiết bị tại một thời điểm; khôi phục trên máy mới sẽ chuyển sang máy đó).
  const finalRec = { ...stripInternal(rec), sku: rec.sku || sku, deviceId };
  await kvPut(env, "tok:" + hash, finalRec);
  if (prev && prev.deviceId && prev.deviceId !== deviceId) await removeTokenFromDevice(env, prev.deviceId, hash);
  await addTokenToDevice(env, deviceId, hash);

  const active = isActive(finalRec.state, finalRec.expiryMs, now);
  const out = { active, expiryMs: finalRec.expiryMs, sku: finalRec.sku, state: finalRec.state };
  if (rec._ackFailed) out.ackPending = true;
  return json(out, 200, cors);
}

// ---------------------------------------------------------------------------
// Handler: /api/entitlement
// ---------------------------------------------------------------------------

export async function handleEntitlement(request, env, cors = {}) {
  const deviceId = new URL(request.url).searchParams.get("deviceId") || "";
  if (!UUID_RE.test(deviceId)) return json({ error: "bad_device", message: "Mã thiết bị không hợp lệ." }, 400, cors);

  const now = Date.now();
  const hashes = (await kvGet(env, "dev:" + deviceId)) || [];
  const records = [];
  for (const hash of hashes) {
    let rec = await kvGet(env, "tok:" + hash);
    if (!rec) continue;
    const needsRefresh =
      rec.state !== "EXPIRED" &&
      rec.state !== "INVALID" &&
      rec.state !== "REPLACED" &&
      rec.state !== "REVOKED" &&
      (!isActive(rec.state, rec.expiryMs, now) || !rec.ackedAt) &&
      now - (rec.updatedAt || 0) >= REFRESH_MIN_MS;
    if (needsRefresh) {
      const token = await decryptToken(env, rec.tokenEnc);
      if (token) {
        try {
          rec = stripInternal(await refreshRecord(env, hash, token, rec, now));
        } catch (e) {
          log("warn", "entitlement_refresh_failed", { tok: shortId(hash), err: String(e && e.message) });
          // Ghi updatedAt để không gọi Google dồn dập khi Google đang lỗi.
          rec = { ...rec, updatedAt: now };
          try {
            await kvPut(env, "tok:" + hash, rec);
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
// Handler: /api/rtdn (Pub/Sub push)
// ---------------------------------------------------------------------------

/**
 * Luôn trả 2xx (trừ sai khoá -> 401) để Pub/Sub không gửi lại vô hạn.
 */
export async function handleRtdn(request, env) {
  const key = new URL(request.url).searchParams.get("key") || "";
  if (!env.RTDN_KEY || !(await timingSafeEqual(key, env.RTDN_KEY))) {
    return json({ error: "unauthorized" }, 401);
  }
  try {
    const body = await readJson(request);
    const b64 = body && body.message && body.message.data;
    if (typeof b64 !== "string") return json({ ok: true, ignored: "no_data" });
    const note = JSON.parse(new TextDecoder().decode(bytesFromB64(b64)));

    if (note.packageName && env.PACKAGE_NAME && note.packageName !== env.PACKAGE_NAME)
      return json({ ok: true, ignored: "other_package" });
    if (note.testNotification) {
      log("info", "rtdn_test");
      return json({ ok: true, test: true });
    }

    const now = Date.now();
    const sn = note.subscriptionNotification;
    const vn = note.voidedPurchaseNotification;
    const token = (sn && sn.purchaseToken) || (vn && vn.purchaseToken);
    if (typeof token !== "string" || !token) return json({ ok: true, ignored: "no_token" });

    const hash = await sha256Hex(token);
    const prev = await kvGet(env, "tok:" + hash);
    if (!prev) {
      // Chưa có thiết bị nào xác minh token này; client sẽ gọi /api/verify (hoặc restore) sau.
      log("info", "rtdn_unknown_token", { tok: shortId(hash), type: sn && sn.notificationType });
      return json({ ok: true, ignored: "unknown_token" });
    }
    const base = { ...prev, tokenEnc: prev.tokenEnc || (await encryptToken(env, token)) };
    let rec = await refreshRecord(env, hash, token, base, now);
    if (vn) {
      // Giao dịch bị thu hồi/hoàn tiền -> mất quyền lợi ngay.
      rec = { ...stripInternal(rec), state: "REVOKED", expiryMs: now, updatedAt: now };
      await kvPut(env, "tok:" + hash, rec);
    }
    log("info", "rtdn_refreshed", { tok: shortId(hash), state: rec.state, type: sn ? sn.notificationType : "void" });
    return json({ ok: true, state: rec.state });
  } catch (e) {
    // Không trả lỗi cho Pub/Sub (tránh gửi lại vô hạn); chỉ ghi log.
    log("error", "rtdn_error", { err: String(e && e.message) });
    return json({ ok: true, error: "logged" });
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
    return json({ ok: true, service: "solpha-billing", time: new Date().toISOString() }, 200, cors);
  }
  if (path === "/api/rtdn") {
    if (method !== "POST") return json({ error: "method_not_allowed" }, 405);
    return handleRtdn(request, env);
  }

  if (path === "/api/verify" || path === "/api/entitlement") {
    const wantMethod = path === "/api/verify" ? "POST" : "GET";
    if (method !== wantMethod) return json({ error: "method_not_allowed" }, 405, cors);
    if (!originOk) return json({ error: "forbidden_origin" }, 403);
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
    const rl = rateLimit(path === "/api/verify" ? "verify" : "entitlement", ip);
    if (!rl.ok) {
      return json({ error: "rate_limited", message: "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút." }, 429, {
        ...cors,
        "retry-after": String(rl.retryAfter),
      });
    }
    return path === "/api/verify" ? handleVerify(request, env, cors) : handleEntitlement(request, env, cors);
  }

  return json({ error: "not_found" }, 404, cors);
}

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (e) {
      log("error", "unhandled", { err: String(e && e.message) });
      return json({ error: "internal", message: "Lỗi máy chủ. Vui lòng thử lại." }, 500);
    }
  },
};
