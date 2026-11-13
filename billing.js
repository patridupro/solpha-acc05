/* SOLPHA - thư viện thanh toán Google Play Billing cho PWA (TWA app.solpha.desk).
 * Script thường (không phải module). Gắn window.SolphaBilling.
 *
 * - Trong TWA, Chrome cung cấp Digital Goods API + Payment Request (https://play.google.com/billing).
 * - Backend (Cloudflare Worker solpha-billing) xác minh với Google, acknowledge và lưu quyền lợi.
 * - Định danh = deviceId ngẫu nhiên lưu localStorage; không thu thập thông tin cá nhân khác.
 * - Mọi hàm đều không ném lỗi ra ngoài khi API không có.
 */
(function () {
  "use strict";

  var root = typeof window !== "undefined" ? window : globalThis;

  // ĐỔI thành URL Worker sau khi `wrangler deploy` (xem worker/README.md).
  var API_BASE = "https://solpha-billing.<subdomain>.workers.dev";

  var BILLING_METHOD = "https://play.google.com/billing";
  var LS_ENT = "solpha_ent";
  var LS_DEVICE = "solpha_device";
  var SS_TWA = "solpha_twa";
  var CACHE_TTL_MS = 5 * 60 * 1000; // coi cache còn "tươi" trong 5 phút, không gọi mạng lại
  var OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000; // lỗi mạng: tin cache tối đa 72 giờ kể từ lần xác nhận thành công cuối
  var NET_TIMEOUT_MS = 12000;

  var config = {
    api: API_BASE,
    skus: ["solpha_pro_monthly", "solpha_pro_yearly"],
  };

  var MSG = {
    unavailable: "Mở bằng app trên Google Play để nâng cấp.",
    cancelled: "Bạn đã huỷ giao dịch.",
    error: "Không thực hiện được giao dịch. Vui lòng thử lại.",
    verifyFailed: "SOLPHA chưa xác nhận được giao dịch. Nếu bạn đã bị trừ tiền, hãy bấm \"Khôi phục giao dịch\".",
    badSku: "Gói không hợp lệ.",
    notConfigured: "Dịch vụ thanh toán chưa được cấu hình.",
    noPurchases: "Không tìm thấy giao dịch nào để khôi phục.",
  };

  var memStore = {}; // dự phòng khi localStorage không dùng được
  var servicePromise = null;

  // ---------------------------------------------------------------- tiện ích

  function now() {
    return Date.now();
  }

  function lsGet(key) {
    try {
      var v = root.localStorage.getItem(key);
      return v === null || v === undefined ? (memStore[key] === undefined ? null : memStore[key]) : v;
    } catch (e) {
      return memStore[key] === undefined ? null : memStore[key];
    }
  }
  function lsSet(key, val) {
    memStore[key] = val;
    try {
      root.localStorage.setItem(key, val);
    } catch (e) {
      /* bỏ qua */
    }
  }

  function uuid() {
    try {
      if (root.crypto && typeof root.crypto.randomUUID === "function") return root.crypto.randomUUID();
    } catch (e) {
      /* tiếp tục dự phòng */
    }
    var b = new Array(16);
    var i;
    try {
      var u8 = new Uint8Array(16);
      root.crypto.getRandomValues(u8);
      for (i = 0; i < 16; i++) b[i] = u8[i];
    } catch (e) {
      for (i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
    }
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = b.map(function (x) {
      return (x + 256).toString(16).slice(1);
    });
    return (
      h.slice(0, 4).join("") + "-" + h.slice(4, 6).join("") + "-" + h.slice(6, 8).join("") + "-" +
      h.slice(8, 10).join("") + "-" + h.slice(10, 16).join("")
    );
  }

  var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  function deviceId() {
    try {
      var id = lsGet(LS_DEVICE);
      if (!id || !UUID_RE.test(id)) {
        id = uuid();
        lsSet(LS_DEVICE, id);
      }
      return id;
    } catch (e) {
      return "00000000-0000-4000-8000-000000000000";
    }
  }

  function apiConfigured() {
    var a = config.api;
    return typeof a === "string" && /^https:\/\//.test(a) && a.indexOf("<") < 0 && a.indexOf("API_BASE") < 0;
  }

  function hasDigitalGoods() {
    return typeof root.getDigitalGoodsService === "function" && typeof root.PaymentRequest === "function";
  }

  function inTWA() {
    try {
      if (hasDigitalGoods()) return true;
      var ref = (root.document && root.document.referrer) || "";
      if (ref.indexOf("android-app://") === 0) {
        try {
          root.sessionStorage.setItem(SS_TWA, "1");
        } catch (e) {
          /* bỏ qua */
        }
        return true;
      }
      try {
        return root.sessionStorage.getItem(SS_TWA) === "1";
      } catch (e) {
        return false;
      }
    } catch (e) {
      return false;
    }
  }

  // ------------------------------------------------------------- cache quyền lợi

  function readCache() {
    try {
      var raw = lsGet(LS_ENT);
      if (!raw) return null;
      var c = JSON.parse(raw);
      if (!c || typeof c !== "object") return null;
      return {
        active: !!c.active,
        expiryMs: Number(c.expiryMs) || 0,
        sku: typeof c.sku === "string" ? c.sku : null,
        fetchedAt: Number(c.fetchedAt) || 0,
      };
    } catch (e) {
      return null;
    }
  }

  function writeCache(ent) {
    var c = {
      active: !!ent.active,
      expiryMs: Number(ent.expiryMs) || 0,
      sku: ent.sku || null,
      fetchedAt: now(),
    };
    lsSet(LS_ENT, JSON.stringify(c));
    return c;
  }

  /** Cache còn dùng được để quyết định Pro: đang active, chưa quá hạn gói, và lần xác nhận cuối không quá 72 giờ. */
  function cacheGrantsPro(c, t) {
    t = t === undefined ? now() : t;
    return !!(c && c.active && c.expiryMs > t && t - c.fetchedAt <= OFFLINE_GRACE_MS && c.fetchedAt <= t + 60000);
  }

  function isPro() {
    try {
      return cacheGrantsPro(readCache());
    } catch (e) {
      return false;
    }
  }

  function snapshot(source, extra) {
    var c = readCache();
    var d = {
      active: isPro(),
      expiryMs: c ? c.expiryMs : 0,
      sku: c && c.sku ? c.sku : null,
      source: source,
    };
    if (extra) for (var k in extra) d[k] = extra[k];
    return d;
  }

  function emit(detail) {
    try {
      var ev;
      if (typeof root.CustomEvent === "function") ev = new root.CustomEvent("solpha:entitlement", { detail: detail });
      else if (root.document && root.document.createEvent) {
        ev = root.document.createEvent("CustomEvent");
        ev.initCustomEvent("solpha:entitlement", false, false, detail);
      }
      if (ev && typeof root.dispatchEvent === "function") root.dispatchEvent(ev);
    } catch (e) {
      /* bỏ qua */
    }
  }

  /** Ghi cache từ phản hồi backend, phát sự kiện nếu có thay đổi. */
  function applyEntitlement(ent, source) {
    var hadCache = !!readCache();
    var before = snapshot("cache");
    writeCache(ent);
    var after = snapshot(source);
    if (before.active !== after.active || before.expiryMs !== after.expiryMs || before.sku !== after.sku || source !== "network" || !hadCache) {
      emit(after);
    }
    return after;
  }

  // ------------------------------------------------------------------ mạng

  function timedFetch(url, init) {
    return new Promise(function (resolve, reject) {
      var ctrl = typeof root.AbortController === "function" ? new root.AbortController() : null;
      var timer = setTimeout(function () {
        try {
          if (ctrl) ctrl.abort();
        } catch (e) {
          /* bỏ qua */
        }
        reject(new Error("timeout"));
      }, NET_TIMEOUT_MS);
      init = init || {};
      if (ctrl) init.signal = ctrl.signal;
      root.fetch(url, init).then(
        function (r) {
          clearTimeout(timer);
          resolve(r);
        },
        function (e) {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }

  /** POST /api/verify. Trả {ok:true, data} | {ok:false, network:bool, status, data}. */
  function verify(sku, purchaseToken) {
    if (!apiConfigured()) return Promise.resolve({ ok: false, network: false, status: 0, data: null });
    return timedFetch(config.api + "/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: deviceId(), sku: sku, purchaseToken: purchaseToken }),
    }).then(
      function (res) {
        return res
          .json()
          .catch(function () {
            return null;
          })
          .then(function (data) {
            return { ok: res.ok && !!data, network: false, status: res.status, data: data };
          });
      },
      function () {
        return { ok: false, network: true, status: 0, data: null };
      },
    );
  }

  // ----------------------------------------------------------- Digital Goods

  function getService() {
    if (!hasDigitalGoods()) return Promise.resolve(null);
    if (!servicePromise) {
      servicePromise = Promise.resolve()
        .then(function () {
          return root.getDigitalGoodsService(BILLING_METHOD);
        })
        .catch(function () {
          servicePromise = null;
          return null;
        });
    }
    return servicePromise;
  }

  function formatPrice(p) {
    try {
      if (!p || p.value === undefined) return "";
      return new Intl.NumberFormat("vi-VN", { style: "currency", currency: p.currency }).format(Number(p.value));
    } catch (e) {
      return p && p.value !== undefined ? String(p.value) + " " + (p.currency || "") : "";
    }
  }

  /** [{sku,title,price,currency,value}] hoặc null nếu không khả dụng. */
  function getPrices() {
    return getService()
      .then(function (svc) {
        if (!svc) return null;
        return svc.getDetails(config.skus).then(function (items) {
          if (!items || !items.length) return null;
          return items.map(function (it) {
            return {
              sku: it.itemId,
              title: it.title || "",
              price: formatPrice(it.price),
              currency: it.price && it.price.currency,
              value: it.price && it.price.value,
            };
          });
        });
      })
      .catch(function () {
        return null;
      });
  }

  function fail(status, message, extra) {
    var r = { ok: false, status: status, message: message };
    if (extra) for (var k in extra) r[k] = extra[k];
    return r;
  }

  /** Mua một gói. Luôn resolve, không reject. */
  function purchase(sku) {
    return Promise.resolve()
      .then(function () {
        if (config.skus.indexOf(sku) < 0) return fail("bad_sku", MSG.badSku);
        if (!inTWA() || !hasDigitalGoods()) return fail("unavailable", MSG.unavailable);
        if (!apiConfigured()) return fail("not_configured", MSG.notConfigured);

        var request;
        try {
          request = new root.PaymentRequest(
            [{ supportedMethods: BILLING_METHOD, data: { sku: sku } }],
            { total: { label: "SOLPHA Pro", amount: { currency: "VND", value: "0" } } },
          );
        } catch (e) {
          return fail("unavailable", MSG.unavailable);
        }

        return Promise.resolve()
          .then(function () {
            return typeof request.canMakePayment === "function" ? request.canMakePayment() : true;
          })
          .catch(function () {
            return true;
          })
          .then(function (can) {
            if (can === false) return fail("unavailable", MSG.unavailable);
            return request.show().then(
              function (response) {
                var token = response && response.details && response.details.purchaseToken;
                if (!token) {
                  return completeSafe(response, "fail").then(function () {
                    return fail("error", MSG.error);
                  });
                }
                return verify(sku, token).then(function (v) {
                  if (v.ok && v.data && v.data.active) {
                    // Chỉ báo "success" cho Play SAU KHI backend xác nhận.
                    return completeSafe(response, "success").then(function () {
                      var ent = applyEntitlement(v.data, "purchase");
                      return { ok: true, status: "success", entitlement: ent };
                    });
                  }
                  return completeSafe(response, "fail").then(function () {
                    return fail("verify_failed", MSG.verifyFailed, { network: !!v.network });
                  });
                });
              },
              function (err) {
                var n = err && err.name;
                if (n === "AbortError" || n === "NotAllowedError") return fail("cancelled", MSG.cancelled);
                if (n === "NotSupportedError") return fail("unavailable", MSG.unavailable);
                return fail("error", MSG.error);
              },
            );
          });
      })
      .catch(function () {
        return fail("error", MSG.error);
      });
  }

  function completeSafe(response, result) {
    try {
      return Promise.resolve(response.complete(result)).catch(function () {});
    } catch (e) {
      return Promise.resolve();
    }
  }

  // ----------------------------------------------------------------- refresh

  var inflightRefresh = null;

  /** Làm mới quyền lợi từ backend. opts.force bỏ qua cache 5 phút. Luôn resolve. */
  function refresh(opts) {
    var force = !!(opts && opts.force);
    try {
      var c = readCache();
      if (!force && c && now() - c.fetchedAt >= 0 && now() - c.fetchedAt < CACHE_TTL_MS) {
        return Promise.resolve(snapshot("cache"));
      }
      if (!apiConfigured()) return Promise.resolve(snapshot("cache", { stale: true }));
      if (inflightRefresh) return inflightRefresh;
      inflightRefresh = timedFetch(config.api + "/api/entitlement?deviceId=" + encodeURIComponent(deviceId()), {
        method: "GET",
        headers: { accept: "application/json" },
      })
        .then(function (res) {
          if (!res.ok) throw new Error("http_" + res.status);
          return res.json();
        })
        .then(function (data) {
          if (!data || typeof data.active !== "boolean") throw new Error("bad_response");
          return applyEntitlement(data, "network");
        })
        .catch(function () {
          // Lỗi mạng/máy chủ: dùng cache (còn hạn tới 72 giờ), không ném lỗi.
          return snapshot("cache", { stale: true });
        })
        .then(function (r) {
          inflightRefresh = null;
          return r;
        });
      return inflightRefresh;
    } catch (e) {
      inflightRefresh = null;
      return Promise.resolve(snapshot("cache", { stale: true }));
    }
  }

  // ----------------------------------------------------------------- restore

  /** Liệt kê giao dịch trên Play và xác minh lại từng cái. Luôn resolve. */
  function restore() {
    return getService()
      .then(function (svc) {
        if (!svc) return fail("unavailable", MSG.unavailable);
        if (!apiConfigured()) return fail("not_configured", MSG.notConfigured);
        return svc.listPurchases().then(function (list) {
          list = (list || []).filter(function (p) {
            return p && p.purchaseToken && config.skus.indexOf(p.itemId) >= 0;
          });
          if (!list.length) return fail("none", MSG.noPurchases, { restored: 0 });
          var best = null;
          var anyNetworkFail = false;
          return list
            .reduce(function (chain, p) {
              return chain.then(function () {
                return verify(p.itemId, p.purchaseToken).then(function (v) {
                  if (v.ok && v.data) {
                    if (v.data.active && (!best || v.data.expiryMs > best.expiryMs)) best = v.data;
                  } else if (v.network) {
                    anyNetworkFail = true;
                  }
                });
              });
            }, Promise.resolve())
            .then(function () {
              if (best) {
                var ent = applyEntitlement(best, "restore");
                return { ok: true, status: "success", restored: list.length, entitlement: ent };
              }
              if (anyNetworkFail) return fail("verify_failed", MSG.verifyFailed, { network: true });
              // Có giao dịch nhưng không còn hiệu lực: đồng bộ lại trạng thái từ backend.
              return refresh({ force: true }).then(function (ent) {
                return { ok: true, status: "inactive", restored: list.length, entitlement: ent };
              });
            });
        });
      })
      .catch(function () {
        return fail("error", MSG.error);
      });
  }

  root.SolphaBilling = {
    config: config,
    inTWA: inTWA,
    deviceId: deviceId,
    getPrices: getPrices,
    purchase: purchase,
    refresh: refresh,
    restore: restore,
    isPro: isPro,
    messages: MSG,
    // Hàm thuần, dùng cho kiểm thử
    _internal: {
      readCache: readCache,
      writeCache: writeCache,
      cacheGrantsPro: cacheGrantsPro,
      OFFLINE_GRACE_MS: OFFLINE_GRACE_MS,
      CACHE_TTL_MS: CACHE_TTL_MS,
    },
  };
})();
