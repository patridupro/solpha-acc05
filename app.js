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
let lastAlertKey = store.get("solpha_last_alert", "");
let lastTriggerKey = store.get("solpha_last_trigger", "");
let lastFunding = null;
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
    if (data && data.lastFundingRate != null) lastFunding = Number(data.lastFundingRate);
    if (data && data.lastFundingRate != null) $("funding").textContent = (Number(data.lastFundingRate) * 100).toFixed(4) + "%";
  } catch (_) {}
}
async function loadKlines(interval, limit = 220) {
  const { data } = await withBase(`/api/v3/klines?symbol=SOLUSDT&interval=${interval}&limit=${Math.min(limit, 1000)}`, `/fapi/v1/klines?symbol=SOLUSDT&interval=${interval}&limit=${limit}`);
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
  return { last, e9, e21, rsi: r, bb, dir, band, candles, macd: md };
}
// ---- Nến tín hiệu (bộ máy trong signals.js) ----
function sigOptions() {
  return {
    rule: store.get("solpha_rule", "atr"),
    sessionFilter: store.get("solpha_session", "1") === "1",
    allowBandWalk: store.get("solpha_walk", "1") === "1",
    allowCorrective: store.get("solpha_corrective", "1") === "1",
    allowMomentum4H: store.get("solpha_m4h", "1") === "1",
    setups: {
      A: store.get("solpha_setupA", "1") === "1", B: store.get("solpha_setupB", "1") === "1",
      S1: store.get("solpha_setupS1", "1") === "1", S2: store.get("solpha_setupS2", "1") === "1", S3: store.get("solpha_setupS3", "1") === "1"
    }
  };
}
function htfContext(map, align) {
  const h1 = map["1h"], P1 = SolphaSignals.prepare(h1.candles);
  let h1RejectUpper = false;
  for (let j = h1.candles.length - 2; j >= h1.candles.length - 3; j--) if (P1.bb[j] && h1.candles[j].h >= P1.bb[j].upper) h1RejectUpper = true;
  return {
    up: align.d1 === "tang" && align.h4 === "tang" && align.h1 === "tang",
    down: align.d1 === "giam" && align.h4 === "giam" && align.h1 === "giam",
    chaseUp: ["1h", "4h", "1d"].filter((k) => map[k].band === "upper").map((k) => k.toUpperCase()),
    chaseDown: ["1h", "4h", "1d"].filter((k) => map[k].band === "lower").map((k) => k.toUpperCase()),
    walkLong: SolphaSignals.bandWalk(P1, h1.candles.length - 2, "long", { ...SolphaSignals.DEFAULTS, ...sigOptions() }),
    walkShort: SolphaSignals.bandWalk(P1, h1.candles.length - 2, "short", { ...SolphaSignals.DEFAULTS, ...sigOptions() }),
    h1Upper: h1.bb && h1.bb.upper, h1Lower: h1.bb && h1.bb.lower, h1RejectUpper,
    m15Down: align.m15 === "giam",
    d1Dir: align.d1, h4Dir: align.h4, h1Dir: align.h1,
    d1Mid: map["1d"].bb && map["1d"].bb.mid, d1Lower: map["1d"].bb && map["1d"].bb.lower,
    h1Close: h1.candles[h1.candles.length - 2].c, h1Ema21: P1.ema21[h1.candles.length - 2], h1Rsi: P1.rsi[h1.candles.length - 2],
    funding: lastFunding
  };
}
function candleTrigger(map, align) {
  const htf = htfContext(map, align), opt = sigOptions();
  const P = {};
  const rows = [["5m", 5], ["15m", 15]].map(([key, min]) => {
    const candles = map[key].candles; P[key] = SolphaSignals.prepare(candles);
    return { key, label: key.toUpperCase(), ...SolphaSignals.evaluate(P[key], candles.length - 2, htf, min, opt) };
  });
  // Momentum 4H/1H: không chờ 1D; 15M + 5M cùng hướng và cùng chạm BB (nến đã đóng).
  const j15 = map["15m"].candles.length - 2, c15 = map["15m"].candles[j15], b15 = P["15m"].bb[j15];
  const e9 = P["15m"].ema9[j15], e21 = P["15m"].ema21[j15];
  const m15 = { dir: e9 > e21 ? "tang" : e9 < e21 ? "giam" : "sideway", touchLower: !!b15 && c15.l <= b15.lower, touchUpper: !!b15 && c15.h >= b15.upper };
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
    return `<tr><td><b>${x.label}</b> ${time}</td><td>${fmt(x.o)} → ${fmt(x.c)}</td><td>${fmt(x.range)}${x.atrMult ? ` (${fmt(x.atrMult, 1)}×ATR)` : ""}</td><td>${x.volMult ? fmt(x.volMult, 1) + "×" : "—"}</td><td>${x.pos != null ? Math.round(x.pos * 100) + "%" : "—"}</td><td>${sig}</td><td class="muted">${x.side ? "Đủ điều kiện" : x.why.join(" · ") || "—"}</td></tr>`;
  }).join("");
}
// Ô Ưu tiên: kế hoạch lệnh của tín hiệu gần nhất (giữ 30 phút).
function planText(x) {
  const p = x.plan, acct = Number(store.get("solpha_acct", "0")), riskPct = Number(store.get("solpha_risk", "1")) * (p.sizeFactor || 1);
  const riskUsd = acct * riskPct / 100, qty = riskUsd && p.risk ? riskUsd / p.risk : 0;
  return {
    head: p.momentum4h ? `${x.side === "long" ? "LONG" : "SHORT"} MOMENTUM 4H/1H · 5M+15M chạm ${x.side === "long" ? "BB trên" : "BB dưới"} · ½ khối lượng${x.d1Against ? " · ⚠ ngược 1D" : ""}`
      : `${x.side === "long" ? "LONG" : "SHORT"}${p.corrective ? " ĐIỀU CHỈNH" : ""} · Setup ${x.setup} · ${x.label}${(p.sizeFactor || 1) < 1 ? " · ½ khối lượng" : ""}`,
    lines: [
      `Vào 3 phần: ${p.entries.map((e) => fmt(e)).join(" / ")} (TB ${fmt(p.entry)})`,
      `SL: ${fmt(p.sl)} (rủi ro ${fmt(p.risk)}/SOL)`,
      `TP1: ${fmt(p.tp1)} (R:R 1:${fmt(p.rr1, 1)}) → ${p.partialTP1 ? "chốt ½, " : ""}dời SL về giá vào`,
      `TP2: ${fmt(p.tp2)} (R:R 1:${fmt(p.rr2, 1)})`,
      qty ? `Khối lượng: ${fmt(qty, 2)} SOL ≈ $${fmt(qty * p.entry, 0)} · đòn bẩy ≈ ${fmt(qty * p.entry / acct, 1)}x (rủi ro $${fmt(riskUsd, 0)} = ${riskPct}% vốn), mỗi phần ${fmt(qty / 3, 2)} SOL`
          : "Nhập vốn ở mục Cài đặt để app tính khối lượng.",
      ...(p.timeStopBars ? [`Giới hạn thời gian: chưa chạm TP1 sau ${Math.round(p.timeStopBars * 5 / 60 * 10) / 10} giờ → thoát lệnh`] : []),
      ...(p.momentum4h ? ["Vào theo đà khi giá đang ở dải BB: dễ bị giật ngược — chỉ ½ khối lượng, không gồng lỗ, chạm SL là thoát."] : [])
    ]
  };
}
function renderPlan(trig) {
  const hit = trig.find((x) => x.side && x.key === "5m") || trig.find((x) => x.side && x.key === "15m") || trig.find((x) => x.side);
  if (hit) store.set("solpha_last_plan", JSON.stringify({ x: hit, exp: Date.now() + 30 * 60000 }));
  let saved = null;
  try { saved = JSON.parse(store.get("solpha_last_plan", "null")); } catch (_) {}
  const card = $("planCard");
  if (saved && saved.exp > Date.now()) {
    const t = planText(saved.x);
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
    return `<tr><td><b>${tf.label}</b></td><td><span class="tag ${a.dir}">${a.dir.toUpperCase()}</span></td><td>${fmt(a.rsi, 1)}</td><td>${emaTxt}</td><td>${a.macd ? `<span class="tag ${a.macd.dir}">${fmt(a.macd.hist, 3)}</span>` : "—"}</td><td>${a.bb ? fmt(a.bb.upper) : "—"}</td><td>${a.bb ? fmt(a.bb.mid) : "—"}</td><td>${a.bb ? fmt(a.bb.lower) : "—"}</td><td>${a.bb ? fmt(a.bb.pctB, 2) : "—"}</td><td><span class="tag ${a.band}">${bandLabel}</span></td></tr>`;
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
    if (!renderPlan(trig) && !fire) $("biasText").textContent = "WAIT";
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
    for (const x of trig.filter((t) => t.side)) {
      const key = `${x.key}-${x.t}-${x.side}`;
      if (key === lastTriggerKey) continue;
      lastTriggerKey = key;
      store.set("solpha_last_trigger", key);
      const p = x.plan;
      const msg = `${x.side.toUpperCase()}${x.engine === "m4h" ? " MOMENTUM 4H/1H (½ size" + (x.d1Against ? ", ngược 1D" : "") + ")" : ""}${x.corrective ? " ĐIỀU CHỈNH (½ size)" : ""} Setup ${x.setup} ${x.label}${x.momentum ? " (Momentum ½ size)" : ""} · vào ${fmt(p.entries[0])}/${fmt(p.entries[1])}/${fmt(p.entries[2])} · SL ${fmt(p.sl)} · TP1 ${fmt(p.tp1)} (1:${fmt(p.rr1, 1)}) · TP2 ${fmt(p.tp2)} (1:${fmt(p.rr2, 1)})`;
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

// ---- Cài đặt tín hiệu & quản lý vốn ----
(function initSettings() {
  const bind = (id, key, def, isCheck) => {
    const el = $(id); if (!el) return;
    if (isCheck) el.checked = store.get(key, def) === "1"; else el.value = store.get(key, def);
    el.addEventListener("change", () => { store.set(key, isCheck ? (el.checked ? "1" : "0") : el.value); fullScan("manual"); });
  };
  bind("inpAcct", "solpha_acct", "", false);
  bind("inpRisk", "solpha_risk", "1", false);
  bind("selRule", "solpha_rule", "atr", false);
  bind("chkSetupA", "solpha_setupA", "1", true);
  bind("chkSetupB", "solpha_setupB", "1", true);
  bind("chkSession", "solpha_session", "1", true);
  bind("chkWalk", "solpha_walk", "1", true);
  bind("chkSetupS1", "solpha_setupS1", "1", true);
  bind("chkSetupS2", "solpha_setupS2", "1", true);
  bind("chkSetupS3", "solpha_setupS3", "1", true);
  bind("chkCorrective", "solpha_corrective", "1", true);
  bind("chkM4H", "solpha_m4h", "1", true);
})();
// ---- Backtest: so bộ cũ ($0.55) với bộ mới (ATR + volume + Setup A/B) trên dữ liệu thật của Binance ----
$("btnBacktest").addEventListener("click", async () => {
  const btn = $("btnBacktest"), out = $("btBox");
  btn.disabled = true; out.innerHTML = "Đang tải ~1.500 nến 5M và khung lớn từ Binance…";
  try {
    const [c5, h1, h4, d1, m15] = await Promise.all([loadKlines("5m", 1500), loadKlines("1h", 400), loadKlines("4h", 300), loadKlines("1d", 200), loadKlines("15m", 700)]);
    const closed = (a) => a.slice(0, -1);
    const base = sigOptions();
    const rows = [
      ["Bộ cũ ($0.55) · 2 chiều", { ...base, rule: "fixed", sessionFilter: false }],
      ["LONG A + B", { ...base, rule: "atr", only: "long" }],
      ["LONG chỉ A", { ...base, rule: "atr", only: "long", setups: { A: true, B: false } }],
      ["LONG chỉ B", { ...base, rule: "atr", only: "long", setups: { A: false, B: true } }],
      ["LONG chặn cứng 1H BB", { ...base, rule: "atr", only: "long", allowBandWalk: false }],
      ["SHORT S1 + S2 + S3 (tất cả)", { ...base, rule: "atr", only: "short", setups: { S1: true, S2: true, S3: true } }],
      ["SHORT thuận xu hướng", { ...base, rule: "atr", only: "short", shortRegime: "trend" }],
      ["SHORT điều chỉnh (1D còn tăng)", { ...base, rule: "atr", only: "short", shortRegime: "corrective", allowCorrective: true }],
      ["MOMENTUM 4H/1H · LONG", { ...base, engine: "m4h", only: "long", allowMomentum4H: true }],
      ["MOMENTUM 4H/1H · SHORT", { ...base, engine: "m4h", only: "short", allowMomentum4H: true }],
      ["SHORT chỉ S1 (hồi bị từ chối)", { ...base, rule: "atr", only: "short", setups: { S1: true, S2: false, S3: false } }],
      ["SHORT chỉ S2 (thủng đáy)", { ...base, rule: "atr", only: "short", setups: { S1: false, S2: true, S3: false } }],
      ["SHORT chỉ S3 (1H BB trên thất bại)", { ...base, rule: "atr", only: "short", setups: { S1: false, S2: false, S3: true } }]
    ].map(([name, o]) => [name, SolphaSignals.backtest(closed(c5), closed(h1), closed(h4), closed(d1), o, 5, closed(m15))]);
    const r0 = rows[0][1];
    const day = (t) => new Date(t).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
    out.innerHTML = `<div class="muted">Từ ${day(r0.from)} đến ${day(r0.to)} · vào ở giá đóng nến, chốt ở 1.5R; Long tối đa 4 giờ, Short tối đa 2 giờ. Nến chạm cả SL và TP tính là thua. Backtest Short bỏ qua bộ lọc funding (không có dữ liệu lịch sử).</div>
      <div class="table-wrap"><table><thead><tr><th>Bộ điều kiện</th><th>Số lệnh</th><th>Thắng</th><th>R TB/lệnh</th><th>Tổng R</th><th>Sụt tối đa</th></tr></thead><tbody>${rows.map(([n, r]) =>
        `<tr><td><b>${n}</b></td><td>${r.n}</td><td>${r.n ? Math.round(r.winRate * 100) + "%" : "—"}</td><td class="${r.avgR >= 0 ? "up" : "down"}">${r.n ? (r.avgR >= 0 ? "+" : "") + fmt(r.avgR) : "—"}</td><td class="${r.totalR >= 0 ? "up" : "down"}">${(r.totalR >= 0 ? "+" : "") + fmt(r.totalR, 1)}R</td><td>${fmt(r.maxDD, 1)}R</td></tr>`).join("")}</tbody></table></div>
      ${[["LONG", rows[1][1]], ["SHORT", rows[5][1]], ["SHORT điều chỉnh", rows[7][1]], ["MOMENTUM 4H/1H SHORT", rows[9][1]]].map(([n, r]) => r.topWhy && r.topWhy.length ? `<div class="muted"><b>${n}</b> bị loại nhiều nhất vì: ${r.topWhy.slice(0, 3).map(([w, c]) => `${w.replace(/#/g, "x")} (${c})`).join(" · ")}</div>` : "").join("")}
      <div class="muted">Khoảng 5 ngày là mẫu nhỏ — chạy lại mỗi tuần và chỉ tin khi xu hướng lặp lại. Chưa tính phí giao dịch và trượt giá.</div>`;
  } catch (e) { out.textContent = "Lỗi backtest: " + (e.message || e); }
  btn.disabled = false;
});
