const TFS = [
  { key: "5m", label: "5M", binance: "5m", rank: 0 },
  { key: "15m", label: "15M", binance: "15m", rank: 1 },
  { key: "1h", label: "1H", binance: "1h", rank: 2 },
  { key: "4h", label: "4H", binance: "4h", rank: 3 },
  { key: "1d", label: "1D", binance: "1d", rank: 4 }
];
const ENDPOINTS = ["https://fapi.binance.com", "https://fapi1.binance.com", "https://api.binance.com"];
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
};
// Mỗi tín hiệu (khung + nến + hướng) chỉ báo một lần; danh sách lưu lại để quét bù không báo trùng.
const seenKeys = (() => { try { return new Set(JSON.parse(store.get("solpha_seen", "[]"))); } catch (_) { return new Set(); } })();
function markSeen(key) { seenKeys.add(key); store.set("solpha_seen", JSON.stringify([...seenKeys].slice(-300))); }
let scanning = false, lastScanAt = 0, wakeLock = null;
// ---- Nhiều cặp: mỗi cặp có dữ liệu, tín hiệu, cài đặt và kế hoạch lệnh riêng ----
const DEFAULT_PAIRS = ["SOL", "BTC", "ETH", "DOGE"];
const symOf = (base) => base + "USDT";
const baseOf = (sym) => sym.replace(/USDT$/, "");
let pairs = (() => {
  try { const a = JSON.parse(store.get("solpha_pairs", "null")); if (Array.isArray(a)) { const ok = a.filter((b) => /^[A-Z0-9]{2,12}$/.test(b)); if (ok.length) return ok; } } catch (_) {}
  return DEFAULT_PAIRS.slice();
})();
let active = (() => { const a = store.get("solpha_active", "SOLUSDT"); return pairs.includes(baseOf(a)) ? a : symOf(pairs[0]); })();
const state = {};
const stOf = (sym) => (state[sym] || (state[sym] = { sym }));
// SOL giữ nguyên tên khoá cũ (không mất cài đặt đã lưu); cặp khác thêm hậu tố ":BTCUSDT"...
const pkey = (key, sym = active) => (sym === "SOLUSDT" ? key : `${key}:${sym}`);
const pget = (key, def, sym = active) => store.get(pkey(key, sym), def);
const keyPrefix = (sym) => (sym === "SOLUSDT" ? "" : sym + "-");
// Số lẻ giá theo mức giá của cặp (BTC/ETH/SOL: 2; coin giá nhỏ hiện nhiều số lẻ hơn).
let curDec = 2;
const decFor = (p) => (p >= 10000 ? 1 : p >= 10 ? 2 : p >= 1 ? 4 : p >= 0.01 ? 5 : 6);
// Số lẻ đúng bước giá của sàn (BTC 0.1 → 1 số, DOGE 0.00001 → 5 số): suy từ chính dữ liệu nến Binance trả về.
function tickDec(candles) {
  let d = 0;
  for (const k of candles.slice(-200)) for (const v of [k.o, k.h, k.l, k.c]) { const s = String(v), i = s.indexOf("."); if (i >= 0 && !s.includes("e")) d = Math.max(d, s.length - i - 1); }
  return Math.min(d, 8);
}
const decOf = (sym) => { const st = stOf(sym); return st.dec != null ? st.dec : decFor(st.price || (st.ticker && st.ticker.last) || 1); };
const fmtQty = (q) => (q >= 100 ? q.toFixed(0) : q >= 1 ? q.toFixed(2) : q >= 0.1 ? q.toFixed(3) : q.toFixed(4));
let deferredPrompt = null;
let priceTimer = null;
let hourTimer = null;
let liveTimer = null;
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
// MACD(12,26,9): hướng theo histogram (MACD − Signal) > 0 = tăng, < 0 = giảm.
function emaSeries(values, period) {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const out = new Array(period - 1).fill(null);
  let e = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(e);
  for (let i = period; i < values.length; i++) { e = values[i] * k + e * (1 - k); out.push(e); }
  return out;
}
function macd(values, fast = 12, slow = 26, signal = 9) {
  if (values.length < slow + signal) return null;
  const ef = emaSeries(values, fast), es = emaSeries(values, slow);
  const line = values.map((_, i) => (ef[i] != null && es[i] != null ? ef[i] - es[i] : null)).filter((x) => x != null);
  const sig = emaSeries(line, signal);
  const m = line[line.length - 1], s = sig[sig.length - 1];
  const hist = m - s;
  return { macd: m, signal: s, hist, dir: hist > 0 ? "tang" : hist < 0 ? "giam" : "sideway" };
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
function fp(n) { return fmt(n, curDec); }
function nowVN() {
  return new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
async function fetchJSON(url) {
  // Có giới hạn thời gian: Android hay treo kết nối khi app bị đóng băng, không có timeout thì cả vòng cập nhật đứng yên.
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctl.signal });
    if (!res.ok) throw new Error(res.status + " " + url);
    return await res.json();
  } finally { clearTimeout(to); }
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
async function loadTicker(sym) {
  // Giá 24h và mark/funding lấy song song; mark/funding lỗi thì bỏ qua, không kéo chậm giá.
  const prem = withBase(`/fapi/v1/premiumIndex?symbol=${sym}`, `/fapi/v1/premiumIndex?symbol=${sym}`).then((x) => x.data, () => null);
  const { data, source } = await withBase(`/api/v3/ticker/24hr?symbol=${sym}`, `/fapi/v1/ticker/24hr?symbol=${sym}`);
  const t = { last: Number(data.lastPrice), mark: Number(data.lastPrice), chg: Number(data.priceChangePercent), high: Number(data.highPrice), low: Number(data.lowPrice), source, funding: null };
  const d2 = await Promise.race([prem, new Promise((r) => setTimeout(() => r(null), 2000))]);
  if (d2 && d2.markPrice) t.mark = Number(d2.markPrice);
  if (d2 && d2.lastFundingRate != null) t.funding = Number(d2.lastFundingRate);
  return t;
}
function renderTicker(t) {
  curDec = decOf(active);
  $("lastPrice").textContent = "$" + fp(t.last);
  $("markPrice").textContent = "$" + fp(t.mark);
  $("chg24").textContent = `24h ${t.chg >= 0 ? "+" : ""}${fmt(t.chg)}%`;
  $("chg24").className = "chg " + (t.chg >= 0 ? "up" : "down");
  $("high24").textContent = "$" + fp(t.high);
  $("low24").textContent = "$" + fp(t.low);
  $("source").textContent = t.source;
  $("funding").textContent = t.funding == null ? "—" : (t.funding * 100).toFixed(4) + "%";
  renderUpdated(stOf(active));
}
// "Giá" = lần lấy giá gần nhất (mỗi vài giây); "quét" = lần tính tín hiệu gần nhất (mỗi 5 phút).
function renderUpdated(st) {
  const hms = (t) => new Date(t).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const scan = st.scanAt ? ` · quét ${hms(st.scanAt).slice(0, 5)}` : "";
  $("updated").textContent = st.tickerAt ? `${wsOk() ? "⚡ " : "giá "}${hms(st.tickerAt)}${scan}` : st.updated || "—";
}
async function loadKlinesUntil(sym, interval, limit, endTime) {
  const q = `symbol=${sym}&interval=${interval}&limit=${limit}&endTime=${endTime}`;
  const { data } = await withBase(`/api/v3/klines?${q.replace(`limit=${limit}`, `limit=${Math.min(limit, 1000)}`)}`, `/fapi/v1/klines?${q}`);
  return data.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
}
async function loadKlines(sym, interval, limit = 220) {
  const { data } = await withBase(`/api/v3/klines?symbol=${sym}&interval=${interval}&limit=${Math.min(limit, 1000)}`, `/fapi/v1/klines?symbol=${sym}&interval=${interval}&limit=${limit}`);
  return data.map((k) => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5] }));
}
function analyze(candles) {
  const closes = candles.map((c) => c.c);
  const last = closes[closes.length - 1];
  const e9 = ema(closes, 9);
  const e21 = ema(closes, 21);
  const r = rsi(closes, 14);
  const bb = bollinger(closes, 20, 2);
  const md = macd(closes);
  // Pha theo vị trí giá so với EMA21 + EMA9 xác nhận (xem SolphaSignals.trendDir) — tránh độ trễ của giao cắt EMA.
  const dir = SolphaSignals.trendDir(last, e9, ema(closes.slice(0, -3), 9), e21);
  let band = "in";
  if (bb) {
    if (bb.pctB >= 0.95 || last >= bb.upper) band = "upper";
    else if (bb.pctB <= 0.05 || last <= bb.lower) band = "lower";
  }
  return { last, e9, e21, rsi: r, bb, dir, band, candles, macd: md };
}
// ---- Nến tín hiệu (bộ máy trong signals.js) ----
function sigOptions(sym = active) {
  const g = (k) => pget(k, "1", sym) === "1";
  return {
    sessionFilter: g("solpha_session"),
    allowBandWalk: g("solpha_walk"),
    allowCorrective: g("solpha_corrective"),
    allowMomentum4H: g("solpha_m4h"),
    setups: { A: g("solpha_setupA"), B: g("solpha_setupB"), S1: g("solpha_setupS1"), S2: g("solpha_setupS2"), S3: g("solpha_setupS3") }
  };
}
function htfContext(map, align, funding, opt) {
  const O = { ...SolphaSignals.DEFAULTS, ...opt };
  const h1 = map["1h"], P1 = SolphaSignals.prepare(h1.candles), P4 = SolphaSignals.prepare(map["4h"].candles), PD = SolphaSignals.prepare(map["1d"].candles);
  let h1RejectUpper = false;
  for (let j = h1.candles.length - 2; j >= h1.candles.length - 3; j--) if (P1.bb[j] && h1.candles[j].h >= P1.bb[j].upper) h1RejectUpper = true;
  return {
    up: align.d1 === "tang" && align.h4 === "tang" && align.h1 === "tang",
    down: align.d1 === "giam" && align.h4 === "giam" && align.h1 === "giam",
    chaseUp: ["1h", "4h", "1d"].filter((k) => map[k].band === "upper").map((k) => k.toUpperCase()),
    chaseDown: ["1h", "4h", "1d"].filter((k) => map[k].band === "lower").map((k) => k.toUpperCase()),
    walkLong: SolphaSignals.bandWalk(P1, h1.candles.length - 2, "long", O),
    walkShort: SolphaSignals.bandWalk(P1, h1.candles.length - 2, "short", O),
    walk4hLong: SolphaSignals.bandWalk(P4, map["4h"].candles.length - 2, "long", O),
    walk4hShort: SolphaSignals.bandWalk(P4, map["4h"].candles.length - 2, "short", O),
    walk1dLong: SolphaSignals.bandWalk(PD, map["1d"].candles.length - 2, "long", O),
    walk1dShort: SolphaSignals.bandWalk(PD, map["1d"].candles.length - 2, "short", O),
    h1Upper: h1.bb && h1.bb.upper, h1Lower: h1.bb && h1.bb.lower, h1RejectUpper,
    m15Down: align.m15 === "giam",
    // 4H/1H chạm BB dưới: 2 nến đã đóng gần nhất, hoặc nến đang chạy đã xuống dưới dải.
    h1TouchLower: SolphaSignals.touchLowerHTF(P1, h1.candles.length - 2, h1.candles[h1.candles.length - 1].l),
    h4TouchLower: SolphaSignals.touchLowerHTF(P4, map["4h"].candles.length - 2, map["4h"].candles[map["4h"].candles.length - 1].l),
    d1Dir: align.d1, h4Dir: align.h4, h1Dir: align.h1,
    d1Mid: map["1d"].bb && map["1d"].bb.mid, d1Lower: map["1d"].bb && map["1d"].bb.lower,
    h1Close: h1.candles[h1.candles.length - 2].c, h1Ema21: P1.ema21[h1.candles.length - 2], h1Rsi: P1.rsi[h1.candles.length - 2],
    funding
  };
}
function candleTrigger(map, align, funding, sym) {
  const opt = sigOptions(sym), htf = htfContext(map, align, funding, opt);
  const P = {};
  const rows = [["5m", 5], ["15m", 15]].map(([key, min]) => {
    const candles = map[key].candles; P[key] = SolphaSignals.prepare(candles);
    return { key, label: key.toUpperCase(), ...SolphaSignals.evaluate(P[key], candles.length - 2, htf, min, opt) };
  });
  // Momentum 4H/1H: không chờ 1D; 15M + 5M cùng hướng và cùng chạm BB (nến đã đóng).
  const j15 = map["15m"].candles.length - 2, c15 = map["15m"].candles[j15], b15 = P["15m"].bb[j15];
  const e9 = P["15m"].ema9[j15], e21 = P["15m"].ema21[j15];
  const m15 = { dir: SolphaSignals.trendDir(c15.c, e9, P["15m"].ema9[j15 - 3], e21), ...SolphaSignals.touch15(P["15m"], j15) };
  rows.push({ key: "m4h", label: "4H/1H·5M+15M", ...SolphaSignals.evaluateMomentum(P["5m"], map["5m"].candles.length - 2, m15, htf, 5, opt) });
  return rows;
}
function renderTrigger(trig) {
  const hit = trig.find((x) => x.side);
  $("trigCard").className = "card " + (hit ? (hit.side === "long" ? "trig-long" : "trig-short") : "");
  $("trigText").textContent = hit && hit.engine === "m4h" ? `${hit.side.toUpperCase()} MOMENTUM 4H/1H · 5M+15M chạm ${hit.side === "long" ? "BB trên" : "BB dưới"} (½ khối lượng)`
    : hit ? `${hit.side.toUpperCase()}${hit.corrective ? " ĐIỀU CHỈNH" : ""} · Setup ${hit.setup} · ${hit.label}${hit.momentum ? " · Momentum (½ khối lượng)" : ""}` : "Chưa có nến tín hiệu";
  // Lý do hiển thị ngay dưới tiêu đề (trên điện thoại cột Ghi chú nằm khuất bên phải bảng).
  $("trigWhy").innerHTML = hit ? "" : trig.map((x) => `<div><b>${x.label}</b>: ${x.why.join(" · ") || "—"}</div>`).join("");
  $("trigBody").innerHTML = trig.map((x) => {
    const time = new Date(x.t).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
    const sig = x.side ? `<span class="tag ${x.side === "long" ? "tang" : "giam"}">${x.side.toUpperCase()}${x.corrective ? " ĐC" : ""} ${x.setup}${x.momentum ? " ·M" : ""}</span>` : '<span class="tag in">—</span>';
    return `<tr><td><b>${x.label}</b> ${time}</td><td>${fp(x.o)} → ${fp(x.c)}</td><td>${fp(x.range)}${x.atrMult ? ` (${fmt(x.atrMult, 1)}×ATR)` : ""}</td><td>${x.volMult ? fmt(x.volMult, 1) + "×" : "—"}</td><td>${x.pos != null ? Math.round(x.pos * 100) + "%" : "—"}</td><td>${sig}</td><td class="muted">${x.side ? "Đủ điều kiện" : x.why.join(" · ") || "—"}</td></tr>`;
  }).join("");
}
// Ô Ưu tiên: kế hoạch lệnh của tín hiệu gần nhất (giữ 30 phút), lưu riêng từng cặp.
function planText(x, sym) {
  const coin = baseOf(sym), p = x.plan, acct = Number(store.get("solpha_acct", "0")), riskPct = Number(store.get("solpha_risk", "1")) * (p.sizeFactor || 1);
  const riskUsd = acct * riskPct / 100, qty = riskUsd && p.risk ? riskUsd / p.risk : 0;
  return {
    head: `${coin} · ` + (p.momentum4h ? `${x.side === "long" ? "LONG" : "SHORT"} MOMENTUM 4H/1H · 5M+15M chạm ${x.side === "long" ? "BB trên" : "BB dưới"} · ½ khối lượng${x.d1Against ? " · ⚠ ngược 1D" : ""}`
      : `${x.side === "long" ? "LONG" : "SHORT"}${p.corrective ? " ĐIỀU CHỈNH" : ""} · Setup ${x.setup} · ${x.label}${(p.sizeFactor || 1) < 1 ? " · ½ khối lượng" : ""}`),
    lines: [
      `Vào 3 phần: ${p.entries.map((e) => fp(e)).join(" / ")} (TB ${fp(p.entry)})`,
      `SL: ${fp(p.sl)} (rủi ro ${fp(p.risk)}/${coin})`,
      `TP1: ${fp(p.tp1)} (R:R 1:${fmt(p.rr1, 1)}) → ${p.partialTP1 ? "chốt ½, " : ""}dời SL về giá vào`,
      `TP2: ${fp(p.tp2)} (R:R 1:${fmt(p.rr2, 1)})`,
      qty ? `Khối lượng: ${fmtQty(qty)} ${coin} ≈ $${fmt(qty * p.entry, 0)} · đòn bẩy ≈ ${fmt(qty * p.entry / acct, 1)}x (rủi ro $${fmt(riskUsd, 0)} = ${riskPct}% vốn), mỗi phần ${fmtQty(qty / 3)} ${coin}`
          : "Nhập vốn ở mục Cài đặt để app tính khối lượng.",
      ...(p.timeStopBars ? [`Giới hạn thời gian: chưa chạm TP1 sau ${Math.round(p.timeStopBars * 5 / 60 * 10) / 10} giờ → thoát lệnh`] : []),
      ...(p.momentum4h ? ["Vào theo đà khi giá đang ở dải BB: dễ bị giật ngược — chỉ ½ khối lượng, không gồng lỗ, chạm SL là thoát."] : [])
    ]
  };
}
function persistPlan(sym, trig) {
  const hit = trig.find((x) => x.side && x.key === "5m") || trig.find((x) => x.side && x.key === "15m") || trig.find((x) => x.side);
  if (hit) store.set(pkey("solpha_last_plan", sym), JSON.stringify({ x: hit, exp: Date.now() + 30 * 60000 }));
}
function savedPlan(sym) {
  try { const s = JSON.parse(pget("solpha_last_plan", "null", sym)); return s && s.exp > Date.now() ? s : null; } catch (_) { return null; }
}
function renderPlan(sym) {
  const saved = savedPlan(sym), card = $("planCard");
  if (saved) {
    const t = planText(saved.x, sym);
    card.className = "card status " + (saved.x.side === "long" ? "ok" : "bad");
    $("biasText").textContent = t.head;
    $("planBox").innerHTML = t.lines.map((l) => `<div>${l}</div>`).join("") + `<div class="muted">Nến ${new Date(saved.x.t).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })} · hết hạn sau ${Math.ceil((saved.exp - Date.now()) / 60000)}′</div>`;
    return true;
  }
  card.className = "card status";
  $("planBox").innerHTML = "";
  return false;
}
function alignment(map) {
  const d1 = map["1d"].dir, h4 = map["4h"].dir, h1 = map["1h"].dir, m15 = map["15m"].dir;
  const sameHTF = d1 === h4 && h4 === h1 && d1 !== "sideway";
  const m15Opp = (d1 === "tang" && m15 === "giam") || (d1 === "giam" && m15 === "tang");
  // MACD chỉ để tham khảo, không chặn tín hiệu (bỏ vì làm lỡ nhiều cơ hội).
  const md = (k) => (map[k].macd ? map[k].macd.dir : "sideway");
  const macdD1 = md("1d"), macdH4 = md("4h"), macdH1 = md("1h");
  const macdAligned = sameHTF && macdD1 === d1 && macdH4 === d1 && macdH1 === d1;
  const aligned = sameHTF && !m15Opp;
  return { aligned, dir: aligned ? d1 : null, sameHTF, m15Opp, macdAligned, macdD1, macdH4, macdH1, d1, h4, h1, m15 };
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
      `MACD hist: 1D ${align.macdD1} · 4H ${align.macdH4} · 1H ${align.macdH1}${align.macdAligned ? " (cùng pha)" : " (lệch pha)"} — tham khảo`,
      `Giá hiện tại: ${fp(price)}`,
      "Ưu tiên: WAIT. Không chase, không đoán.",
      "App sẽ tự viết lệnh khi 1D+4H+1H cùng hướng và ≥2 khung chạm band (có khung ≥1H)."
    ].join("\n");
  }
  const bb4 = map["4h"].bb;
  const bb1 = map["1h"].bb;
  const bbD = map["1d"].bb;
  const hitUpper = bands.hits.filter((h) => h.band === "upper").length >= 1;
  const hitLower = bands.hits.filter((h) => h.band === "lower").length >= 1;
  const o35 = price * 0.003, o25 = price * 0.0023, o20 = price * 0.0018; // đệm theo % giá (trước đây là $ cố định cho SOL)
  const lines = ["**CẢNH BÁO ĐỒNG PHA + BB**", `Thời điểm: ${nowVN()} (+07)`, `Giá: ${fp(price)}`, `Hits: ${bands.hits.map((h) => h.label + " " + h.band).join(", ")}`, ""];
  if (align.dir === "tang" && hitLower) {
    const entryA = bb4 ? bb4.mid : price * 0.985;
    const sl = bb4 ? bb4.lower - o20 : price * 0.96;
    const tp1 = bb1 ? bb1.upper : price * 1.02;
    const tp2 = bbD ? bbD.upper : price * 1.04;
    const risk = Math.abs(price - sl) || 1;
    const rr = Math.abs(tp1 - price) / risk;
    lines.push(
      "Hướng: LONG (thuận 1D/4H, phản ứng BB dưới)",
      `Entry zone: ${fp(Math.min(price, entryA))} – ${fp(Math.max(price, entryA))}`,
      `Stop Loss: ${fp(sl)}`, `TP1: ${fp(tp1)}`, `TP2: ${fp(tp2)}`,
      `R:R tới TP1 ≈ 1:${fmt(rr, 1)}`, `Invalidation: nến 4H đóng dưới ${fp(sl)}`,
      "Nhắc: setup tham khảo, không phải lệnh đặt sẵn trên sàn."
    );
  } else if (align.dir === "giam" && hitUpper) {
    const sl = (bb1 ? bb1.upper : price) + o25;
    const tp1 = bb4 ? bb4.mid : price * 0.98;
    const tp2 = bb4 ? bb4.lower : price * 0.96;
    const risk = Math.abs(sl - price) || 1;
    const rr = Math.abs(price - tp1) / risk;
    lines.push(
      "Hướng: SHORT (HTF bear + chạm BB trên)",
      `Entry zone: ${fp(price)} – ${fp(price + o35)}`,
      `Stop Loss: ${fp(sl)}`, `TP1: ${fp(tp1)}`, `TP2: ${fp(tp2)}`,
      `R:R tới TP1 ≈ 1:${fmt(rr, 1)}`, `Invalidation: nến 1H đóng trên ${fp(sl)}`,
      "Nhắc: setup tham khảo, không phải lệnh đặt sẵn trên sàn."
    );
  } else if (align.dir === "tang" && hitUpper) {
    lines.push(
      "Hướng: KHÔNG LONG chase.",
      "Đồng pha tăng nhưng đang chạm BB trên — stretch.",
      `Chờ pullback về 4H mid ${bb4 ? fp(bb4.mid) : "—"} mới xét long.`,
      `SL tham chiếu nếu vẫn muốn plan: ${bb4 ? fp(bb4.lower - o20) : "—"}`,
      "Ưu tiên: WAIT."
    );
  } else {
    lines.push("Hướng: WAIT cho nến xác nhận 1H.", "Không short đáy band khi tín hiệu lệch.");
  }
  return lines.join("\n");
}
// Số lẻ MACD giống app Binance: BTC 1 số, ETH 2 số, coin giá nhỏ thêm 1 số so với giá.
// Số lẻ MACD: như giá, coin giá dưới 1.000 thêm 1 số (giá trị MACD nhỏ).
const macdDec = (p) => curDec + (p < 1000 && curDec < 4 ? 1 : 0);
function renderTable(map) {
  const md = macdDec(map["5m"].last);
  $("tfBody").innerHTML = TFS.map((tf) => {
    const a = map[tf.key];
    const emaTxt = a.e9 && a.e21 ? `${fp(a.e9)} / ${fp(a.e21)}` : "—";
    const bandLabel = a.band === "upper" ? "CHẠM UPPER" : a.band === "lower" ? "CHẠM LOWER" : "Trong band";
    return `<tr><td><b>${tf.label}</b></td><td><span class="tag ${a.dir}">${a.dir.toUpperCase()}</span></td><td>${fmt(a.rsi, 1)}</td><td>${emaTxt}</td><td>${a.macd ? `<span class="tag ${a.macd.dir}">${fmt(a.macd.hist, md)}</span> <span class="muted">${fmt(a.macd.macd, md)} / ${fmt(a.macd.signal, md)}</span>` : "—"}</td><td>${a.bb ? fp(a.bb.upper) : "—"}</td><td>${a.bb ? fp(a.bb.mid) : "—"}</td><td>${a.bb ? fp(a.bb.lower) : "—"}</td><td>${a.bb ? fmt(a.bb.pctB, 2) : "—"}</td><td><span class="tag ${a.band}">${bandLabel}</span></td></tr>`;
  }).join("");
}
function setStatus(align, bands) {
  const ac = $("alignCard"); const al = $("alertCard");
  ac.className = "card status " + (align.aligned ? "ok" : "warn");
  $("alignText").textContent = align.aligned ? `ĐỒNG PHA ${align.dir.toUpperCase()}` : "CHƯA ĐỒNG PHA";
  const mTxt = (m) => (m === "tang" ? "↑" : m === "giam" ? "↓" : "–");
  $("alignDetail").textContent = `EMA: 1D ${align.d1} · 4H ${align.h4} · 1H ${align.h1} · 15M ${align.m15}${align.m15Opp ? " (15M ngược)" : ""} | MACD: 1D ${mTxt(align.macdD1)} 4H ${mTxt(align.macdH4)} 1H ${mTxt(align.macdH1)}${align.sameHTF && !align.macdAligned ? " (lệch pha, tham khảo)" : ""}`;
  const fire = align.aligned && bands.ready;
  al.className = "card status " + (fire ? "bad" : "warn");
  $("alertText").textContent = fire ? "CẢNH BÁO" : "KHÔNG CẢNH BÁO";
  $("alertDetail").textContent = bands.hits.length ? bands.hits.map((h) => h.label + " " + h.band).join(" · ") : "Chưa chạm cận trên/dưới";
  // Khớp với buildOrder: long chỉ khi chạm BB dưới, short chỉ khi chạm BB trên; ngược lại là chase.
  const hitU = bands.hits.some((h) => h.band === "upper"), hitL = bands.hits.some((h) => h.band === "lower");
  $("biasText").textContent = !fire ? "WAIT"
    : align.dir === "tang" ? (hitL ? "XEM LONG" : "KHÔNG CHASE · chờ pullback")
    : (hitU ? "XEM SHORT" : "KHÔNG SHORT ĐÁY · chờ hồi");
  return fire;
}
function addLog(text, alert) {
  const logs = JSON.parse(localStorage.getItem("solpha_logs") || "[]");
  logs.unshift({ t: nowVN(), text, alert: !!alert });
  localStorage.setItem("solpha_logs", JSON.stringify(logs.slice(0, 150)));
  renderLogs();
}
function renderLogs() {
  const logs = JSON.parse(localStorage.getItem("solpha_logs") || "[]");
  $("logList").innerHTML = logs.length ? logs.slice(0, 60).map((l) => `<li>${l.alert ? "⚠ " : "• "}<b>${l.t}</b> — ${l.text}</li>`).join("") : "<li>Chưa có nhật ký.</li>";
}
const Q15 = 15 * 60 * 1000;
function nextHourLabel() {
  const d = new Date(Math.floor(Date.now() / Q15) * Q15 + Q15);
  $("nextScan").textContent = "Quét kế tiếp (15′): " + d.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
}
async function notify(title, body, tag = "solpha-alert") {
  if (!("Notification" in window)) return "Thiết bị không hỗ trợ thông báo";
  if (Notification.permission !== "granted") return "Quyền thông báo: " + Notification.permission;
  const opts = { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag, renotify: true, vibrate: [300, 150, 300, 150, 300], requireInteraction: true };
  if ($("chkSound").checked) beep();
  // Chrome Android không cho dùng new Notification() — bắt buộc đi qua service worker.
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.ready : null;
    if (reg) { await reg.showNotification(title, opts); return "ok"; }
  } catch (e) { return "Lỗi service worker: " + (e.message || e); }
  try {
    const n = new Notification(title, opts);
    setTimeout(() => n.close(), 12000);
    return "ok";
  } catch (e) { return "Lỗi thông báo: " + (e.message || e); }
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.value = 880; o.type = "sine"; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.05, ctx.currentTime); o.start(); o.stop(ctx.currentTime + 0.18);
  } catch (_) {}
}
// Quét một cặp: tính toàn bộ, lưu vào state[sym], gửi cảnh báo (mọi cặp, không chỉ cặp đang xem).
async function scanPair(sym, reason, gapMin) {
  const st = stOf(sym), coin = baseOf(sym), opt = sigOptions(sym);
  try { st.ticker = await loadTicker(sym); st.tickerAt = Date.now(); st.funding = st.ticker.funding; } catch (e) { st.tickerError = String(e.message || e); }
  const entries = await Promise.all(TFS.map(async (tf) => [tf.key, analyze(await loadKlines(sym, tf.binance))]));
  const map = Object.fromEntries(entries);
  const price = map["5m"].last;
  st.dec = tickDec(map["5m"].candles);
  curDec = st.dec;
  const align = alignment(map), bands = bandHits(map), fire = align.aligned && bands.ready;
  const trig = candleTrigger(map, align, st.funding, sym);
  Object.assign(st, { map, align, bands, trig, price, fire, error: null, updated: nowVN(), scanAt: Date.now() });
  st.order = buildOrder(price, map, align, bands);
  persistPlan(sym, trig);
  const summary = fire ? `CẢNH BÁO ${align.dir} @ ${fp(price)} · ${bands.hits.map((h) => h.label).join(",")}` : `WAIT ${fp(price)} · 1D ${align.d1} / 4H ${align.h4} / 1H ${align.h1}`;
  // Ghi nhật ký pha mỗi 15 phút: lần quét đầu tiên của mỗi mốc :00/:15/:30/:45 (dù do WebSocket, đồng hồ 5′ hay 15′ kích hoạt).
  const q = Math.floor(Date.now() / Q15);
  if (reason === "boot" || q !== st.loggedQ) { st.loggedQ = q; addLog(`[${coin}] ${summary}`, fire); }
  if (fire) {
    const key = `${align.dir}-${bands.hits.map((h) => h.key + h.band).join("")}-${Math.round(Math.log(price) / 0.005)}`; // đổi sau mỗi ~0.5% giá
    const lk = pkey("solpha_last_alert", sym);
    if (key !== store.get(lk, "")) {
      store.set(lk, key);
      await notify(`SOLPHA · ${coin} cảnh báo`, `[${coin}] ${summary}`, `solpha-${coin}`);
    }
  }
  for (const x of trig.filter((t) => t.side)) {
    const key = `${keyPrefix(sym)}${x.key}-${x.t}-${x.side}`;
    if (seenKeys.has(key)) continue;
    markSeen(key);
    const p = x.plan;
    const msg = `[${coin}] ${x.side.toUpperCase()}${x.engine === "m4h" ? " MOMENTUM 4H/1H (½ size" + (x.d1Against ? ", ngược 1D" : "") + ")" : ""}${x.corrective ? " ĐIỀU CHỈNH (½ size)" : ""} Setup ${x.setup} ${x.label}${x.momentum ? " (Momentum ½ size)" : ""} · vào ${fp(p.entries[0])}/${fp(p.entries[1])}/${fp(p.entries[2])} · SL ${fp(p.sl)} · TP1 ${fp(p.tp1)} (1:${fmt(p.rr1, 1)}) · TP2 ${fp(p.tp2)} (1:${fmt(p.rr2, 1)})`;
    addLog(msg, true);
    await notify(`SOLPHA · ${coin} nến tín hiệu`, msg, `solpha-${coin}`);
  }
  await catchUp(sym, map, gapMin);
}
// Làm mới chỉ báo (RSI/EMA/BB/MACD) của cặp đang xem theo nến đang chạy, giống biểu đồ Binance.
// Không gửi cảnh báo — cảnh báo vẫn theo vòng quét 5 phút trên nến đã đóng.
async function liveRefresh() {
  const sym = active, st = stOf(sym);
  if (scanning || st.live || !st.map || wsOk() || document.visibilityState !== "visible") return;
  st.live = true;
  try {
    const entries = await Promise.all(TFS.map(async (tf) => [tf.key, analyze(await loadKlines(sym, tf.binance))]));
    const map = Object.fromEntries(entries), price = map["5m"].last;
    const align = alignment(map), bands = bandHits(map);
    Object.assign(st, { map, align, bands, price, fire: align.aligned && bands.ready, trig: candleTrigger(map, align, st.funding, sym), liveAt: Date.now() });
    st.order = buildOrder(price, map, align, bands);
    if (sym === active) renderPair(sym);
  } catch (_) {}
  st.live = false;
}
// Vẽ một cặp lên màn hình từ dữ liệu đã quét.
function renderPair(sym) {
  const st = stOf(sym), coin = baseOf(sym);
  $("heroPair").textContent = `${sym}.P`;
  $("toolsPair").textContent = $("setPair").textContent = coin;
  if (!st.map) {
    $("trigText").textContent = st.error ? "Lỗi tải dữ liệu" : "Đang quét…";
    $("trigWhy").textContent = st.error || "";
    $("orderBox").textContent = st.error ? "Lỗi tải dữ liệu: " + st.error : "Đang tính setup…";
    return;
  }
  curDec = decOf(sym);
  if (st.ticker) renderTicker(st.ticker);
  renderTable(st.map);
  setStatus(st.align, st.bands);
  renderTrigger(st.trig);
  if (!renderPlan(sym) && !st.fire) $("biasText").textContent = "WAIT";
  $("orderBox").textContent = (st.error ? "⚠ Lần quét gần nhất lỗi: " + st.error + "\n(đang hiện dữ liệu lần trước)\n\n" : "") + st.order;
  renderUpdated(st);
  $("missedBox").innerHTML = st.missedHtml || "";
  const bd = badgeFor(sym);
  $("heroBadge").className = "pbadge " + bd.cls;
  $("heroBadge").textContent = bd.txt;
}
function badgeFor(sym) {
  const st = stOf(sym);
  if (!st.map) return { cls: "wait", txt: "…" };
  const live = st.trig && st.trig.find((x) => x.side), saved = savedPlan(sym);
  const side = live ? live.side : saved ? saved.x.side : null;
  if (side) return { cls: side, txt: side.toUpperCase() };
  if (st.fire) return { cls: "warn", txt: "CHÚ Ý" };
  return { cls: "wait", txt: "CHỜ" };
}
function renderTabs() {
  const bar = $("pairBar"), sig = pairs.join(",") + "|" + active;
  if (bar.dataset.sig !== sig) {
    bar.innerHTML = pairs.map((b) => `<button class="ptab ${symOf(b) === active ? "active" : ""}" data-sym="${symOf(b)}"><span class="pname">${b}</span><span class="pprice">…</span><span class="pchg"></span><span class="pbadge wait">…</span></button>`).join("")
      + `<button class="ptab add" id="btnAddPair" aria-label="Thêm / quản lý cặp">＋</button>`;
    bar.dataset.sig = sig;
  }
  for (const b of pairs) {
    const sym = symOf(b), st = stOf(sym), t = st.ticker, bd = badgeFor(sym), el = bar.querySelector(`[data-sym="${sym}"]`);
    if (!el) continue;
    if (t) {
      el.querySelector(".pprice").textContent = fmt(t.last, decOf(sym));
      const c = el.querySelector(".pchg"); c.className = "pchg " + (t.chg >= 0 ? "up" : "down"); c.textContent = (t.chg >= 0 ? "+" : "") + t.chg.toFixed(2) + "%";
    }
    const g = el.querySelector(".pbadge"); g.className = "pbadge " + bd.cls; g.textContent = bd.txt;
  }
}
async function refreshTickers(force) {
  if (!force && wsOk()) return; // đang có realtime
  // Mỗi cặp tự cập nhật độc lập và hiện ngay khi giá về: một cặp chậm/treo không làm đứng các cặp khác.
  await Promise.all(pairs.map(async (b) => {
    const sym = symOf(b), st = stOf(sym);
    if (st.refreshing) return;
    st.refreshing = true;
    try { st.ticker = await loadTicker(sym); st.tickerAt = Date.now(); st.funding = st.ticker.funding; st.tickerError = null; } catch (e) { st.tickerError = String(e.message || e); }
    st.refreshing = false;
    renderTabs();
    if (sym === active && st.ticker) renderTicker(st.ticker);
  }));
}
// ---- Realtime: WebSocket Binance Futures (giá, mark, funding, nến 5 khung đẩy về liên tục ~0.25 giây) ----
// Hỏng WebSocket thì tự quay về hỏi giá định kỳ (REST) như cũ và tự kết nối lại.
const WS_HOST = "wss://fstream.binance.com/stream?streams=";
let ws = null, wsRetry = 0, wsLast = 0, wsReconnect = null, scanSoon = null;
const wsOk = () => ws && ws.readyState === 1 && Date.now() - wsLast < 15000;
function wsConnect() {
  clearTimeout(wsReconnect);
  if (ws) { ws.onclose = null; try { ws.close(); } catch (_) {} ws = null; }
  if (!("WebSocket" in window) || !pairs.length) return;
  const streams = pairs.flatMap((b) => { const s = symOf(b).toLowerCase(); return [`${s}@ticker`, `${s}@markPrice@1s`, ...TFS.map((tf) => `${s}@kline_${tf.binance}`)]; });
  try { ws = new WebSocket(WS_HOST + streams.join("/")); } catch (_) { return wsRetryLater(); }
  ws.onopen = () => { wsRetry = 0; };
  ws.onmessage = (e) => { wsLast = Date.now(); try { onStream(JSON.parse(e.data).data); } catch (_) {} };
  ws.onerror = () => { try { ws.close(); } catch (_) {} };
  ws.onclose = () => { ws = null; wsRetryLater(); };
}
function wsRetryLater() {
  clearTimeout(wsReconnect);
  wsReconnect = setTimeout(() => { if (document.visibilityState === "visible") wsConnect(); }, Math.min(30000, 1000 * 2 ** wsRetry++));
}
function onStream(d) {
  if (!d || !d.s) return;
  const st = state[d.s]; if (!st) return;
  const t = st.ticker || (st.ticker = { last: 0, mark: 0, chg: 0, high: 0, low: 0, funding: null });
  t.source = "Binance Futures · realtime";
  if (d.e === "24hrTicker") { t.last = +d.c; t.chg = +d.P; t.high = +d.h; t.low = +d.l; }
  else if (d.e === "markPriceUpdate") { t.mark = +d.p; t.funding = st.funding = +d.r; }
  else if (d.e === "kline") {
    const k = d.k, c = { t: k.t, o: +k.o, h: +k.h, l: +k.l, c: +k.c, v: +k.v };
    t.last = c.c;
    const tf = st.map && st.map[k.i];
    if (tf) {
      const arr = tf.candles, last = arr[arr.length - 1];
      if (c.t === last.t) arr[arr.length - 1] = c;
      else if (c.t > last.t) { arr.push(c); arr.shift(); }
      st.klineDirty = true;
    }
    // Nến 5M vừa đóng: quét tín hiệu ngay (không chờ đồng hồ 5 phút).
    if (k.i === "5m" && k.x) { clearTimeout(scanSoon); scanSoon = setTimeout(() => fullScan("ws"), 1500); }
  }
  st.tickerAt = Date.now(); st.tickDirty = true;
}
// Vẽ lại tối đa mỗi giây: giá mọi tab; chỉ báo của cặp đang xem tính lại từ nến realtime.
let lastIndCalc = 0;
setInterval(() => {
  if (document.visibilityState !== "visible") return;
  let any = false;
  for (const b of pairs) { const st = stOf(symOf(b)); if (st.tickDirty) { any = true; st.tickDirty = false; } }
  const st = stOf(active);
  if (st.klineDirty && st.map && !scanning && Date.now() - lastIndCalc > 2000) {
    lastIndCalc = Date.now(); st.klineDirty = false;
    const map = {}; for (const tf of TFS) map[tf.key] = analyze(st.map[tf.key].candles);
    const align = alignment(map), bands = bandHits(map), price = map["5m"].last;
    Object.assign(st, { map, align, bands, price, fire: align.aligned && bands.ready, trig: candleTrigger(map, align, st.funding, active), liveAt: Date.now() });
    st.order = buildOrder(price, map, align, bands);
    renderPair(active);
  } else if (any && st.ticker) renderTicker(st.ticker);
  if (any) renderTabs();
  $("livePill").textContent = scanning ? "SCAN" : wsOk() ? "⚡ REALTIME" : "LIVE";
}, 1000);
async function fullScan(reason = "manual", onlyActive = false) {
  if (scanning) return;
  scanning = true;
  const gapMin = lastScanAt ? (Date.now() - lastScanAt) / 60000 : 0; // app "ngủ" bao lâu trước lần quét này
  $("livePill").textContent = "SCAN";
  const order = onlyActive ? [active] : [active, ...pairs.map(symOf).filter((s) => s !== active)]; // cặp đang xem quét trước
  for (const sym of order) {
    try { await scanPair(sym, reason, gapMin); }
    catch (e) { stOf(sym).error = String(e.message || e); addLog(`[${baseOf(sym)}] Lỗi API: ${stOf(sym).error}`, false); }
    if (sym === active) renderPair(sym);
    renderTabs();
  }
  nextHourLabel();
  lastScanAt = Date.now();
  scanning = false;
}
// Quét bù: xem lại các nến 5M đã đóng trong 90 phút qua bằng đúng bộ máy tín hiệu, liệt kê tín hiệu (kể cả khi app "ngủ"
// lúc nó xảy ra) và báo bù những tín hiệu chưa từng báo. Không áp dụng bộ lọc funding trừ khi funding hiện tại đã quá âm.
async function catchUp(sym, map, gapMin) {
  const st = stOf(sym), coin = baseOf(sym), pre = keyPrefix(sym);
  const closed = (k) => map[k].candles.slice(0, -1);
  const c5 = closed("5m"); if (c5.length < 120) return;
  const to = c5[c5.length - 1].t, from = to - 17 * 5 * 60000;
  let rows = [];
  try { rows = SolphaSignals.replay(c5, closed("1h"), closed("4h"), closed("1d"), closed("15m"), from, to, sigOptions(sym)); } catch (_) { return; }
  const fundingBlocks = st.funding != null && st.funding <= SolphaSignals.DEFAULTS.fundingMin;
  const items = [];
  for (const r of rows) {
    if (r.main.side && !(fundingBlocks && r.main.side === "short")) items.push({ key: `${pre}5m-${r.t}-${r.main.side}`, t: r.t, sig: r.main, tag: r.main.corrective ? "ĐC " + r.main.setup : r.main.setup });
    if (r.mom.side && !fundingBlocks) items.push({ key: `${pre}m4h-${r.t}-short`, t: r.t, sig: r.mom, tag: "M4H" });
  }
  items.sort((a, b) => b.t - a.t);
  const hm = (t) => new Date(t).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
  const missed = items.filter((x) => !seenKeys.has(x.key));
  const sleep = gapMin >= 8 ? `<div class="muted">App vừa thức dậy sau ${Math.round(gapMin)} phút "ngủ" — đã quét bù các nến trong lúc đó.</div>` : "";
  st.missedHtml = sleep + (items.length ? `<div class="muted"><b>Tín hiệu 90 phút qua · ${coin}</b></div>` + items.map((x) => {
    const p = x.sig.plan, age = Math.round((Date.now() - (x.t + 300000)) / 60000), isMiss = !seenKeys.has(x.key);
    return `<div class="mrow ${isMiss ? "miss" : ""}"><b>${hm(x.t)}</b> · ${x.sig.side.toUpperCase()} ${x.tag}${(p.sizeFactor || 1) < 1 ? " ½" : ""} · ${age}′ trước · vào ${fp(p.entries[0])} · SL ${fp(p.sl)} · TP1 ${fp(p.tp1)}${isMiss ? ' <span class="tag giam">BỎ LỠ</span>' : ""}</div>`;
  }).join("") + `<div class="muted">Tín hiệu quá 30′ tuổi: giá đã đi xa, cân nhắc kỹ trước khi vào.</div>` : "");
  if (missed.length) {
    missed.forEach((x) => markSeen(x.key));
    const msg = `[${coin}] Bỏ lỡ ${missed.length} tín hiệu: ` + missed.slice(0, 4).map((x) => `${hm(x.t)} ${x.sig.side.toUpperCase()} ${x.tag}`).join(" · ") + " — mở app xem kế hoạch lệnh";
    addLog(msg, true);
    if (document.visibilityState !== "visible") await notify(`SOLPHA · ${coin} — tín hiệu bỏ lỡ`, msg, `solpha-missed-${coin}`);
  }
}
// App thức dậy (mở lại / quay lại từ app khác): quét ngay thay vì chờ mốc 5 phút kế tiếp.
function wake(reason) { if (Date.now() - lastScanAt > 45000) fullScan(reason); }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { wake("resume"); if (!wsOk()) wsConnect(); refreshTickers(); if (store.get("solpha_wake", "0") === "1") setWake(true); } });
window.addEventListener("pageshow", () => wake("resume"));
window.addEventListener("focus", () => wake("resume"));
async function setWake(on) {
  try {
    if (on && "wakeLock" in navigator) {
      if (wakeLock) return;
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (_) { wakeLock = null; }
}
// Quét tổng mỗi 15 phút (ngay sau khi nến 15M đóng): cập nhật pha 1D/4H/1H/15M của mọi cặp và ghi nhật ký.
function scheduleQuarter() {
  clearTimeout(hourTimer);
  const ms = Q15 - (Date.now() % Q15) + 10000;
  hourTimer = setTimeout(() => { if (Date.now() - lastScanAt > 60000) fullScan("q15"); scheduleQuarter(); }, ms);
}
function schedulePrice() {
  clearInterval(priceTimer);
  const sec = Number($("selPrice").value || 10);
  priceTimer = setInterval(refreshTickers, sec * 1000);
  clearInterval(liveTimer);
  liveTimer = setInterval(liveRefresh, 20000);
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
  if (perm === "granted") notify("SOLPHA", "Cảnh báo đã bật. Giữ app mở để quét mỗi 15 phút và realtime.");
  $("btnNotify").textContent = perm === "granted" ? "Cảnh báo đã bật" : "Trình duyệt chặn thông báo";
});
$("btnRefresh").addEventListener("click", () => fullScan("manual"));
$("selPrice").value = store.get("solpha_price_sec", "10");
$("selPrice").addEventListener("change", () => { store.set("solpha_price_sec", $("selPrice").value); schedulePrice(); });
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
if ("Notification" in window && Notification.permission === "granted") $("btnNotify").textContent = "Cảnh báo đã bật";
renderLogs(); schedulePrice(); scheduleQuarter(); renderTabs(); refreshTickers(true); fullScan("boot"); wsConnect();
// Quét ngay sau mỗi mốc 5 phút (+8s) để bắt từng nến 5M vừa đóng.
(function scheduleWatch() {
  const ms = 5 * 60 * 1000 - (Date.now() % (5 * 60 * 1000)) + 8000;
  setTimeout(() => { if (Date.now() - lastScanAt > 60000) fullScan("watch"); scheduleWatch(); }, ms); // WebSocket đã quét lúc nến đóng thì bỏ qua
})();

// ---- Cài đặt: vốn/rủi ro dùng chung; các điều kiện tín hiệu lưu riêng từng cặp ----
const SETTING_CHECKS = [["chkSetupA", "solpha_setupA"], ["chkSetupB", "solpha_setupB"], ["chkSetupS1", "solpha_setupS1"], ["chkSetupS2", "solpha_setupS2"], ["chkSetupS3", "solpha_setupS3"], ["chkCorrective", "solpha_corrective"], ["chkM4H", "solpha_m4h"], ["chkWalk", "solpha_walk"], ["chkSession", "solpha_session"]];
function syncSettingsUI() {
  for (const [id, key] of SETTING_CHECKS) if ($(id)) $(id).checked = pget(key, "1") === "1";
}
(function initSettings() {
  const share = (id, key, def) => {
    const el = $(id); if (!el) return;
    el.value = store.get(key, def);
    el.addEventListener("change", () => { store.set(key, el.value); fullScan("manual"); });
  };
  share("inpAcct", "solpha_acct", "");
  share("inpRisk", "solpha_risk", "1");
  for (const [id, key] of SETTING_CHECKS) {
    const el = $(id); if (!el) continue;
    el.addEventListener("change", () => { store.set(pkey(key), el.checked ? "1" : "0"); fullScan("manual", true); });
  }
  syncSettingsUI();
  // Giữ màn hình sáng: bind riêng (không quét lại khi đổi) vì phải xin khoá màn hình.
  const w = $("chkWake");
  if (w) { w.checked = store.get("solpha_wake", "0") === "1"; w.addEventListener("change", () => { store.set("solpha_wake", w.checked ? "1" : "0"); setWake(w.checked); }); if (w.checked) setWake(true); }
})();

// ---- Tab cặp, màn hình (thanh dưới), thêm / xoá cặp ----
function switchPair(sym) {
  if (!pairs.includes(baseOf(sym))) return;
  active = sym; store.set("solpha_active", sym);
  curDec = decOf(sym);
  syncSettingsUI(); renderPair(sym); renderTabs(); renderOptHint(); if (!wsOk()) refreshTickers(true);
  for (const id of ["btBox", "rpBox"]) if ($(id)) $(id).innerHTML = "";
  if (!stOf(sym).map) fullScan("manual", true);
}
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("hidden", v.dataset.view !== name));
  document.querySelectorAll("#botNav button").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
  store.set("solpha_view", name); window.scrollTo(0, 0);
}
function renderPairList() {
  $("pairList").innerHTML = pairs.map((b) => `<span class="pchip">${b}${pairs.length > 1 ? `<button data-rm="${b}" aria-label="Xoá ${b}">✕</button>` : ""}</span>`).join("");
}
async function addPair() {
  const raw = ($("addInput").value || "").trim().toUpperCase().replace(/USDT(\.P)?$/, ""), msg = $("addMsg");
  if (!/^[A-Z0-9]{2,12}$/.test(raw)) { msg.textContent = "Nhập mã coin hợp lệ, ví dụ BNB."; return; }
  if (pairs.includes(raw)) { msg.textContent = raw + " đã có trong danh sách."; return; }
  if (pairs.length >= 8) { msg.textContent = "Tối đa 8 cặp để quét kịp mỗi 5 phút."; return; }
  msg.textContent = "Đang kiểm tra " + raw + "USDT trên Binance…";
  try { await loadTicker(symOf(raw)); } catch (_) { msg.textContent = raw + "USDT không có trên Binance Futures."; return; }
  pairs.push(raw); store.set("solpha_pairs", JSON.stringify(pairs));
  $("addInput").value = ""; msg.textContent = "Đã thêm " + raw + ".";
  renderPairList(); switchPair(symOf(raw)); wsConnect();
}
function removePair(b) {
  if (pairs.length <= 1 || !pairs.includes(b)) return;
  pairs = pairs.filter((x) => x !== b); store.set("solpha_pairs", JSON.stringify(pairs));
  delete state[symOf(b)];
  renderPairList(); wsConnect();
  if (active === symOf(b)) switchPair(symOf(pairs[0])); else renderTabs();
}
$("pairBar").addEventListener("click", (e) => {
  const t = e.target.closest(".ptab"); if (!t) return;
  if (t.id === "btnAddPair") { $("addPanel").classList.toggle("hidden"); renderPairList(); return; }
  switchPair(t.dataset.sym);
});
$("btnAddPair2").addEventListener("click", addPair);
$("addInput").addEventListener("keydown", (e) => { if (e.key === "Enter") addPair(); });
$("pairList").addEventListener("click", (e) => { const b = e.target.closest("[data-rm]"); if (b) removePair(b.dataset.rm); });
$("botNav").addEventListener("click", (e) => { const b = e.target.closest("button[data-view]"); if (b) showView(b.dataset.view); });
renderPairList();
showView(store.get("solpha_view", "signal"));

