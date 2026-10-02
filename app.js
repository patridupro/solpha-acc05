const TFS = [
  { key: "5m", label: "5M", binance: "5m", rank: 0 },
  { key: "15m", label: "15M", binance: "15m", rank: 1 },
  { key: "1h", label: "1H", binance: "1h", rank: 2 },
  { key: "4h", label: "4H", binance: "4h", rank: 3 },
  { key: "1d", label: "1D", binance: "1d", rank: 4 }
];
const ENDPOINTS = ["https://fapi.binance.com", "https://fapi1.binance.com", "https://api.binance.com"];
const TRIGGER = { minRange: 0.55, closeZone: 0.25, tfs: ["5m", "15m"], rejectLookback: 3 };
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
};
let lastAlertKey = store.get("solpha_last_alert", "");
let lastTriggerKey = store.get("solpha_last_trigger", "");
let deferredPrompt = null;
let priceTimer = null;
let hourTimer = null;
const $ = (id) => document.getElementById(id);
function ema(values, period) {
  if (values.length < period) return null;
  const k = 2 / (period + 1);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) e = values[i] * k + e * (1 - k);
  return e;
}
function rsi(values, period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d; else losses -= d;
  }
  let avgG = gains / period, avgL = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (avgL === 0) return 100;
  return 100 - 100 / (1 + avgG / avgL);
}
function bollinger(values, period = 20, mult = 2) {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  const mid = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mid + mult * sd;
  const lower = mid - mult * sd;
  const close = values[values.length - 1];
  const pctB = upper === lower ? 0.5 : (close - lower) / (upper - lower);
  return { upper, mid, lower, pctB };
}
function fmt(n, d = 2) {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toFixed(d);
}
function nowVN() {
  return new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
async function fetchJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(res.status + " " + url);
  return res.json();
}
async function withBase(pathSpot, pathFutures) {
  const errors = [];
  for (const base of ENDPOINTS) {
    const futures = base.includes("fapi");
    const path = futures ? pathFutures : pathSpot;
    try {
      const data = await fetchJSON(base + path);
      return { data, source: futures ? "Binance Futures" : "Binance Spot" };
    } catch (e) { errors.push(String(e.message || e)); }
  }
  throw new Error(errors.join(" | "));
}
async function loadTicker() {
  try {
    const { data, source } = await withBase("/api/v3/ticker/24hr?symbol=SOLUSDT", "/fapi/v1/ticker/24hr?symbol=SOLUSDT");
    $("lastPrice").textContent = "$" + fmt(data.lastPrice);
    $("markPrice").textContent = "$" + fmt(data.lastPrice);
    const chg = Number(data.priceChangePercent);
    $("chg24").textContent = `24h ${chg >= 0 ? "+" : ""}${fmt(chg)}%`;
    $("chg24").className = "chg " + (chg >= 0 ? "up" : "down");
    $("high24").textContent = "$" + fmt(data.highPrice);
    $("low24").textContent = "$" + fmt(data.lowPrice);
    $("source").textContent = source;
  } catch (e) {
    $("source").textContent = "Lỗi API";
    console.error(e);
  }
  try {
    const { data } = await withBase("/fapi/v1/premiumIndex?symbol=SOLUSDT", "/fapi/v1/premiumIndex?symbol=SOLUSDT");
    if (data && data.markPrice) $("markPrice").textContent = "$" + fmt(data.markPrice);
    if (data && data.lastFundingRate != null) $("funding").textContent = (Number(data.lastFundingRate) * 100).toFixed(4) + "%";
  } catch (_) {}
}
async function loadKlines(interval) {
  const { data } = await withBase(`/api/v3/klines?symbol=SOLUSDT&interval=${interval}&limit=120`, `/fapi/v1/klines?symbol=SOLUSDT&interval=${interval}&limit=120`);
  return data.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
}
function analyze(candles) {
  const closes = candles.map((c) => c.c);
  const last = closes[closes.length - 1];
  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const r = rsi(closes, 14);
  const bb = bollinger(closes, 20, 2);
  let dir = "sideway";
  if (e9 != null && e21 != null) {
    if (e9 > e21 && last >= e9) dir = "tang";
    else if (e9 < e21 && last <= e9) dir = "giam";
    else if (e9 > e21) dir = "tang";
    else if (e9 < e21) dir = "giam";
  }
  let band = "in";
  if (bb) {
    if (bb.pctB >= 0.95 || last >= bb.upper) band = "upper";
    else if (bb.pctB <= 0.05 || last <= bb.lower) band = "lower";
  }
  return { last, e9, e21, rsi: r, bb, dir, band, candles };
}
// Nến tín hiệu: xét nến ĐÃ ĐÓNG gần nhất (bỏ nến đang chạy) trên 5M và 15M.
function candleTrigger(map, align) {
  const htfUp = align.d1 === "tang" && align.h4 === "tang" && align.h1 === "tang";
  const htfDown = align.d1 === "giam" && align.h4 === "giam" && align.h1 === "giam";
  const htfAtUpper = ["1h", "4h", "1d"].filter((k) => map[k].band === "upper");
  const touchedUpper = (candles, lookback) => {
    const closes = candles.map((c) => c.c);
    for (let i = candles.length - 2; i >= Math.max(20, candles.length - 1 - lookback); i--) {
      const bb = bollinger(closes.slice(0, i + 1), 20, 2);
      if (bb && candles[i].h >= bb.upper) return true;
    }
    return false;
  };
  const h1Rejected = touchedUpper(map["1h"].candles, 2);
  return TRIGGER.tfs.map((key) => {
    const candles = map[key].candles;
    const k = candles[candles.length - 2];
    const range = k.h - k.l;
    const pos = range > 0 ? (k.c - k.l) / range : 0.5;
    const big = range >= TRIGGER.minRange;
    const closeTop = pos >= 1 - TRIGGER.closeZone;
    const closeBottom = pos <= TRIGGER.closeZone;
    // Chase chỉ xét khung lớn: nến long mạnh tự chạm BB trên của khung nhỏ vẫn được giữ.
    const chasing = htfAtUpper.length > 0;
    const rejected = touchedUpper(candles, TRIGGER.rejectLookback) || h1Rejected;
    const long = big && closeTop && htfUp && !chasing;
    const short = big && closeBottom && htfDown && rejected;
    const why = [];
    if (!big) why.push(`range ${fmt(range)} < ${TRIGGER.minRange}`);
    else if (!closeTop && !closeBottom) why.push(`đóng giữa nến (${Math.round(pos * 100)}%)`);
    if (big && closeTop && !htfUp) why.push("1D/4H/1H chưa cùng tăng");
    if (big && closeTop && htfUp && chasing) why.push("đang chase BB trên" + (htfAtUpper.length ? " (" + htfAtUpper.map((x) => x.toUpperCase()).join(",") + ")" : ""));
    if (big && closeBottom && !htfDown) why.push("1D/4H/1H chưa cùng giảm");
    if (big && closeBottom && htfDown && !rejected) why.push("chưa chạm/từ chối BB trên");
    return { key, label: key.toUpperCase(), t: k.t, o: k.o, h: k.h, l: k.l, c: k.c, range, pos, long, short, why };
  });
}
function renderTrigger(trig) {
  const hit = trig.find((x) => x.long || x.short);
  const card = $("trigCard");
  card.className = "card " + (hit ? (hit.long ? "trig-long" : "trig-short") : "");
  $("trigText").textContent = hit ? `${hit.long ? "LONG" : "SHORT"} TRIGGER · ${hit.label}` : "Chưa có nến tín hiệu";
  $("trigBody").innerHTML = trig.map((x) => {
    const time = new Date(x.t).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
    const sig = x.long ? '<span class="tag tang">LONG</span>' : x.short ? '<span class="tag giam">SHORT</span>' : '<span class="tag in">—</span>';
    return `<tr><td><b>${x.label}</b> ${time}</td><td>${fmt(x.o)} → ${fmt(x.c)}</td><td>${fmt(x.range)}</td><td>${Math.round(x.pos * 100)}%</td><td>${sig}</td><td class="muted">${x.long || x.short ? "Đủ điều kiện" : x.why.join(" · ") || "—"}</td></tr>`;
  }).join("");
}
function alignment(map) {
  const d1 = map["1d"].dir, h4 = map["4h"].dir, h1 = map["1h"].dir, m15 = map["15m"].dir;
  const sameHTF = d1 === h4 && h4 === h1 && d1 !== "sideway";
  const m15Opp = (d1 === "tang" && m15 === "giam") || (d1 === "giam" && m15 === "tang");
  const aligned = sameHTF && !m15Opp;
  return { aligned, dir: aligned ? d1 : null, sameHTF, m15Opp, d1, h4, h1, m15 };
}
function bandHits(map) {
  const hits = TFS.filter((tf) => map[tf.key].band === "upper" || map[tf.key].band === "lower")
    .map((tf) => ({ key: tf.key, label: tf.label, rank: tf.rank, band: map[tf.key].band }));
  const hasHTF = hits.some((h) => h.rank >= 2);
  return { hits, ready: hits.length >= 2 && hasHTF };
}
function buildOrder(price, map, align, bands) {
  if (!align.aligned || !bands.ready) {
    return [
      "KHÔNG CẢNH BÁO — chưa đồng pha / chưa chạm BB đủ điều kiện.",
      `1D ${align.d1.toUpperCase()} · 4H ${align.h4.toUpperCase()} · 1H ${align.h1.toUpperCase()} · 15M ${align.m15.toUpperCase()}`,
      `Giá hiện tại: ${fmt(price)}`,
      "Ưu tiên: WAIT. Không chase, không đoán.",
      "App sẽ tự viết lệnh khi 1D+4H+1H cùng hướng và ≥2 khung chạm band (có khung ≥1H)."
    ].join("\n");
  }
  const bb4 = map["4h"].bb;
  const bb1 = map["1h"].bb;
  const bbD = map["1d"].bb;
  const hitUpper = bands.hits.filter((h) => h.band === "upper").length >= 1;
  const hitLower = bands.hits.filter((h) => h.band === "lower").length >= 1;
  const lines = ["**CẢNH BÁO ĐỒNG PHA + BB**", `Thời điểm: ${nowVN()} (+07)`, `Giá: ${fmt(price)}`, `Hits: ${bands.hits.map((h) => h.label + " " + h.band).join(", ")}`, ""];
  if (align.dir === "tang" && hitLower) {
    const entryA = bb4 ? bb4.mid : price * 0.985;
    const sl = bb4 ? bb4.lower - 0.2 : price * 0.96;
    const tp1 = bb1 ? bb1.upper : price * 1.02;
    const tp2 = bbD ? bbD.upper : price * 1.04;
    const risk = Math.abs(price - sl) || 1;
    const rr = Math.abs(tp1 - price) / risk;
    lines.push(
      "Hướng: LONG (thuận 1D/4H, phản ứng BB dưới)",
      `Entry zone: ${fmt(Math.min(price, entryA))} – ${fmt(Math.max(price, entryA))}`,
      `Stop Loss: ${fmt(sl)}`, `TP1: ${fmt(tp1)}`, `TP2: ${fmt(tp2)}`,
      `R:R tới TP1 ≈ 1:${fmt(rr, 1)}`, `Invalidation: nến 4H đóng dưới ${fmt(sl)}`,
      "Nhắc: setup tham khảo, không phải lệnh đặt sẵn trên sàn."
    );
  } else if (align.dir === "giam" && hitUpper) {
    const sl = (bb1 ? bb1.upper : price) + 0.25;
    const tp1 = bb4 ? bb4.mid : price * 0.98;
    const tp2 = bb4 ? bb4.lower : price * 0.96;
    const risk = Math.abs(sl - price) || 1;
    const rr = Math.abs(price - tp1) / risk;
    lines.push(
      "Hướng: SHORT (HTF bear + chạm BB trên)",
      `Entry zone: ${fmt(price)} – ${fmt(price + 0.35)}`,
      `Stop Loss: ${fmt(sl)}`, `TP1: ${fmt(tp1)}`, `TP2: ${fmt(tp2)}`,
      `R:R tới TP1 ≈ 1:${fmt(rr, 1)}`, `Invalidation: nến 1H đóng trên ${fmt(sl)}`,
      "Nhắc: setup tham khảo, không phải lệnh đặt sẵn trên sàn."
    );
  } else if (align.dir === "tang" && hitUpper) {
    lines.push(
      "Hướng: KHÔNG LONG chase.",
      "Đồng pha tăng nhưng đang chạm BB trên — stretch.",
      `Chờ pullback về 4H mid ${bb4 ? fmt(bb4.mid) : "—"} mới xét long.`,
      `SL tham chiếu nếu vẫn muốn plan: ${bb4 ? fmt(bb4.lower - 0.2) : "—"}`,
      "Ưu tiên: WAIT."
    );
  } else {
    lines.push("Hướng: WAIT cho nến xác nhận 1H.", "Không short đáy band khi tín hiệu lệch.");
  }
  return lines.join("\n");
}
function renderTable(map) {
  $("tfBody").innerHTML = TFS.map((tf) => {
    const a = map[tf.key];
    const emaTxt = a.e9 && a.e21 ? `${fmt(a.e9)} / ${fmt(a.e21)}` : "—";
    const bandLabel = a.band === "upper" ? "CHẠM UPPER" : a.band === "lower" ? "CHẠM LOWER" : "Trong band";
    return `<tr><td><b>${tf.label}</b></td><td><span class="tag ${a.dir}">${a.dir.toUpperCase()}</span></td><td>${fmt(a.rsi, 1)}</td><td>${emaTxt}</td><td>${a.bb ? fmt(a.bb.upper) : "—"}</td><td>${a.bb ? fmt(a.bb.mid) : "—"}</td><td>${a.bb ? fmt(a.bb.lower) : "—"}</td><td>${a.bb ? fmt(a.bb.pctB, 2) : "—"}</td><td><span class="tag ${a.band}">${bandLabel}</span></td></tr>`;
  }).join("");
}
function setStatus(align, bands) {
  const ac = $("alignCard"); const al = $("alertCard");
  ac.className = "card status " + (align.aligned ? "ok" : "warn");
  $("alignText").textContent = align.aligned ? `ĐỒNG PHA ${align.dir.toUpperCase()}` : "CHƯA ĐỒNG PHA";
  $("alignDetail").textContent = `1D ${align.d1} · 4H ${align.h4} · 1H ${align.h1} · 15M ${align.m15}${align.m15Opp ? " (15M ngược)" : ""}`;
  const fire = align.aligned && bands.ready;
  al.className = "card status " + (fire ? "bad" : "warn");
  $("alertText").textContent = fire ? "CẢNH BÁO" : "KHÔNG CẢNH BÁO";
  $("alertDetail").textContent = bands.hits.length ? bands.hits.map((h) => h.label + " " + h.band).join(" · ") : "Chưa chạm cận trên/dưới";
  $("biasText").textContent = fire ? (align.dir === "tang" ? "XEM LONG" : "XEM SHORT") : "WAIT";
  return fire;
}
function addLog(text, alert) {
  const logs = JSON.parse(localStorage.getItem("solpha_logs") || "[]");
  logs.unshift({ t: nowVN(), text, alert: !!alert });
  localStorage.setItem("solpha_logs", JSON.stringify(logs.slice(0, 48)));
  renderLogs();
}
function renderLogs() {
  const logs = JSON.parse(localStorage.getItem("solpha_logs") || "[]");
  $("logList").innerHTML = logs.length ? logs.map((l) => `<li>${l.alert ? "⚠ " : "• "}<b>${l.t}</b> — ${l.text}</li>`).join("") : "<li>Chưa có nhật ký.</li>";
}
function nextHourLabel() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  $("nextScan").textContent = "Quét giờ tới: " + d.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
}
async function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts = { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "solpha-alert", renotify: true, vibrate: [200, 100, 200] };
  if ($("chkSound").checked) beep();
  // Chrome Android không cho dùng new Notification() — bắt buộc đi qua service worker.
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.ready : null;
    if (reg) return reg.showNotification(title, opts);
  } catch (_) {}
  try {
    const n = new Notification(title, opts);
    setTimeout(() => n.close(), 12000);
  } catch (_) {}
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.type = "sine"; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.05, ctx.currentTime); o.start(); o.stop(ctx.currentTime + 0.18);
  } catch (_) {}
}
async function fullScan(reason = "manual") {
  $("livePill").textContent = "SCAN";
  try {
    await loadTicker();
    const entries = await Promise.all(TFS.map(async (tf) => [tf.key, analyze(await loadKlines(tf.binance))]));
    const map = Object.fromEntries(entries);
    const price = map["5m"].last;
    const align = alignment(map);
    const bands = bandHits(map);
    renderTable(map);
    const fire = setStatus(align, bands);
    const trig = candleTrigger(map, align);
    renderTrigger(trig);
    $("orderBox").textContent = buildOrder(price, map, align, bands);
    $("updated").textContent = nowVN();
    const summary = fire ? `CẢNH BÁO ${align.dir} @ ${fmt(price)} · ${bands.hits.map((h) => h.label).join(",")}` : `WAIT ${fmt(price)} · 1D ${align.d1} / 4H ${align.h4} / 1H ${align.h1}`;
    if (reason === "hourly" || reason === "boot") addLog(summary, fire);
    if (fire) {
      const key = `${align.dir}-${bands.hits.map((h) => h.key + h.band).join("")}-${Math.round(price)}`;
      if (key !== lastAlertKey) {
        lastAlertKey = key;
        store.set("solpha_last_alert", key);
        await notify("SOLPHA cảnh báo", summary);
      }
    }
    for (const x of trig.filter((t) => t.long || t.short)) {
      const key = `${x.key}-${x.t}-${x.long ? "L" : "S"}`;
      if (key === lastTriggerKey) continue;
      lastTriggerKey = key;
      store.set("solpha_last_trigger", key);
      const msg = `${x.long ? "LONG" : "SHORT"} trigger ${x.label} · nến ${fmt(x.o)}→${fmt(x.c)} (range ${fmt(x.range)}, đóng ${Math.round(x.pos * 100)}%) · 1D/4H/1H ${align.d1}`;
      addLog(msg, true);
      await notify("SOLPHA nến tín hiệu", msg);
    }
  } catch (e) {
    $("orderBox").textContent = "Lỗi tải dữ liệu: " + (e.message || e);
    addLog("Lỗi API: " + (e.message || e), false);
  }
  $("livePill").textContent = "LIVE";
  nextHourLabel();
}
function scheduleHourly() {
  clearInterval(hourTimer);
  const msToNextHour = () => {
    const n = new Date();
    return (60 - n.getMinutes()) * 60 * 1000 - n.getSeconds() * 1000 - n.getMilliseconds();
  };
  setTimeout(function tick() {
    fullScan("hourly");
    hourTimer = setInterval(() => fullScan("hourly"), 60 * 60 * 1000);
  }, Math.max(msToNextHour(), 5000));
}
function schedulePrice() {
  clearInterval(priceTimer);
  const sec = Number($("selPrice").value || 30);
  priceTimer = setInterval(loadTicker, sec * 1000);
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); deferredPrompt = e; $("btnInstall").classList.remove("hidden");
});
$("btnInstall").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null;
  $("btnInstall").classList.add("hidden");
});
window.addEventListener("appinstalled", () => { deferredPrompt = null; $("btnInstall").classList.add("hidden"); });
$("btnNotify").addEventListener("click", async () => {
  if (!("Notification" in window)) { $("btnNotify").textContent = "Thiết bị không hỗ trợ"; return; }
  const perm = await Notification.requestPermission();
  if (perm === "granted") notify("SOLPHA", "Cảnh báo đã bật. Giữ app mở để quét theo giờ.");
  $("btnNotify").textContent = perm === "granted" ? "Cảnh báo đã bật" : "Trình duyệt chặn thông báo";
});
$("btnRefresh").addEventListener("click", () => fullScan("manual"));
$("selPrice").addEventListener("change", schedulePrice);
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
if ("Notification" in window && Notification.permission === "granted") $("btnNotify").textContent = "Cảnh báo đã bật";
renderLogs(); schedulePrice(); scheduleHourly(); fullScan("boot");
// Quét ngay sau mỗi mốc 5 phút (+8s) để bắt từng nến 5M vừa đóng.
(function scheduleWatch() {
  const ms = 5 * 60 * 1000 - (Date.now() % (5 * 60 * 1000)) + 8000;
  setTimeout(() => { fullScan("watch"); scheduleWatch(); }, ms);
})();
