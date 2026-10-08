// Kiểm tra nhanh bộ máy tín hiệu: node tests/signals.test.js
const assert = require("assert");
const S = require("../signals.js");

// 1) Mọi tham số mặc định phải có giá trị (chống lỗi chú thích làm mất tham số).
for (const [k, v] of Object.entries(S.DEFAULTS)) assert.notStrictEqual(v, undefined, `DEFAULTS.${k} bị undefined`);
for (const k of ["sCrashATR", "sH1RsiMin", "fundingMin", "sTimeStopBars", "allowCorrective", "s2RsiMin", "walkSize"]) assert.ok(k in S.DEFAULTS, `thiếu DEFAULTS.${k}`);

// 2) Dữ liệu mẫu: xu hướng giảm có nhịp hồi chạm EMA21, nến đỏ lớn đóng sát đáy (Short S1).
const T0 = Date.UTC(2026, 9, 7, 2, 0), i = 148;
const c = Array.from({ length: 150 }, (_, j) => { const p = 140 - j * 0.04 + Math.sin(j / 3) * 0.6; return { t: T0 + (j - 150) * 300000, o: p + 0.05, h: p + 0.2, l: p - 0.2, c: p, v: 100 }; });
const P0 = S.prepare(c), atr = P0.atr[147], e = P0.ema21[147];
c[145] = { ...c[145], h: e + 0.15 };
c[i] = { t: c[i].t, o: e - 0.05, h: e, l: e - 1.5 * atr, c: e - 1.45 * atr, v: 220 };
const P = S.prepare(c);
const H = (x) => ({ up: false, down: true, d1Dir: "giam", h4Dir: "giam", h1Dir: "giam", chaseUp: [], chaseDown: [], walkShort: { ok: true }, m15Down: true, h1Close: 130, h1Ema21: 131, h1Rsi: 42, funding: 0.0001, h1Upper: 140, h1Lower: 100, h1RejectUpper: false, ...x });
const ev = (htf, o) => S.evaluate(P, i, htf, 5, o || {});

const s1 = ev(H({}));
assert.strictEqual(s1.side, "short"); assert.strictEqual(s1.setup, "S1");
assert.ok(Math.abs(s1.plan.tp1 - (s1.plan.entry - 1.5 * s1.plan.risk)) < 1e-9, "TP1 = giá vào − 1.5R");
assert.strictEqual(s1.plan.timeStopBars, 24);
assert.strictEqual(ev(H({ funding: -0.0005 })).side, null, "funding quá âm phải chặn");
assert.strictEqual(ev(H({ h1Rsi: 20 })).side, null, "RSI 1H < 25 phải chặn");
assert.strictEqual(ev(H({ chaseDown: ["4H"] })).side, null, "4H ở BB dưới phải chặn");
assert.strictEqual(ev(H({ m15Down: false })).side, null, "15M chưa giảm phải chặn");

// 3) Short điều chỉnh: 1D còn tăng, giá dưới BB mid 1D → ½ khối lượng; trên BB mid → chặn.
const close = c[i].c;
const corr = ev(H({ down: false, d1Dir: "tang", d1Mid: close + 2, d1Lower: close - 6 }));
assert.strictEqual(corr.side, "short"); assert.ok(corr.corrective); assert.strictEqual(corr.plan.sizeFactor, 0.5);
assert.strictEqual(ev(H({ down: false, d1Dir: "tang", d1Mid: close - 1, d1Lower: close - 6 })).side, null);
assert.strictEqual(ev(H({ down: false, d1Dir: "tang", d1Mid: close + 2, d1Lower: close - 6 }), { allowCorrective: false }).side, null);

console.log("signals.test.js: OK");