// ---- Backtest: đo từng bộ điều kiện (Long A/B, Short S1/S2/S3, điều chỉnh, Momentum) trên dữ liệu thật của Binance ----
$("btnBacktest").addEventListener("click", async () => {
  const btn = $("btnBacktest"), out = $("btBox");
  const sym = active;
  btn.disabled = true; out.innerHTML = `Đang tải ~1.500 nến 5M và khung lớn của ${baseOf(sym)} từ Binance…`;
  try {
    const [c5, h1, h4, d1, m15] = await Promise.all([loadKlines(sym, "5m", 1500), loadKlines(sym, "1h", 400), loadKlines(sym, "4h", 300), loadKlines(sym, "1d", 200), loadKlines(sym, "15m", 700)]);
    const closed = (a) => a.slice(0, -1);
    const base = sigOptions(sym);
    const rows = [
      ["LONG A + B", { ...base, only: "long" }],
      ["LONG chỉ A", { ...base, only: "long", setups: { A: true, B: false } }],
      ["LONG chỉ B", { ...base, only: "long", setups: { A: false, B: true } }],
      ["LONG chặn cứng 1H BB", { ...base, only: "long", allowBandWalk: false }],
      ["SHORT S1 + S2 + S3 (tất cả)", { ...base, only: "short", setups: { S1: true, S2: true, S3: true } }],
      ["SHORT thuận xu hướng", { ...base, only: "short", shortRegime: "trend" }],
      ["SHORT điều chỉnh (1D còn tăng)", { ...base, only: "short", shortRegime: "corrective", allowCorrective: true }],
      ["MOMENTUM 4H/1H · SHORT", { ...base, engine: "m4h", only: "short", allowMomentum4H: true }],
      ["SHORT chỉ S1 (hồi bị từ chối)", { ...base, only: "short", setups: { S1: true, S2: false, S3: false } }],
      ["SHORT chỉ S2 (thủng đáy)", { ...base, only: "short", setups: { S1: false, S2: true, S3: false } }],
      ["SHORT chỉ S3 (1H BB trên thất bại)", { ...base, only: "short", setups: { S1: false, S2: false, S3: true } }]
    ].map(([name, o]) => [name, SolphaSignals.backtest(closed(c5), closed(h1), closed(h4), closed(d1), o, 5, closed(m15))]);
    const r0 = rows[0][1];
    const day = (t) => new Date(t).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    out.innerHTML = `<div class="muted"><b>${baseOf(sym)}</b> · từ ${day(r0.from)} đến ${day(r0.to)} · vào ở giá đóng nến, chốt ở 1.5R; Long tối đa 4 giờ, Short tối đa 2 giờ. Nến chạm cả SL và TP tính là thua. Backtest Short bỏ qua bộ lọc funding (không có dữ liệu lịch sử).</div>
      <div class="table-wrap"><table><thead><tr><th>Bộ điều kiện</th><th>Số lệnh</th><th>Thắng</th><th>R TB/lệnh</th><th>Tổng R</th><th>Sụt tối đa</th></tr></thead><tbody>${rows.map(([n, r]) =>
        `<tr><td><b>${n}</b></td><td>${r.n}</td><td>${r.n ? Math.round(r.winRate * 100) + "%" : "—"}</td><td class="${r.avgR >= 0 ? "up" : "down"}">${r.n ? (r.avgR >= 0 ? "+" : "") + fmt(r.avgR) : "—"}</td><td class="${r.totalR >= 0 ? "up" : "down"}">${(r.totalR >= 0 ? "+" : "") + fmt(r.totalR, 1)}R</td><td>${fmt(r.maxDD, 1)}R</td></tr>`).join("")}</tbody></table></div>
      ${[["LONG", "LONG A + B"], ["SHORT", "SHORT S1 + S2 + S3 (tất cả)"], ["SHORT điều chỉnh", "SHORT điều chỉnh (1D còn tăng)"], ["MOMENTUM 4H/1H SHORT", "MOMENTUM 4H/1H · SHORT"]].map(([n, k]) => [n, rows.find((x) => x[0] === k)[1]]).map(([n, r]) => r.topWhy && r.topWhy.length ? `<div class="muted"><b>${n}</b> bị loại nhiều nhất vì: ${r.topWhy.slice(0, 3).map(([w, c]) => `${w} (${c} nến)`).join(" · ")}</div>` : "").join("")}
      <div class="muted">Khoảng 5 ngày là mẫu nhỏ — chạy lại mỗi tuần và chỉ tin khi xu hướng lặp lại. Chưa tính phí giao dịch và trượt giá.</div>`;
  } catch (e) { out.textContent = "Lỗi backtest: " + (e.message || e); }
  btn.disabled = false;
});

