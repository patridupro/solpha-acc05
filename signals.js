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
    allowBandWalk: true,     // 1H chạm BB trên/dưới vẫn cho vào nếu đang "bám dải" (bứt phá thật)
    walkRsiMax: 75, walkRsiMin: 25, walkMaxExtATR: 0.5, walkSize: 0.5,
    setups: { A: true, B: true, S1: true, S2: true, S3: true },
    // Short (crypto giảm nhanh, hồi nông → bộ riêng, không đối xứng với Long)
    sMinATR: 1.2, sVol: 1.3, s2MinATR: 1.3, s2Vol: 1.5, s2Lookback: 12, sBounceLookback: 6,
    sSlATR: 0.3, sMaxRiskATR: 2.5, s2RsiMin: 20,
    sCrashATR: 3, sH1RsiMin: 25, fundingMin: -0.0003, sTimeStopBars: 24,
    allowCorrective: true, shortRegime: "all" // shortRegime: "all" | "trend" | "corrective" (dùng cho backtest)
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

  // Bám dải 1H: dải đang mở rộng (so với 3 nến trước), RSI chưa cực đoan, giá không vọt xa khỏi dải.
  function bandWalk(P1, idx, side, o) {
    const bb = P1.bb[idx], prev = P1.bb[idx - 3], rsi = P1.rsi[idx], atr = P1.atr[idx], c = P1.closes[idx];
    if (!bb || !prev || rsi == null || atr == null) return { ok: false, why: "thiếu dữ liệu 1H" };
    if (bb.width <= prev.width) return { ok: false, why: "dải BB 1H không mở rộng" };
    if (side === "long" && rsi > o.walkRsiMax) return { ok: false, why: `RSI 1H ${rsi.toFixed(0)} > ${o.walkRsiMax}` };
    if (side === "short" && rsi < o.walkRsiMin) return { ok: false, why: `RSI 1H ${rsi.toFixed(0)} < ${o.walkRsiMin}` };
    const ext = side === "long" ? (c - bb.upper) / atr : (bb.lower - c) / atr;
    if (ext > o.walkMaxExtATR) return { ok: false, why: `giá vọt ${ext.toFixed(1)}×ATR khỏi dải 1H` };
    return { ok: true };
  }
  // htf: { up, down, chaseUp: [labels], chaseDown: [labels], walkLong, walkShort: {ok, why}, h1Upper, h1Lower, h1RejectUpper }
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

    if (o.rule !== "fixed" && closeBottom) return evaluateShort(P, i, htf, tfMinutes, o, res);
    // 1) Độ lớn nến
    if (o.rule === "fixed") { if (range < o.fixedRange) res.why.push(`range ${range.toFixed(2)} < ${o.fixedRange}`); }
    else if (res.atrMult < o.atrMin) res.why.push(`range ${res.atrMult.toFixed(1)}×ATR < ${o.atrMin}`);
    else if (res.atrMult > o.atrMax) res.why.push(`nến quá lớn ${res.atrMult.toFixed(1)}×ATR (tin/thanh lý)`);
    if (res.why.length) return res;
    if (!dir) { res.why.push(`đóng giữa nến (${Math.round(pos * 100)}%)`); return res; }
    // 2) Xu hướng khung lớn
    if (dir === "long" && !htf.up) { res.why.push("1D/4H/1H chưa cùng tăng"); return res; }
    if (dir === "short" && !htf.down) { res.why.push("1D/4H/1H chưa cùng giảm"); return res; }
    // Chase: 4H/1D ở dải ngoài luôn chặn; riêng 1H được miễn nếu đang bám dải (lệnh Momentum, ½ khối lượng).
    const chase = dir === "long" ? (htf.chaseUp || []) : (htf.chaseDown || []);
    const walk = dir === "long" ? htf.walkLong : htf.walkShort;
    if (chase.length) {
      const onlyH1 = chase.length === 1 && chase[0] === "1H";
      if (onlyH1 && o.allowBandWalk && walk && walk.ok) res.momentum = true;
      else {
        const band = dir === "long" ? "BB trên" : "BB dưới";
        res.why.push(onlyH1 && o.allowBandWalk && walk ? `1H ở ${band} nhưng quá đà: ${walk.why}` : `đang chase ${band} (${chase.join(",")})`);
        return res;
      }
    }

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
    res.plan = { entries: [e1, e2, e3], entry, sl, tp1, tp2, risk, rr1: o.tp1R, rr2: Math.abs(tp2 - entry) / risk, slFromClose: Math.abs(e1 - sl), sizeFactor: res.momentum ? o.walkSize : 1 };
    return res;
  }

  // ---- SHORT: 1D/4H/1H giảm (xu hướng) + 15M giảm (đà) + 5M hồi lên rồi bị đạp xuống (điểm vào) ----
  // S3: 1H vừa chạm BB trên rồi thất bại · S1: hồi chạm EMA21/BB mid bị từ chối · S2: thủng đáy 12 nến (½ khối lượng).
  function evaluateShort(P, i, htf, tfMinutes, o, res) {
    const k = P.candles[i], atr = P.atr[i], bb = P.bb[i], e21 = P.ema21[i], rsi = P.rsi[i];
    const no = (w) => { res.why.push(w); return res; };
    if (res.atrMult > o.atrMax) return no(`nến quá lớn ${res.atrMult.toFixed(1)}×ATR (tin/thanh lý)`);
    if (res.atrMult < o.sMinATR) return no(`range ${res.atrMult.toFixed(1)}×ATR < ${o.sMinATR}`);
    // Xu hướng & đà
    // Chế độ: THUẬN XU HƯỚNG (1D/4H/1H giảm) hoặc ĐIỀU CHỈNH (1D còn tăng nhưng giá đã thủng BB mid 1D, 4H/1H giảm).
    let corrective = false;
    if (!htf.down) {
      const corrOk = htf.d1Dir === "tang" && htf.h4Dir === "giam" && htf.h1Dir === "giam" && htf.d1Mid != null && k.c < htf.d1Mid;
      if (!corrOk || !o.allowCorrective) {
        if (htf.d1Dir === "tang" && htf.h4Dir === "giam" && htf.h1Dir === "giam" && htf.d1Mid != null && k.c >= htf.d1Mid) return no("1D tăng, giá chưa thủng BB mid 1D");
        return no("1D/4H/1H chưa cùng giảm");
      }
      corrective = true;
    }
    if (o.shortRegime === "trend" && corrective) return no("chỉ đo short thuận xu hướng");
    if (o.shortRegime === "corrective" && !corrective) return no("chỉ đo short điều chỉnh");
    res.corrective = corrective;
    if (htf.m15Down === false) return no("15M chưa giảm");
    if (htf.h1Close != null && htf.h1Ema21 != null && htf.h1Close >= htf.h1Ema21) return no("giá 1H còn trên EMA21");
    // Bộ lọc riêng của Short
    if (htf.funding != null && htf.funding <= o.fundingMin) return no(`funding ${(htf.funding * 100).toFixed(3)}% quá âm (dễ bị ép short)`);
    if (htf.h1Rsi != null && htf.h1Rsi < o.sH1RsiMin) return no(`RSI 1H ${htf.h1Rsi.toFixed(0)} < ${o.sH1RsiMin} (quá bán)`);
    for (let j = i - 3; j < i; j++) { const x = P.candles[j], a = P.atr[j - 1]; if (a && x.h - x.l > o.sCrashATR * a) return no("vừa có cú sập lớn, chờ hồi"); } // so với ATR trước nến sập
    const chase = htf.chaseDown || [];
    if (chase.some((x) => x !== "1H")) return no(`đang chase BB dưới (${chase.join(",")})`);
    const h1AtLower = chase.includes("1H");
    if (h1AtLower && !(o.allowBandWalk && htf.walkShort && htf.walkShort.ok)) return no(`1H ở BB dưới nhưng quá đà${htf.walkShort ? ": " + htf.walkShort.why : ""}`);
    // Nhịp hồi trong 6 nến trước nến tín hiệu
    const prev = P.candles.slice(i - o.sBounceLookback, i);
    const bounceHigh = Math.max(...prev.map((x) => x.h), k.h);
    const touched = prev.some((x, j) => { const n = i - o.sBounceLookback + j; return x.h >= Math.min(P.ema21[n], P.bb[n].mid); });
    const prior12Low = Math.min(...P.candles.slice(i - o.s2Lookback, i).map((x) => x.l));
    // Ứng viên theo thứ tự ưu tiên S3 → S1 → S2; lấy setup đầu tiên có rủi ro hợp lệ (S1/S3 SL trên đỉnh hồi có thể quá xa trong khi S2 vẫn hợp lệ).
    const rsiOk = rsi >= o.rsiMin, rsi2Ok = rsi >= o.s2RsiMin; // S1/S3 vào sau nhịp hồi: RSI ≥ 25; S2 thủng đáy: ≥ 20
    const cands = [];
    if (o.setups.S3 && htf.h1RejectUpper && res.volMult >= o.sVol && k.c < e21 && rsiOk) cands.push(["S3", bounceHigh + o.sSlATR * atr]);
    if (o.setups.S1 && touched && k.c < e21 && res.volMult >= o.sVol && rsiOk) cands.push(["S1", bounceHigh + o.sSlATR * atr]);
    // Điều chỉnh: không dùng S2 — 1D còn tăng thì thủng đáy rất dễ là bẫy.
    if (o.setups.S2 && !corrective && k.c < prior12Low && res.atrMult >= o.s2MinATR && res.volMult >= o.s2Vol && rsi2Ok) cands.push(["S2", k.h + o.sSlATR * atr]);
    if (!cands.length) {
      if (!rsi2Ok || (!rsiOk && !(k.c < prior12Low))) return no(`RSI ${rsi.toFixed(0)} quá thấp`);
      if (res.volMult < o.sVol) return no(`volume ${res.volMult.toFixed(1)}× < ${o.sVol}×`);
      return no(touched ? "chưa đóng dưới EMA21" : "chưa có nhịp hồi chạm EMA21/BB mid, chưa thủng đáy 12 nến");
    }
    if (o.sessionFilter) { const s = sessionBlock(k.t + tfMinutes * 60000); if (s) return no(s); }
    if (h1AtLower) res.momentum = true;
    // Vào 3 phần: giá đóng / hồi 1/3 nến / EMA21 (hoặc +0.25 ATR nếu EMA21 xa hay ở dưới)
    const e1 = k.c, e2 = k.c + res.range / 3;
    let lastRisk = null;
    for (const [setup, sl] of cands) {
      let e3 = e21;
      if (e3 <= e2 || e3 - e2 > atr) e3 = e2 + 0.25 * atr;
      if (e3 >= sl) e3 = (e2 + sl) / 2;
      const entry = (e1 + e2 + e3) / 3, risk = sl - entry;
      if (risk <= 0 || risk > o.sMaxRiskATR * atr) { lastRisk = risk / atr; continue; }
      const tp1 = entry - o.tp1R * risk;
      let tp2 = entry - o.tp2R * risk;
      if (htf.h1Lower && htf.h1Lower < tp1 && htf.h1Lower > tp2) tp2 = htf.h1Lower;
      if (corrective && htf.d1Lower != null) {
        // Điều chỉnh: BB dưới 1D là vùng đỡ của xu hướng tăng → TP2 không vượt quá; TP1 cũng phải trước nó.
        if (tp1 <= htf.d1Lower) { return no(`TP1 vượt BB dưới 1D (${htf.d1Lower.toFixed(2)})`); }
        if (tp2 < htf.d1Lower) tp2 = htf.d1Lower;
      }
      res.setup = setup;
      res.side = "short";
      res.plan = { entries: [e1, e2, e3], entry, sl, tp1, tp2, risk, rr1: o.tp1R, rr2: (entry - tp2) / risk, slFromClose: sl - e1,
        sizeFactor: setup === "S2" || res.momentum || corrective ? o.walkSize : 1, timeStopBars: o.sTimeStopBars, partialTP1: 0.5, corrective };
      return res;
    }
    return no(`SL quá xa (${lastRisk.toFixed(1)}×ATR)`);
    return res;
  }

  // Kết quả lệnh sau tín hiệu: vào ở giá đóng, SL như kế hoạch nhưng tính từ giá đóng, TP = tp1R × rủi ro. Nến chạm cả 2 → tính SL (thận trọng).
  function outcome(candles, i, sig, tp1R, maxBars = (sig.plan && sig.plan.timeStopBars) || 48) {
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

  function backtest(c5, h1, h4, d1, opt, tfMinutes = 5, m15 = null) {
    const P = prepare(c5), L1 = htfLookup(h1, 60), L4 = htfLookup(h4, 240), LD = htfLookup(d1, 1440), L15 = m15 ? htfLookup(m15, 15) : null;
    const o = { ...DEFAULTS, ...opt };
    const trades = [], why = {};
    let busyUntil = -1;
    for (let i = 100; i < c5.length - 1; i++) {
      if (i <= busyUntil) continue; // không chồng lệnh
      const tClose = c5[i].t + tfMinutes * 60000;
      const a = L1(tClose), b = L4(tClose), d = LD(tClose);
      if (!a || !b || !d) continue;
      const chaseUp = [["1H", a], ["4H", b], ["1D", d]].filter(([, x]) => x.bb && x.bb.pctB >= 0.95).map(([n]) => n);
      const chaseDown = [["1H", a], ["4H", b], ["1D", d]].filter(([, x]) => x.bb && x.bb.pctB <= 0.05).map(([n]) => n);
      const walkLong = bandWalk(a.P, a.idx, "long", o), walkShort = bandWalk(a.P, a.idx, "short", o);
      let h1RejectUpper = false;
      for (let j = a.idx; j >= a.idx - 1; j--) if (a.P.bb[j] && a.P.candles[j].h >= a.P.bb[j].upper) h1RejectUpper = true;
      const htf = { up: a.dir === "tang" && b.dir === "tang" && d.dir === "tang", down: a.dir === "giam" && b.dir === "giam" && d.dir === "giam", chaseUp, chaseDown, walkLong, walkShort, h1Upper: a.bb && a.bb.upper, h1Lower: a.bb && a.bb.lower, h1RejectUpper,
        d1Dir: d.dir, h4Dir: b.dir, h1Dir: a.dir, d1Mid: d.bb && d.bb.mid, d1Lower: d.bb && d.bb.lower };
      const q = L15 && L15(tClose);
      htf.m15Down = q ? q.dir === "giam" : undefined;
      htf.h1Close = a.P.closes[a.idx]; htf.h1Ema21 = a.P.ema21[a.idx]; htf.h1Rsi = a.P.rsi[a.idx];
      htf.funding = null; // Binance không trả funding lịch sử theo nến → backtest bỏ qua bộ lọc funding
      const sig = evaluate(P, i, htf, tfMinutes, o);
      if (!sig.side) {
        // Chỉ đếm nến có hướng phù hợp (Long: đóng nửa trên; Short: đóng nửa dưới) để biết điều kiện nào chặn nhiều nhất.
        const side = sig.pos >= 0.5 ? "long" : "short";
        if (sig.why[0] && (!o.only || o.only === side)) { const w = sig.why[0].replace(/[-\d.]+/g, "#"); why[w] = (why[w] || 0) + 1; }
        continue;
      }
      if (o.only && sig.side !== o.only) continue;
      const out = outcome(c5, i, sig, o.tp1R);
      if (!out) continue;
      trades.push({ t: sig.t, side: sig.side, setup: sig.setup, ...out });
      busyUntil = i + out.bars;
    }
    const n = trades.length, wins = trades.filter((x) => x.r > 0).length;
    let eq = 0, peak = 0, dd = 0;
    for (const x of trades) { eq += x.r; peak = Math.max(peak, eq); dd = Math.max(dd, peak - eq); }
    const total = trades.reduce((s, x) => s + x.r, 0);
    const topWhy = Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { n, wins, winRate: n ? wins / n : 0, avgR: n ? total / n : 0, totalR: total, maxDD: dd, trades, topWhy,
      from: c5[100] && c5[100].t, to: c5[c5.length - 1] && c5[c5.length - 1].t };
  }

  const api = { DEFAULTS, prepare, evaluate, outcome, backtest, sessionBlock, bandWalk, atrArr, emaArr, rsiArr, bbArr };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SolphaSignals = api;
})(this);
