/* SOLPHA - thư viện thanh toán Google Play Billing cho PWA (TWA app.solpha.desk).
 * Script thường (không phải module). Gắn window.SolphaBilling.
 *
 * - Trong TWA, Chrome cung cấp Digital Goods API + Payment Request (https://play.google.com/billing).
 * - Backend (Cloudflare Worker solpha-billing) xác minh với Google, acknowledge và lưu quyền lợi.
 * - Định danh = deviceId ngẫu nhiên lưu localStorage; không thu thập thông tin cá nhân khác.
 * - Giao dịch đã được Google tính tiền nhưng backend chưa xác minh được: token được GIỮ trong localStorage
 *   (tối đa 5 token, 3 ngày) và tự thử lại khi mở app / khi mạng về / định kỳ, cho tới khi /api/verify thành công.
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
  var LS_PENDING = "solpha_pending"; // token đã trả tiền, chờ backend xác minh
  var SS_TWA = "solpha_twa";
  var CACHE_TTL_MS = 5 * 60 * 1000; // coi cache còn "tươi" trong 5 phút, không gọi mạng lại
  var OFFLINE_GRACE_MS = 72 * 60 * 60 * 1000; // lỗi mạng: tin cache tối đa 72 giờ kể từ lần xác nhận thành công cuối
  var NET_TIMEOUT_MS = 12000;
  var PENDING_MAX = 5; // tối đa 5 token chờ
  var PENDING_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 ngày (Google tự hoàn tiền nếu không acknowledge trong 3 ngày)
  var RETRY_MIN_MS = 60 * 1000;
  var RETRY_MAX_MS = 15 * 60 * 1000;

  var config = {
    api: API_BASE,
    skus: ["solpha_pro_monthly", "solpha_pro_yearly"],
    // CHƯA XÁC NHẬN trên thiết bị thật: có truyền obfuscatedAccountId = sha256(deviceId) trong PaymentRequest hay không.
    // Mặc định TẮT. Bật chỉ sau khi thử trên TWA cài từ Google Play (xem worker/README.md, mục F4).
    bindAccount: false,
  };

  var MSG = {
    unavailable: "Mở bằng app trên Google Play để nâng cấp.",
    cancelled: "Bạn đã huỷ giao dịch.",
    error: "Không thực hiện được giao dịch. Vui lòng thử lại.",
    verifyFailed: "SOLPHA chưa xác nhận được giao dịch. Nếu bạn đã bị trừ tiền, hãy thử \"Khôi phục giao dịch\" sau ít phút.",
    pending: "Đang xác minh giao dịch của bạn. Quyền lợi sẽ tự kích hoạt khi xác minh xong, bạn không cần mua lại.",
    badSku: "Gói không hợp lệ.",
    notConfigured: "Dịch vụ thanh toán chưa được cấu hình.",
    noPurchases: "Không tìm thấy giao dịch nào để khôi phục.",
  };

  var memStore = {}; // dự phòng khi localStorage không dùng được
  var servicePromise = null;
  var fallbackDeviceId = null; // chỉ dùng khi không thể tạo/lưu UUID (không bao giờ là hằng số công khai)

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
      if (!fallbackDeviceId) fallbackDeviceId = uuid();
      return fallbackDeviceId;
    }
  }

  /** sha256(deviceId) dạng hex, dùng làm obfuscatedAccountId (chỉ khi config.bindAccount). Resolve null nếu tắt/không hỗ trợ. */
  function accountId() {
    try {
      if (!config.bindAccount || !root.crypto || !root.crypto.subtle) return Promise.resolve(null);
      var bytes = new TextEncoder().encode(deviceId());
      return root.crypto.subtle.digest("SHA-256", bytes).then(
        function (buf) {
          return Array.prototype.map
            .call(new Uint8Array(buf), function (b) {
              return (b + 256).toString(16).slice(1);
            })
            .join("");
        },
        function () {
          return null;
        },
      );
    } catch (e) {
      return Promise.resolve(null);
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
      pending: readPending().length > 0, // có giao dịch đã trả tiền đang chờ xác minh ("đang xác minh")
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

  // ------------------------------------------------- giao dịch chờ xác minh (F3)

  function readPending() {
    try {
      var raw = lsGet(LS_PENDING);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return [];
      var t = now();
      return arr
        .filter(function (p) {
          return p && typeof p.token === "string" && typeof p.sku === "string" && Number(p.at) > 0 && t - Number(p.at) <= PENDING_TTL_MS;
        })
        .slice(-PENDING_MAX);
    } catch (e) {
      return [];
    }
  }
  function writePending(list) {
    try {
      lsSet(LS_PENDING, JSON.stringify(list.slice(-PENDING_MAX)));
    } catch (e) {
      /* bỏ qua */
    }
  }
  function addPending(sku, token) {
    var list = readPending().filter(function (p) {
      return p.token !== token;
    });
    list.push({ sku: sku, token: token, at: now() });
    writePending(list);
  }
  function removePending(token) {
    writePending(
      readPending().filter(function (p) {
        return p.token !== token;
      }),
    );
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

  /** POST /api/verify. Trả {ok, network, transient, status, data}. transient = lỗi tạm thời (5xx/429): nên thử lại, KHÔNG phải "không có giao dịch". */
  function verify(sku, purchaseToken) {
    if (!apiConfigured()) return Promise.resolve({ ok: false, network: false, transient: false, status: 0, data: null });
    return accountId().then(function (acct) {
      var body = { deviceId: deviceId(), sku: sku, purchaseToken: purchaseToken };
      if (acct) body.obfuscatedExternalAccountId = acct;
      return timedFetch(config.api + "/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }).then(
        function (res) {
          return res
            .json()
            .catch(function () {
              return null;
            })
            .then(function (data) {
              return {
                ok: res.ok && !!data,
                network: false,
                transient: res.status >= 500 || res.status === 429,
                status: res.status,
                data: data,
              };
            });
        },
        function () {
          return { ok: false, network: true, transient: true, status: 0, data: null };
        },
      );
    });
  }

  /** "active" (đã có quyền) | "wait" (Google báo PENDING: giữ token) | "retry" (lỗi tạm thời) | "drop" (bị từ chối hẳn / không còn hiệu lực). */
  function classify(v) {
    if (v.ok && v.data) {
      if (v.data.active) return "active";
      return v.data.state === "PENDING" ? "wait" : "drop";
    }
    if (v.network || v.transient) return "retry";
    return "drop";
  }

  var retryTimer = null;
  var retryDelay = RETRY_MIN_MS;
  var retrying = null;

  function scheduleRetry(reset) {
    try {
      if (reset) retryDelay = RETRY_MIN_MS;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (typeof root.setTimeout !== "function" || !readPending().length) return;
      retryTimer = root.setTimeout(function () {
        retryTimer = null;
        retryPending();
      }, retryDelay);
      if (retryTimer && typeof retryTimer.unref === "function") retryTimer.unref(); // Node (kiểm thử): không giữ tiến trình
      retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
    } catch (e) {
      /* bỏ qua */
    }
  }

  /** Thử xác minh lại các token đã trả tiền nhưng chưa xác minh được. Luôn resolve. */
  function retryPending() {
    try {
      if (retrying) return retrying;
      var list = readPending();
      if (!list.length || !apiConfigured()) return Promise.resolve({ pending: list.length, active: isPro() });
      retrying = list
        .reduce(function (chain, p) {
          return chain.then(function () {
            return verify(p.sku, p.token).then(function (v) {
              var c = classify(v);
              if (c === "active") {
                removePending(p.token);
                applyEntitlement(v.data, "retry");
              } else if (c === "drop") {
                removePending(p.token);
              } /* "retry" | "wait": giữ lại */
            });
          });
        }, Promise.resolve())
        .catch(function () {})
        .then(function () {
          retrying = null;
          var left = readPending().length;
          if (left) scheduleRetry(false);
          else emit(snapshot("retry"));
          return { pending: left, active: isPro() };
        });
      return retrying;
    } catch (e) {
      retrying = null;
      return Promise.resolve({ pending: 0, active: false });
    }
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

        return accountId().then(function (acct) {
          var request;
          try {
            var data = { sku: sku };
            if (acct) data.obfuscatedAccountId = acct;
            request = new root.PaymentRequest(
              [{ supportedMethods: BILLING_METHOD, data: data }],
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
                  // Google đã/đang tính tiền: LƯU token TRƯỚC khi gọi backend để không bao giờ mất (F3).
                  addPending(sku, token);
                  return verify(sku, token).then(function (v) {
                    var c = classify(v);
                    if (c === "active") {
                      removePending(token);
                      // Chỉ báo "success" cho Play SAU KHI backend xác nhận.
                      return completeSafe(response, "success").then(function () {
                        var ent = applyEntitlement(v.data, "purchase");
                        return { ok: true, status: "success", entitlement: ent };
                      });
                    }
                    if (c === "retry") {
                      // Backend tạm lỗi sau khi Google đã tính tiền: KHÔNG báo "fail" (sẽ bị coi như giao dịch thất bại);
                      // giữ token, tự thử lại, hiện "đang xác minh". Server cũng tự acknowledge qua RTDN.
                      scheduleRetry(true);
                      return completeSafe(response, "success").then(function () {
                        emit(snapshot("purchase", { pending: true }));
                        return fail("pending_verification", MSG.pending, { network: !!v.network, pending: true });
                      });
                    }
                    if (c === "drop") removePending(token);
                    else scheduleRetry(true); // "wait": thanh toán đang chờ xử lý, giữ token
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
      if (readPending().length) retryPending(); // nền: không chặn refresh
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
          var anyTransient = false;
          return list
            .reduce(function (chain, p) {
              return chain.then(function () {
                return verify(p.itemId, p.purchaseToken).then(function (v) {
                  var c = classify(v);
                  if (c === "active") {
                    if (!best || v.data.expiryMs > best.expiryMs) best = v.data;
                    removePending(p.purchaseToken);
                  } else if (c === "retry") {
                    // F11: lỗi mạng/5xx/429 KHÔNG có nghĩa là "không có giao dịch hiệu lực".
                    if (v.network) anyNetworkFail = true;
                    anyTransient = true;
                    addPending(p.itemId, p.purchaseToken);
                  } else if (c === "wait") {
                    addPending(p.itemId, p.purchaseToken);
                  } else {
                    removePending(p.purchaseToken);
                  }
                });
              });
            }, Promise.resolve())
            .then(function () {
              if (best) {
                var ent = applyEntitlement(best, "restore");
                return { ok: true, status: "success", restored: list.length, entitlement: ent };
              }
              if (anyTransient) {
                scheduleRetry(true);
                return fail("verify_failed", MSG.pending, { network: anyNetworkFail, transient: true, pending: true });
              }
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

  // ---------------------------------------------------------- xoá dữ liệu (F10)

  /** Yêu cầu máy chủ xoá dữ liệu của thiết bị này, rồi xoá cache cục bộ và sinh deviceId mới. Luôn resolve. */
  function deleteData() {
    if (!apiConfigured()) return Promise.resolve(fail("not_configured", MSG.notConfigured));
    var id = deviceId();
    return timedFetch(config.api + "/api/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: id, proof: id }),
    }).then(
      function (res) {
        if (!res.ok) return fail("delete_failed", MSG.error, { httpStatus: res.status });
        lsSet(LS_ENT, "");
        lsSet(LS_PENDING, "[]");
        lsSet(LS_DEVICE, uuid());
        return { ok: true, status: "deleted" };
      },
      function () {
        return fail("delete_failed", MSG.error, { network: true });
      },
    );
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
    pending: function () {
      return readPending().length;
    },
    retryPending: retryPending,
    deleteData: deleteData,
    messages: MSG,
    // Hàm thuần, dùng cho kiểm thử
    _internal: {
      readCache: readCache,
      writeCache: writeCache,
      cacheGrantsPro: cacheGrantsPro,
      OFFLINE_GRACE_MS: OFFLINE_GRACE_MS,
      CACHE_TTL_MS: CACHE_TTL_MS,
      readPending: readPending,
    },
  };

  // Tự thử lại giao dịch chờ xác minh: khi mở app, khi mạng về, khi quay lại tab, và định kỳ (backoff 1 -> 15 phút).
  try {
    if (typeof root.addEventListener === "function") {
      root.addEventListener("online", function () {
        retryDelay = RETRY_MIN_MS;
        retryPending();
      });
    }
    if (root.document && typeof root.document.addEventListener === "function") {
      root.document.addEventListener("visibilitychange", function () {
        if (root.document.visibilityState === "visible") retryPending();
      });
    }
    if (readPending().length) retryPending();
  } catch (e) {
    /* bỏ qua */
  }
})();
