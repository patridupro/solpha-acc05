// Bộ máy tín hiệu nến 5M/15M — dùng chung cho quét trực tiếp và backtest.
// Candle: { t (open time ms), o, h, l, c, v }. Chỉ xét nến ĐÃ ĐÓNG.
(function (root) {
  const DEFAULTS = {
    rule: "atr",            // "atr" (bộ mới) | "fixed" (bộ cũ: range ≥ $0.55)
    fixedRange: 0.55,
    atrMin: 1.3, atrMax: 3,  // range nến tín hiệu theo bội số ATR(14)
    closeZone: 0.25,         // đóng ở 25% trên (long) / dưới (short)
    volMult: 1.5,            // volume ≥ 1.5 × SMA20
    rsiMax: 75, rsiMin: 25,  // không long khi RSI > 75, không short khi RSI < 25
    emaDistATR: 1.5,         // |close − EMA21| ≤ 1.5 × ATR
    pullbackLookback: 6,     // Setup A: trong 6 nến gần nhất đã chạm BB mid
    squeezePct: 0.2,         // Setup B: độ rộng BB ≤ phân vị 20% của 100 nến
    slATR: 0.5,              // SL = đáy/đỉnh nến tín hiệu ∓ 0.5 ATR
    maxRiskATR: 2,           // bỏ lệnh nếu (entry TB − SL) > 2 ATR
    tp1R: 1.5, tp2R: 3,
    sessionFilter: true,
    setups: { A: true, B: true }
  };

  const sma = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  function emaArr(values, p) {
    const out = new Array(values.length).fill(null);
    if (values.length < p) return out;
    const k = 2 / (p + 1);
    let e = sma(values.slice(0, p));
    out[p - 1] = e;
    for (let i = p; i < values.length; i++) { e = values[i] * k + e * (1 - k); out[i] = e; }
    return out;
  }
  function rsiArr(values, p = 14) {
    const out = new Array(values.length).fill(null);
    if (values.length < p + 1) return out;
    let g = 0, l = 0;
    for (let i = 1; i <= p; i++) { const d = values[i] - values[i - 1]; if (d >= 0) g += d; else l -= d; }
    let ag = g / p, al = l / p;
    out[p] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    for (let i = p + 1; i < values.length; i++) {
      const d = values[i] - values[i - 1];
      ag = (ag * (p - 1) + Math.max(d, 0)) / p; al = (al * (p - 1) + Math.max(-d, 0)) / p;
      out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    }
    return out;
  }
  function atrArr(c, p = 14) { // Wilder
    const out = new Array(c.length).fill(null);
    if (c.length < p + 1) return out;
    const tr = c.map((k, i) => (i === 0 ? k.h - k.l : Math.max(k.h - k.l, Math.abs(k.h - c[i - 1].c), Math.abs(k.l - c[i - 1].c))));
    let a = sma(tr.slice(1, p + 1));
    out[p] = a;
    for (let i = p + 1; i < c.length; i++) { a = (a * (p - 1) + tr[i]) / p; out[i] = a; }
    return out;
  }
  function bbArr(values, p = 20, m = 2) {
    return values.map((_, i) => {
      if (i < p - 1) return null;
      const s = values.slice(i - p + 1, i + 1), mid = sma(s);
      const sd = Math.sqrt(s.reduce((a, x) => a + (x - mid) ** 2, 0) / p);
      const upper = mid + m * sd, lower = mid - m * sd;
      return { mid, upper, lower, width: mid ? (upper - lower) / mid : 0, pctB: upper === lower ? 0.5 : (values[i] - lower) / (upper - lower) };
    });
  }
  // Tính sẵn chỉ báo cho cả chuỗi nến (gọi 1 lần, dùng cho mọi chỉ số i).
  function prepare(candles) {
    const closes = candles.map((k) => k.c);
    return { candles, closes, ema21: emaArr(closes, 21), rsi: rsiArr(closes, 14), atr: atrArr(candles, 14), bb: bbArr(closes, 20, 2), vol: candles.map((k) => k.v) };
  }

  // Giờ nhiễu (theo giờ ĐÓNG nến, UTC): funding 00/08/16 ±10', tin Mỹ 12:30/13:30 ±15', thanh khoản thấp 20:00–23:00 UTC (03–06h VN).
  function sessionBlock(closeMs) {
    const d = new Date(closeMs), m = d.getUTCHours() * 60 + d.getUTCMinutes();
    const near = (center, w) => Math.min(Math.abs(m - center), 1440 - Math.abs(m - center)) <= w;
    if ([0, 480, 960].some((x) => near(x, 10))) return "gần giờ funding";
    if ([750, 810].some((x) => near(x, 15))) return "giờ ra tin Mỹ";
    if (m >= 1200 && m < 1380) return "thanh khoản thấp (03–06h VN)";
    return null;
  }

  // htf: { up: bool, down: bool, chaseUp: [labels], h1Upper, h1Lower, h1RejectUpper: bool }
  function evaluate(P, i, htf, tfMinutes, opt) {
    const o = { ...DEFAULTS, ...opt, setups: { ...DEFAULTS.setups, ...(opt && opt.setups) } };
    const k = P.candles[i], atr = P.atr[i], bb = P.bb[i], prevBB = P.bb[i - 1], rsi = P.rsi[i], e21 = P.ema21[i];
    const res = { i, t: k.t, o: k.o, h: k.h, l: k.l, c: k.c, v: k.v, atr, rsi, side: null, setup: null, why: [], plan: null };
    if (atr == null || !bb || !prevBB || rsi == null || e21 == null || i < 100) { res.why.push("thiếu dữ liệu"); return res; }
    const range = k.h - k.l, pos = range > 0 ? (k.c - k.l) / range : 0.5;
    res.range = range; res.pos = pos; res.atrMult = range / atr;
    const volAvg = sma(P.vol.slice(i - 20, i)); res.volMult = volAvg ? k.v / volAvg : 0;
    const closeTop = pos >= 1 - o.closeZone, closeBottom = pos <= o.closeZone;
    const dir = closeTop ? "long" : closeBottom ? "short" : null;

    // 1) Độ lớn nến
    if (o.rule === "fixed") { if (range < o.fixedRange) res.why.push(`range ${range.toFixed(2)} < ${o.fixedRange}`); }
    else if (res.atrMult < o.atrMin) res.why.push(`range ${res.atrMult.toFixed(1)}×ATR < ${o.atrMin}`);
    else if (res.atrMult > o.atrMax) res.why.push(`nến quá lớn ${res.atrMult.toFixed(1)}×ATR (tin/thanh lý)`);
    if (res.why.length) return res;
    if (!dir) { res.why.push(`đóng giữa nến (${Math.round(pos * 100)}%)`); return res; }
    // 2) Xu hướng khung lớn
    if (dir === "long" && !htf.up) { res.why.push("1D/4H/1H chưa cùng tăng"); return res; }
    if (dir === "short" && !htf.down) { res.why.push("1D/4H/1H chưa cùng giảm"); return res; }
    if (dir === "long" && htf.chaseUp.length) { res.why.push(`đang chase BB trên (${htf.chaseUp.join(",")})`); return res; }

    if (o.rule === "fixed") {
      // Bộ cũ: short cần chạm/từ chối BB trên trong 3 nến gần nhất hoặc 2 nến 1H.
      if (dir === "short") {
        let touched = htf.h1RejectUpper;
        for (let j = i; j >= i - 2 && !touched; j--) if (P.bb[j] && P.candles[j].h >= P.bb[j].upper) touched = true;
        if (!touched) { res.why.push("chưa chạm/từ chối BB trên"); return res; }
      }
      res.setup = "cũ";
    } else {
      // 3) Volume
      if (res.volMult < o.volMult) { res.why.push(`volume ${res.volMult.toFixed(1)}× < ${o.volMult}×`); return res; }
      // 4) Chống đu đỉnh / bắt đáy
      if (dir === "long" && rsi > o.rsiMax) { res.why.push(`RSI ${rsi.toFixed(0)} > ${o.rsiMax}`); return res; }
      if (dir === "short" && rsi < o.rsiMin) { res.why.push(`RSI ${rsi.toFixed(0)} < ${o.rsiMin}`); return res; }
      // 5) Setup A (pullback lấy lại BB mid) / B (bứt phá sau nén)
      const look = P.candles.slice(i - o.pullbackLookback + 1, i + 1);
      const lookBB = P.bb.slice(i - o.pullbackLookback + 1, i + 1);
      const pulledBack = dir === "long" ? look.some((x, j) => x.l <= lookBB[j].mid) : look.some((x, j) => x.h >= lookBB[j].mid);
      const reclaimed = dir === "long" ? k.c > bb.mid : k.c < bb.mid;
      const widths = P.bb.slice(i - 100, i).filter(Boolean).map((b) => b.width).sort((a, b) => a - b);
      const squeeze = widths.length > 50 && prevBB.width <= widths[Math.floor(widths.length * o.squeezePct)];
      const broke = dir === "long" ? k.c > bb.upper : k.c < bb.lower;
      if (o.setups.B && squeeze && broke) res.setup = "B";      // B cụ thể hơn nên xét trước
      else if (o.setups.A && pulledBack && reclaimed) res.setup = "A";
      else { res.why.push(dir === "long" ? "không phải pullback-lấy lại BB mid / bứt phá sau nén" : "không phải hồi-từ chối BB mid / thủng sau nén"); return res; }
      // Nến bứt phá (B) tự nhiên đi xa EMA21 hơn nên được nới thêm 1 ATR.
      const maxDist = o.emaDistATR + (res.setup === "B" ? 1 : 0);
      if (Math.abs(k.c - e21) > maxDist * atr) { res.why.push(`cách EMA21 ${(Math.abs(k.c - e21) / atr).toFixed(1)}×ATR > ${maxDist}`); res.setup = null; return res; }
      // 6) Giờ nhiễu
      if (o.sessionFilter) { const s = sessionBlock(k.t + tfMinutes * 60000); if (s) { res.why.push(s); return res; } }
    }

    // Kế hoạch lệnh: 3 phần — giá đóng, hồi 50% nến, BB mid (hoặc sâu thêm 0.25 ATR nếu BB mid quá xa/ngược phía).
    const sgn = dir === "long" ? 1 : -1;
    const e1 = k.c, e2 = k.c - sgn * 0.5 * range;
    let e3 = bb.mid;
    if (sgn * (e2 - e3) <= 0 || Math.abs(e2 - e3) > atr) e3 = e2 - sgn * 0.25 * atr;
    const entry = (e1 + e2 + e3) / 3;
    const sl = dir === "long" ? k.l - o.slATR * atr : k.h + o.slATR * atr;
    const risk = Math.abs(entry - sl);
    if (risk > o.maxRiskATR * atr) { res.why.push(`SL quá xa (${(risk / atr).toFixed(1)}×ATR)`); return res; }
    const tp1 = entry + sgn * o.tp1R * risk;
    let tp2 = entry + sgn * o.tp2R * risk;
    // BB 1H là vùng cản: nếu nằm giữa TP1 và 3R thì chốt TP2 sớm tại đó.
    const h1Band = dir === "long" ? htf.h1Upper : htf.h1Lower;
    if (h1Band && sgn * (h1Band - tp1) > 0 && sgn * (tp2 - h1Band) > 0) tp2 = h1Band;
    res.side = dir;
    res.plan = { entries: [e1, e2, e3], entry, sl, tp1, tp2, risk, rr1: o.tp1R, rr2: Math.abs(tp2 - entry) / risk, slFromClose: Math.abs(e1 - sl) };
    return res;
  }

  // Kết quả lệnh sau tín hiệu: vào ở giá đóng, SL như kế hoạch nhưng tính từ giá đóng, TP = tp1R × rủi ro. Nến chạm cả 2 → tính SL (thận trọng).
  function outcome(candles, i, sig, tp1R, maxBars = 48) {
    const sgn = sig.side === "long" ? 1 : -1, entry = sig.c, sl = sig.plan.sl, risk = Math.abs(entry - sl), tp = entry + sgn * tp1R * risk;
    for (let j = i + 1; j < Math.min(candles.length, i + 1 + maxBars); j++) {
      const k = candles[j];
      const hitSL = sgn > 0 ? k.l <= sl : k.h >= sl, hitTP = sgn > 0 ? k.h >= tp : k.l <= tp;
      if (hitSL) return { r: -1, bars: j - i, exit: "SL" };
      if (hitTP) return { r: tp1R, bars: j - i, exit: "TP" };
    }
    const last = candles[Math.min(candles.length, i + 1 + maxBars) - 1];
    if (!last || i + 1 >= candles.length) return null; // chưa đủ dữ liệu sau tín hiệu
    return { r: (sgn * (last.c - entry)) / risk, bars: maxBars, exit: "Hết giờ" };
  }

  // Xu hướng / %B khung lớn tại thời điểm t, chỉ dùng nến khung lớn đã đóng trước t.
  function htfLookup(candles, tfMinutes) {
    const P = prepare(candles), e9 = emaArr(P.closes, 9);
    return (t) => {
      let lo = 0, hi = candles.length - 1, idx = -1;
      while (lo <= hi) { const mid = (lo + hi) >> 1; if (candles[mid].t + tfMinutes * 60000 <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1; }
      if (idx < 21) return null;
      const dir = e9[idx] > P.ema21[idx] ? "tang" : e9[idx] < P.ema21[idx] ? "giam" : "sideway";
      return { dir, bb: P.bb[idx], idx, P };
    };
  }

  function backtest(c5, h1, h4, d1, opt, tfMinutes = 5) {
    const P = prepare(c5), L1 = htfLookup(h1, 60), L4 = htfLookup(h4, 240), LD = htfLookup(d1, 1440);
    const o = { ...DEFAULTS, ...opt };
    const trades = [];
    let busyUntil = -1;
    for (let i = 100; i < c5.length - 1; i++) {
      if (i <= busyUntil) continue; // không chồng lệnh
      const tClose = c5[i].t + tfMinutes * 60000;
      const a = L1(tClose), b = L4(tClose), d = LD(tClose);
      if (!a || !b || !d) continue;
      const chaseUp = [["1H", a], ["4H", b], ["1D", d]].filter(([, x]) => x.bb && x.bb.pctB >= 0.95).map(([n]) => n);
      let h1RejectUpper = false;
      for (let j = a.idx; j >= a.idx - 1; j--) if (a.P.bb[j] && a.P.candles[j].h >= a.P.bb[j].upper) h1RejectUpper = true;
      const htf = { up: a.dir === "tang" && b.dir === "tang" && d.dir === "tang", down: a.dir === "giam" && b.dir === "giam" && d.dir === "giam", chaseUp, h1Upper: a.bb && a.bb.upper, h1Lower: a.bb && a.bb.lower, h1RejectUpper };
      const sig = evaluate(P, i, htf, tfMinutes, o);
      if (!sig.side) continue;
      const out = outcome(c5, i, sig, o.tp1R);
      if (!out) continue;
      trades.push({ t: sig.t, side: sig.side, setup: sig.setup, ...out });
      busyUntil = i + out.bars;
    }
    const n = trades.length, wins = trades.filter((x) => x.r > 0).length;
    let eq = 0, peak = 0, dd = 0;
    for (const x of trades) { eq += x.r; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
    const total = trades.reduce((s, x) => s + x.r, 0);
    return { n, wins, winRate: n ? wins / n : 0, avgR: n ? total / n : 0, totalR: total, maxDD: dd, trades,
      from: c5[100] && c5[100].t, to: c5[c5.length - 1] && c5[c5.length - 1].t };
  }

  const api = { DEFAULTS, prepare, evaluate, outcome, backtest, sessionBlock, atrArr, emaArr, rsiArr, bbArr };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SolphaSignals = api;
})(this);
