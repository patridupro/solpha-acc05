// Kiểm thử billing.js (script thường) trong Node bằng window/localStorage giả tối thiểu.
import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../billing.js"), "utf8");
const H = 3600_000;
const API = "https://solpha-billing.test.workers.dev";

function makeEnv(extra = {}) {
  const store = new Map();
  const events = [];
  const win = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => void store.set(k, String(v)),
    },
    sessionStorage: { getItem: () => null, setItem() {} },
    document: { referrer: "" },
    crypto: globalThis.crypto,
    Intl,
    JSON,
    Promise,
    Date,
    console,
    setTimeout,
    clearTimeout,
    AbortController,
    encodeURIComponent,
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    },
    dispatchEvent(ev) {
      events.push(ev);
      return true;
    },
    fetch: async () => {
      throw new Error("offline");
    },
    ...extra,
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(src, win);
  win.SolphaBilling.config.api = API;
  return { win, B: win.SolphaBilling, store, events };
}
const seed = (store, o) => store.set("solpha_ent", JSON.stringify(o));
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

test("deviceId: tạo UUID, lưu và ổn định", () => {
  const { B, store } = makeEnv();
  const id = B.deviceId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(B.deviceId(), id);
  assert.equal(store.get("solpha_device"), id);
});

test("deviceId: localStorage hỏng vẫn không ném lỗi", () => {
  const { B } = makeEnv({
    localStorage: {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("blocked");
      },
    },
  });
  const id = B.deviceId();
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.equal(B.deviceId(), id);
  assert.equal(B.isPro(), false);
});

test("isPro: chưa có cache -> false; cache active còn hạn -> true", () => {
  const { B, store } = makeEnv();
  assert.equal(B.isPro(), false);
  seed(store, { active: true, expiryMs: Date.now() + 10 * H, sku: "solpha_pro_monthly", fetchedAt: Date.now() - H });
  assert.equal(B.isPro(), true);
});

test("isPro: gói đã hết hạn hoặc active=false -> false", () => {
  const { B, store } = makeEnv();
  seed(store, { active: true, expiryMs: Date.now() - 1000, fetchedAt: Date.now() - 1000 });
  assert.equal(B.isPro(), false);
  seed(store, { active: false, expiryMs: Date.now() + 10 * H, fetchedAt: Date.now() });
  assert.equal(B.isPro(), false);
});

test("isPro: ngưỡng ngoại tuyến 72 giờ", () => {
  const { B, store } = makeEnv();
  const future = Date.now() + 100 * 24 * H;
  seed(store, { active: true, expiryMs: future, fetchedAt: Date.now() - 71 * H });
  assert.equal(B.isPro(), true);
  seed(store, { active: true, expiryMs: future, fetchedAt: Date.now() - 73 * H });
  assert.equal(B.isPro(), false);
});

test("isPro: cache hỏng không ném lỗi", () => {
  const { B, store } = makeEnv();
  store.set("solpha_ent", "{không phải json");
  assert.equal(B.isPro(), false);
});

test("refresh: dùng cache trong 5 phút, không gọi mạng", async () => {
  let calls = 0;
  const { B, store } = makeEnv({
    fetch: async () => {
      calls++;
      return json({ active: false, expiryMs: 0, sku: null });
    },
  });
  seed(store, { active: true, expiryMs: Date.now() + 5 * H, sku: "s", fetchedAt: Date.now() - 60_000 });
  const r = await B.refresh();
  assert.equal(calls, 0);
  assert.equal(r.active, true);
  assert.equal(r.source, "cache");
});

test("refresh: cache cũ -> gọi /api/entitlement, ghi cache và phát sự kiện", async () => {
  let url;
  const exp = Date.now() + 20 * H;
  const { B, store, events } = makeEnv({
    fetch: async (u) => {
      url = u;
      return json({ active: true, expiryMs: exp, sku: "solpha_pro_yearly" });
    },
  });
  seed(store, { active: false, expiryMs: 0, sku: null, fetchedAt: Date.now() - 10 * 60_000 });
  const r = await B.refresh();
  assert.match(url, new RegExp("^" + API + "/api/entitlement\\?deviceId=[0-9a-f-]{36}$"));
  assert.equal(r.active, true);
  assert.equal(r.source, "network");
  assert.equal(B.isPro(), true);
  assert.equal(JSON.parse(store.get("solpha_ent")).sku, "solpha_pro_yearly");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "solpha:entitlement");
  assert.equal(events[0].detail.active, true);
});

test("refresh: lỗi mạng -> dùng cache còn hạn tới 72 giờ, quá thì mất Pro; không ném lỗi", async () => {
  const future = Date.now() + 30 * 24 * H;
  const a = makeEnv();
  seed(a.store, { active: true, expiryMs: future, sku: "s", fetchedAt: Date.now() - 48 * H });
  const r1 = await a.B.refresh();
  assert.equal(r1.active, true);
  assert.equal(r1.stale, true);

  const b = makeEnv();
  seed(b.store, { active: true, expiryMs: future, sku: "s", fetchedAt: Date.now() - 80 * H });
  const r2 = await b.B.refresh();
  assert.equal(r2.active, false);
  assert.equal(r2.stale, true);
});

test("refresh: máy chủ trả 500 hoặc dữ liệu sai -> giữ cache, không ném lỗi", async () => {
  const { B, store } = makeEnv({ fetch: async () => json({ error: "x" }, 500) });
  seed(store, { active: true, expiryMs: Date.now() + H, sku: "s", fetchedAt: Date.now() - 10 * 60_000 });
  assert.equal((await B.refresh()).active, true);
  const m = makeEnv({ fetch: async () => json({ foo: 1 }) });
  seed(m.store, { active: true, expiryMs: Date.now() + H, sku: "s", fetchedAt: Date.now() - 10 * 60_000 });
  assert.equal((await m.B.refresh({ force: true })).active, true);
});