// 4) Momentum 4H/1H (không chờ 1D): 4H+1H giảm, 15M+5M giảm và cùng chạm BB dưới → SHORT ½ khối lượng.
{
  const T1 = Date.UTC(2026, 9, 8, 2, 0), n = 150, j = 148;
  const mkSeries = (sgn, slope = 0.03) => {
    const s = Array.from({ length: n }, (_, x) => { const p = 120 + sgn * x * slope + Math.sin(x / 2.5) * 0.25; return { t: T1 + (x - n) * 300000, o: p - sgn * 0.03, h: p + 0.12, l: p - 0.12, c: p, v: 100 }; });
    const P0 = S.prepare(s), b = P0.bb[j - 1], a = P0.atr[j - 1];
    // nến đã đóng xuyên dải ngoài theo hướng xu hướng nhưng không quá lớn
    s[j] = sgn < 0 ? { t: s[j].t, o: b.lower + 0.15, h: b.lower + 0.2, l: b.lower - 0.4 * a, c: b.lower - 0.3 * a, v: 180 }
                   : { t: s[j].t, o: b.upper - 0.15, l: b.upper - 0.2, h: b.upper + 0.4 * a, c: b.upper + 0.3 * a, v: 180 };
    return S.prepare(s);
  };
  const Pd = mkSeries(-1), Pu = mkSeries(1, 0.012);
  const Hm = (x) => ({ h4Dir: "giam", h1Dir: "giam", d1Dir: "tang", funding: 0.0001, ...x });
  const m15d = { dir: "giam", touchLower: true, touchUpper: false }, m15u = { dir: "tang", touchLower: false, touchUpper: true };
  const em = (P, m, h, o) => S.evaluateMomentum(P, j, m, h, 5, o || {});
  const sh = em(Pd, m15d, Hm({}));
  assert.strictEqual(sh.side, "short", "momentum short: " + sh.why.join(";")); assert.strictEqual(sh.plan.sizeFactor, 0.5); assert.ok(sh.d1Against);
  assert.ok(sh.plan.sl > sh.plan.entry && sh.plan.tp1 < sh.plan.entry);
  assert.strictEqual(sh.plan.timeStopBars, 12);
  assert.strictEqual(em(Pd, m15d, Hm({ h4Dir: "tang" })).side, null, "4H ngược phải chặn");
  assert.strictEqual(em(Pd, { ...m15d, touchLower: false }, Hm({})).side, null, "15M chưa chạm BB dưới phải chặn");
  assert.strictEqual(em(Pd, { ...m15d, dir: "tang" }, Hm({})).side, null, "15M ngược phải chặn");
  assert.strictEqual(em(Pd, m15d, Hm({ funding: -0.0005 })).side, null, "funding quá âm phải chặn");
  assert.strictEqual(em(Pd, m15d, Hm({}), { allowMomentum4H: false }).side, null, "tắt chế độ phải chặn");
  assert.strictEqual(em(Pu, m15u, Hm({ h4Dir: "tang", h1Dir: "tang" })).side, null, "momentum chỉ dùng cho short");
  assert.strictEqual(S.DEFAULTS.m4hRsiMin, 10);
}
console.log("momentum 4H/1H: OK");

// 5) 4H bám BB dưới (xu hướng giảm mạnh) không còn chặn cứng Short; 1D ở BB dưới vẫn chặn.
{
  const w = { ok: true }, bad = { ok: false, why: "RSI 4H 18 < 25" };
  assert.strictEqual(ev(H({ chaseDown: ["4H"], walk4hShort: w })).side, "short", "4H bám dải phải cho short");
  assert.strictEqual(ev(H({ chaseDown: ["4H"], walk4hShort: w })).plan.sizeFactor, 0.5, "4H bám dải → ½ khối lượng");
  assert.strictEqual(ev(H({ chaseDown: ["4H"], walk4hShort: bad })).side, null, "4H quá đà phải chặn");
  assert.strictEqual(ev(H({ chaseDown: ["1H", "4H"], walkShort: w, walk4hShort: w })).side, "short");
  assert.strictEqual(ev(H({ chaseDown: ["1D"], walk4hShort: w })).side, null, "1D ở BB dưới luôn chặn");
  assert.strictEqual(ev(H({ chaseDown: ["4H"], walk4hShort: w }), { allowBandWalk: false }).side, null);
}
console.log("4H band walk: OK");