// ---- Soi lại thời điểm: từng nến 5M quanh mốc anh chọn, app quyết định gì và vì sao ----
(function initReplay() {
  const inp = $("rpTime"), btn = $("btnReplay"), out = $("rpBox");
  if (!inp) return;
  const pad = (n) => String(n).padStart(2, "0");
  // Ô nhập luôn hiểu là giờ Việt Nam (UTC+7), không phụ thuộc múi giờ của máy.
  const VN = 7 * 3600000;
  const d = new Date(Date.now() + VN - 3 * 3600000);
  inp.value = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`;
  const parseVN = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || ""); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - VN : NaN; };
  const arrow = (x) => (x === "tang" ? "↑" : x === "giam" ? "↓" : "–");
  const hm = (t) => new Date(t).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" });
  const cell = (r) => r.side ? `<span class="tag ${r.side === "long" ? "tang" : "giam"}">${r.side.toUpperCase()}${r.corrective ? " ĐC" : ""} ${r.setup}${r.momentum ? " ½" : ""}</span>` : `<span class="muted">${(r.why[0] || "—")}</span>`;
  btn.addEventListener("click", async () => {
    const T = parseVN(inp.value);
    if (!Number.isFinite(T)) { out.textContent = "Chọn ngày giờ hợp lệ."; return; }
    const from = T - 30 * 60000, to = Math.min(T + 3 * 3600000, Date.now() - 5 * 60000), end = to + 5 * 60000;
    if (to <= from) { out.textContent = "Thời điểm này chưa có dữ liệu (ở tương lai hoặc vừa mới xảy ra)."; return; }
    const sym = active;
    btn.disabled = true; out.textContent = `Đang tải dữ liệu ${baseOf(sym)} quanh thời điểm này…`;
    try {
      const [c5, m15, h1, h4, d1] = await Promise.all([loadKlinesUntil(sym, "5m", 400, end), loadKlinesUntil(sym, "15m", 300, end), loadKlinesUntil(sym, "1h", 300, end), loadKlinesUntil(sym, "4h", 200, end), loadKlinesUntil(sym, "1d", 150, end)]);
      curDec = stOf(sym).dec != null ? stOf(sym).dec : tickDec(c5);
      const rows = SolphaSignals.replay(c5, h1, h4, d1, m15, from, to, sigOptions(sym));
      const hits = rows.filter((r) => r.main.side || r.mom.side);
      out.innerHTML = `<div class="muted"><b>${baseOf(sym)}</b> · ${rows.length} nến 5M từ ${hm(from)} đến ${hm(to)} (giờ VN). ${hits.length ? "Có tín hiệu lúc: " + hits.map((r) => `<b>${hm(r.t)}</b> ${r.main.side ? r.main.side.toUpperCase() + " " + r.main.setup : ""}${r.mom.side ? " " + r.mom.side.toUpperCase() + " M4H" : ""}`).join(" · ") : "<b>Không có tín hiệu nào</b> — xem cột lý do bên dưới."} Bộ lọc funding không áp dụng khi xem lại.</div>
        <div class="table-wrap rpwrap"><table><thead><tr><th>Giờ</th><th>Mở → Đóng</th><th>1D 4H 1H 15M</th><th>Bộ chính</th><th>Momentum 4H/1H</th></tr></thead><tbody>${rows.map((r) =>
          `<tr class="${r.main.side || r.mom.side ? "rphit" : ""}"><td><b>${hm(r.t)}</b></td><td>${fp(r.o)} → ${fp(r.c)}</td><td>${arrow(r.dirs.d1)} ${arrow(r.dirs.h4)} ${arrow(r.dirs.h1)} ${arrow(r.dirs.m15)}</td><td>${cell(r.main)}</td><td>${cell(r.mom)}</td></tr>`).join("")}</tbody></table></div>`;
    } catch (e) { out.textContent = "Lỗi tải dữ liệu: " + (e.message || e); }
    btn.disabled = false;
  });
})();

// ---- Tối ưu 30 ngày: đo từng điều kiện trên dữ liệu Binance thật, chỉ giữ điều kiện đạt chuẩn ----
async function loadHistory(sym, interval, minutes, days, warmup) {
  const need = Math.ceil(days * 1440 / minutes) + warmup, out = [];
  let end = Date.now();
  while (out.length < need) {
    const batch = await loadKlinesUntil(sym, interval, 1500, end);
    if (!batch.length) break;
    const fresh = batch.filter((k) => !out.length || k.t < out[0].t);
    if (!fresh.length) break;
    out.unshift(...fresh);
    end = fresh[0].t - 1;
    if (batch.length < 500) break; // hết lịch sử (nguồn spot trả tối đa 1000)
  }
  return out.slice(-need);
}
const OPT_RULES = { minTrades: 6, minWin: 0.5, minAvgR: 0 };
const OPT_ITEMS = [
  { key: "solpha_setupA", name: "LONG Setup A (pullback)", opt: { only: "long", setups: { A: true, B: false } } },
  { key: "solpha_setupB", name: "LONG Setup B (bứt phá sau nén)", opt: { only: "long", setups: { A: false, B: true } } },
  { key: "solpha_setupS1", name: "SHORT S1 (hồi bị từ chối)", opt: { only: "short", shortRegime: "trend", setups: { S1: true, S2: false, S3: false } } },
  { key: "solpha_setupS2", name: "SHORT S2 (thủng đáy)", opt: { only: "short", shortRegime: "trend", setups: { S1: false, S2: true, S3: false } } },
  { key: "solpha_setupS3", name: "SHORT S3 (1H BB trên thất bại)", opt: { only: "short", shortRegime: "trend", setups: { S1: false, S2: false, S3: true } } },
  { key: "solpha_corrective", name: "SHORT điều chỉnh (1D còn tăng)", opt: { only: "short", shortRegime: "corrective", allowCorrective: true, setups: { S1: true, S2: false, S3: true } } },
  { key: "solpha_m4h", name: "SHORT Momentum 4H/1H", opt: { only: "short", engine: "m4h", allowMomentum4H: true } }
];
let optResult = null;
$("btnOptimize") && $("btnOptimize").addEventListener("click", async () => {
  const btn = $("btnOptimize"), out = $("optBox"), tick = () => new Promise((r) => setTimeout(r, 0)), sym = active, coin = baseOf(sym);
  btn.disabled = true;
  try {
    out.textContent = `Đang tải 30 ngày dữ liệu ${coin} (5M, 15M, 1H, 4H, 1D)…`;
    const [c5, m15, h1, h4, d1] = await Promise.all([loadHistory(sym, "5m", 5, 30, 120), loadHistory(sym, "15m", 15, 30, 120), loadHistory(sym, "1h", 60, 30, 300), loadHistory(sym, "4h", 240, 30, 200), loadHistory(sym, "1d", 1440, 30, 150)]);
    const closed = (a) => a.slice(0, -1), base = { ...sigOptions(sym), sessionFilter: true, allowBandWalk: true };
    const run = (o) => SolphaSignals.backtest(closed(c5), closed(h1), closed(h4), closed(d1), { ...base, ...o }, 5, closed(m15));
    const mid = c5[Math.floor(c5.length / 2)].t;
    const half = (r, first) => { const t = r.trades.filter((x) => (first ? x.t < mid : x.t >= mid)); return t.length ? t.reduce((s, x) => s + x.r, 0) / t.length : null; };
    const rows = [];
    for (const it of OPT_ITEMS) {
      out.textContent = `Đang đo: ${it.name}…`; await tick();
      const r = run(it.opt);
      const pass = r.n >= OPT_RULES.minTrades && r.winRate >= OPT_RULES.minWin && r.avgR > OPT_RULES.minAvgR;
      rows.push({ ...it, r, pass, h1: half(r, true), h2: half(r, false) });
    }
    // Bộ lọc dùng chung: chỉ bật nếu giúp kết quả tốt hơn trên tập điều kiện đạt chuẩn.
    const keepOpt = (setups) => ({ setups, allowCorrective: setups.__corr, allowMomentum4H: setups.__m4h });
    const chosen = rows.filter((x) => x.pass);
    const setOn = { A: false, B: false, S1: false, S2: false, S3: false, __corr: false, __m4h: false };
    for (const x of chosen) ({ solpha_setupA: () => (setOn.A = true), solpha_setupB: () => (setOn.B = true), solpha_setupS1: () => (setOn.S1 = true), solpha_setupS2: () => (setOn.S2 = true), solpha_setupS3: () => (setOn.S3 = true), solpha_corrective: () => (setOn.__corr = true), solpha_m4h: () => (setOn.__m4h = true) })[x.key]();
    const filters = [];
    if (chosen.some((x) => x.key !== "solpha_m4h")) {
      for (const [key, name, field] of [["solpha_walk", "Cho vào khi 1H/4H bám dải", "allowBandWalk"], ["solpha_session", "Tránh giờ funding / tin / thanh khoản thấp", "sessionFilter"]]) {
        out.textContent = `Đang đo bộ lọc: ${name}…`; await tick();
        const on = run({ ...keepOpt(setOn), [field]: true }), off = run({ ...keepOpt(setOn), [field]: false });
        filters.push({ key, name, on, off, keep: on.n && (!off.n || on.avgR >= off.avgR) });
      }
    }
    optResult = { sym, rows, filters, at: Date.now(), from: c5[0].t, to: c5[c5.length - 1].t };
    const pct = (x) => Math.round(x * 100) + "%", r2 = (x) => (x == null ? "—" : (x >= 0 ? "+" : "") + fmt(x));
    const day = (t) => new Date(t).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    const sorted = rows.slice().sort((a, b) => (b.pass - a.pass) || (b.r.winRate - a.r.winRate) || (b.r.avgR - a.r.avgR));
    out.innerHTML = `<div class="muted"><b>${coin}</b> · dữ liệu ${day(optResult.from)} → ${day(optResult.to)} · đã trừ phí ${(SolphaSignals.DEFAULTS.feeRate * 100).toFixed(2)}%/lệnh · đạt chuẩn = ≥ ${OPT_RULES.minTrades} lệnh, thắng ≥ ${pct(OPT_RULES.minWin)}, R TB sau phí &gt; 0. "Nửa đầu / nửa sau" để xem có ổn định không.</div>
      <div class="table-wrap"><table><thead><tr><th>Điều kiện</th><th>Lệnh</th><th>Thắng</th><th>R TB</th><th>Tổng R</th><th>Nửa đầu / sau</th><th>Kết luận</th></tr></thead><tbody>${sorted.map((x) =>
        `<tr><td><b>${x.name}</b></td><td>${x.r.n}</td><td>${x.r.n ? pct(x.r.winRate) : "—"}</td><td class="${x.r.avgR >= 0 ? "up" : "down"}">${x.r.n ? r2(x.r.avgR) : "—"}</td><td>${r2(x.r.totalR)}R</td><td>${r2(x.h1)} / ${r2(x.h2)}</td><td>${x.pass ? '<span class="tag tang">GIỮ</span>' : '<span class="tag in">TẮT</span>'}</td></tr>`).join("")}</tbody></table></div>
      ${filters.map((f) => `<div class="muted">${f.name}: bật ${f.on.n} lệnh, R TB ${r2(f.on.avgR)} · tắt ${f.off.n} lệnh, R TB ${r2(f.off.avgR)} → <b>${f.keep ? "BẬT" : "TẮT"}</b></div>`).join("")}
      ${chosen.length ? `<div class="jactions"><button id="btnApplyOpt" class="btn primary">Áp dụng: chỉ giữ ${chosen.length} điều kiện đạt chuẩn</button></div>`
        : `<div class="muted"><b>Không điều kiện nào đạt chuẩn trong 30 ngày qua</b> — giữ nguyên cài đặt hiện tại, không tự tắt hết.</div>`}`;
    $("btnApplyOpt") && $("btnApplyOpt").addEventListener("click", () => {
      const o = optResult.sym;
      for (const x of optResult.rows) store.set(pkey(x.key, o), x.pass ? "1" : "0");
      for (const f of optResult.filters) store.set(pkey(f.key, o), f.keep ? "1" : "0");
      store.set(pkey("solpha_opt_applied", o), JSON.stringify({ at: Date.now(), keep: optResult.rows.filter((x) => x.pass).map((x) => x.name) }));
      if (o === active) syncSettingsUI();
      $("btnApplyOpt").textContent = "Đã áp dụng ✓"; $("btnApplyOpt").disabled = true;
      fullScan("manual", true);
    });
  } catch (e) { out.textContent = "Lỗi tối ưu: " + (e.message || e); }
  btn.disabled = false;
});
function renderOptHint() {
  let a = null; try { a = JSON.parse(pget("solpha_opt_applied", "null")); } catch (_) {}
  const box = $("optBox"); if (!box) return;
  box.innerHTML = a ? `<div class="muted">${baseOf(active)} · lần áp dụng gần nhất: ${new Date(a.at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} · đang giữ: ${a.keep.join(", ") || "—"}. Nên chạy lại mỗi tuần.</div>` : "";
}
renderOptHint();
$("btBox") && ($("btBox").innerHTML = "");

// ---- Gửi thông báo thử + chẩn đoán ----
$("btnTestNotify") && $("btnTestNotify").addEventListener("click", async () => {
  const out = $("notifyDiag"); out.textContent = "Đang gửi…";
  if ("Notification" in window && Notification.permission === "default") { try { await Notification.requestPermission(); } catch (_) {} }
  const perm = "Notification" in window ? Notification.permission : "không hỗ trợ";
  const sw = "serviceWorker" in navigator ? ((await navigator.serviceWorker.getRegistration()) ? "đã đăng ký" : "CHƯA đăng ký") : "không hỗ trợ";
  const res = await notify("SOLPHA — thông báo thử", "Nếu anh thấy dòng này trên khay thông báo và máy rung thì cảnh báo hoạt động.", "solpha-test");
  const standalone = window.matchMedia("(display-mode: standalone)").matches ? "đang chạy như app đã cài" : "đang chạy trong trình duyệt (chưa mở từ icon)";
  out.innerHTML = `Quyền: <b>${perm}</b> · Service worker: <b>${sw}</b> · Kết quả gửi: <b>${res}</b> · ${standalone}.<br>` +
    (perm === "granted" && res === "ok" ? "App đã gửi. <b>Không thấy thông báo / không rung</b> → lỗi nằm ở Android: Cài đặt → Ứng dụng → SOLPHA (hoặc Chrome) → Thông báo: bật, cho phép rung/âm thanh, mức độ ưu tiên cao; tắt Không làm phiền / chế độ im lặng; Pin → không hạn chế." :
     perm === "denied" ? "Thông báo đang bị chặn: Chrome → Cài đặt trang web → Thông báo → cho phép solpha.pages.dev." : "Bấm lại sau khi cho phép thông báo.");
});