test("refresh: API chưa cấu hình (placeholder) -> không gọi mạng", async () => {
  let calls = 0;
  const { B, win } = makeEnv({ fetch: async () => (calls++, json({})) });
  win.SolphaBilling.config.api = "https://solpha-billing.<subdomain>.workers.dev";
  const r = await B.refresh({ force: true });
  assert.equal(calls, 0);
  assert.equal(r.active, false);
});

test("inTWA / getPrices / purchase khi không có Digital Goods", async () => {
  const { B } = makeEnv();
  assert.equal(B.inTWA(), false);
  assert.equal(await B.getPrices(), null);
  const r = await B.purchase("solpha_pro_monthly");
  assert.equal(r.ok, false);
  assert.equal(r.status, "unavailable");
  assert.match(r.message, /Google Play/);
  assert.equal((await B.purchase("khong-co")).status, "bad_sku");
  const rs = await B.restore();
  assert.equal(rs.ok, false);
});

test("inTWA nhận biết qua referrer android-app://", () => {
  const { B } = makeEnv({ document: { referrer: "android-app://app.solpha.desk" } });
  assert.equal(B.inTWA(), true);
});

function twaEnv(opts) {
  const state = { verifyBody: null, completed: null, purchases: opts.purchases || [] };
  const env = makeEnv({
    getDigitalGoodsService: async () => ({
      getDetails: async (skus) =>
        skus.map((s) => ({ itemId: s, title: "SOLPHA Pro " + s, price: { currency: "VND", value: "49000" } })),
      listPurchases: async () => state.purchases,
    }),
    PaymentRequest: class {
      constructor(methods, details) {
        state.methods = methods;
        state.details = details;
      }
      async canMakePayment() {
        return true;
      }
      async show() {
        if (opts.showError) throw Object.assign(new Error("x"), { name: opts.showError });
        return {
          details: { purchaseToken: "PTOKEN-1234567890" },
          complete: async (r) => void (state.completed = r),
        };
      }
    },
    fetch: async (u, init) => {
      if (u.endsWith("/api/verify")) {
        const body = JSON.parse(init.body);
        (state.verifies ||= []).push(body);
        state.verifyBody = body;
        if (opts.verifyNetworkFail) throw new Error("offline");
        return json(opts.verifyReply || { active: true, expiryMs: Date.now() + 30 * 24 * H, sku: body.sku, state: "ACTIVE" });
      }
      return json({ active: false, expiryMs: 0, sku: null });
    },
  });
  return { ...env, state };
}

test("getPrices qua Digital Goods", async () => {
  const { B } = twaEnv({});
  assert.equal(B.inTWA(), true);
  const p = await B.getPrices();
  assert.equal(p.length, 2);
  assert.equal(p[0].sku, "solpha_pro_monthly");
  assert.match(p[0].price, /49\.000/);
});

test("purchase thành công: verify rồi mới complete('success'), cập nhật cache và phát sự kiện", async () => {
  const { B, state, events } = twaEnv({});
  const r = await B.purchase("solpha_pro_monthly");
  assert.equal(r.ok, true);
  assert.equal(state.methods[0].supportedMethods, "https://play.google.com/billing");
  assert.equal(JSON.stringify(state.methods[0].data), JSON.stringify({ sku: "solpha_pro_monthly" }));
  assert.equal(state.verifyBody.purchaseToken, "PTOKEN-1234567890");
  assert.equal(state.verifyBody.sku, "solpha_pro_monthly");
  assert.equal(state.completed, "success");
  assert.equal(B.isPro(), true);
  assert.ok(events.some((e) => e.detail.active === true && e.detail.source === "purchase"));
});

test("purchase: backend từ chối hoặc lỗi mạng -> complete('fail'), không cấp Pro", async () => {
  const a = twaEnv({ verifyReply: { active: false, state: "EXPIRED", expiryMs: 0, sku: null } });
  const r1 = await a.B.purchase("solpha_pro_monthly");
  assert.equal(r1.ok, false);
  assert.equal(r1.status, "verify_failed");
  assert.equal(a.state.completed, "fail");
  assert.equal(a.B.isPro(), false);

  const b = twaEnv({ verifyNetworkFail: true });
  const r2 = await b.B.purchase("solpha_pro_yearly");
  assert.equal(r2.status, "verify_failed");
  assert.equal(r2.network, true);
  assert.equal(b.state.completed, "fail");
});

test("purchase: người dùng huỷ -> status cancelled", async () => {
  const { B } = twaEnv({ showError: "AbortError" });
  const r = await B.purchase("solpha_pro_monthly");
  assert.equal(r.ok, false);
  assert.equal(r.status, "cancelled");
  assert.equal((await twaEnv({ showError: "SomethingElse" }).B.purchase("solpha_pro_monthly")).status, "error");
});

test("restore: verify lại từng giao dịch và cấp gói có hạn xa nhất", async () => {
  const { B, state } = twaEnv({
    purchases: [
      { itemId: "solpha_pro_monthly", purchaseToken: "TOKEN-A-1234567890" },
      { itemId: "solpha_pro_yearly", purchaseToken: "TOKEN-B-1234567890" },
      { itemId: "khac", purchaseToken: "TOKEN-C-1234567890" },
    ],
  });
  const r = await B.restore();
  assert.equal(r.ok, true);
  assert.equal(r.restored, 2);
  assert.equal(state.verifies.length, 2);
  assert.equal(B.isPro(), true);
  const none = await twaEnv({ purchases: [] }).B.restore();
  assert.equal(none.ok, false);
  assert.equal(none.status, "none");
});
