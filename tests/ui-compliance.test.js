// Kiểm tra giao diện theo kiểm toán tuân thủ Google Play: node --test tests/ui-compliance.test.js
// Cần Playwright (đặt NODE_PATH tới thư mục node_modules có "playwright") + Chromium; không có thì các ca trình duyệt được bỏ qua.
// Máy chủ tĩnh `python3 -m http.server` do chính test khởi động và tắt (cổng mặc định 8840, đổi bằng UI_TEST_PORT).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.UI_TEST_PORT || 8840);
const BASE = `http://localhost:${PORT}`;

let pw = null;
try { pw = require("playwright"); } catch (_) { try { pw = require("playwright-core"); } catch (_2) { pw = null; } }
const CHROMIUM = process.env.CHROMIUM_PATH || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const SKIP = pw ? false : "không tìm thấy Playwright (đặt NODE_PATH tới node_modules chứa playwright)";

// ---------- hạ tầng ----------
let server = null, browser = null;
const ping = () => new Promise((res) => { http.get(BASE + "/index.html", (r) => { r.resume(); res(r.statusCode === 200); }).on("error", () => res(false)); });
async function startServer() {
  if (await ping()) return; // đã có máy chủ phục vụ đúng thư mục này
  server = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
  for (let i = 0; i < 50; i++) { if (await ping()) return; await new Promise((r) => setTimeout(r, 100)); }
  throw new Error("không khởi động được máy chủ tĩnh");
}
test.before(async () => {
  if (SKIP) return;
  await startServer();
  browser = await pw.chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
});
test.after(async () => {
  if (browser) await browser.close();
  if (server) server.kill();
});

const UA = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
async function newCtx(seed = {}) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, userAgent: UA, permissions: ["notifications"] });
  await ctx.addInitScript((s) => {
    try { localStorage.setItem("solpha_risk_ack", "1"); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); } catch (_) {}
  }, seed);
  return ctx;
}

// ---------- dữ liệu Binance giả (chỉ để dựng giao diện; không phải giá thật) ----------
const MS = { "5m": 300000, "15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000 };
function candles(sym, interval, limit, endTime) {
  const step = MS[interval], end = Math.floor((endTime || Date.now()) / step) * step, out = [];
  let seed = 7;
  for (const ch of sym + interval) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const n = Math.min(limit, 1500);
  for (let i = 0; i < n; i++) {
    const idx = n - 1 - i, t = end - idx * step, p = 100 + Math.sin(i / (interval === "1d" ? 9 : 40)) * 8 + (rnd() - 0.5) * 1.2;
    const o = p + (rnd() - 0.5), c = p + (rnd() - 0.5), h = Math.max(o, c) + rnd() * 0.6, l = Math.min(o, c) - rnd() * 0.6;
    out.push([t, o.toFixed(2), h.toFixed(2), l.toFixed(2), c.toFixed(2), (100 + rnd() * 80).toFixed(1), t + step - 1]);
  }
  return out;
}
const CORS = { "access-control-allow-origin": "*", "content-type": "application/json" };
async function mockBinanceOk(ctx) {
  await ctx.route(/binance\.com/, (route) => {
    const u = new URL(route.request().url()), q = u.searchParams;
    if (/klines$/.test(u.pathname)) return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify(candles(q.get("symbol"), q.get("interval"), +q.get("limit") || 220, +q.get("endTime") || 0)) });
    if (/ticker\/24hr$/.test(u.pathname)) return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ lastPrice: "100.50", priceChangePercent: "1.25", highPrice: "104.0", lowPrice: "97.5" }) });
    if (/premiumIndex$/.test(u.pathname)) return route.fulfill({ status: 200, headers: CORS, body: JSON.stringify({ markPrice: "100.48", lastFundingRate: "0.00010000" }) });
    return route.abort();
  });
}
async function mockBinanceDown(ctx, mode, log) {
  await ctx.route(/binance\.com/, (route) => {
    log.push({ t: Date.now(), url: route.request().url() });
    if (mode === "451") return route.fulfill({ status: 451, headers: CORS, body: "{}" });
    return route.abort();
  });
}
// innerText (đúng như người dùng thấy, đã áp text-transform) + textContent gốc của toàn bộ <main> (trừ <details> "Chi tiết kỹ thuật" thu gọn).
const visibleText = (page) => page.evaluate(() => {
  const m = document.querySelector("main"), c = m.cloneNode(true);
  c.querySelectorAll("details.tech").forEach((d) => d.remove());
  return m.innerText + "\n" + c.textContent;
});
async function openTab(page, name) { await page.click(`#botNav button[data-view="${name}"]`); await page.waitForTimeout(150); }

// Chuỗi bị cấm trong giao diện hiển thị (lấy từ docs/audit/COMPLIANCE-AUDIT.md mục 3).
const FORBIDDEN = [
  [/mua khi|bán khi/i, "U1 mệnh lệnh mua/bán"],
  [/Vào ngay/, "U2 'Vào ngay'"],
  [/ĐANG GIỮ|ĐÃ CHẠM TP1/, "U3 'ĐANG GIỮ' / 'ĐÃ CHẠM TP1'"],
  [/không vào mới|đã vào thì giữ|giữ phần còn lại/i, "U3 chỉ dẫn quản lý lệnh"],
  [/Vào 3 phần|Stop [Ll]oss|Entry zone|Invalidation/, "U4 thuật ngữ trần"],
  [/chạm TP2 ✓|chạm SL ✗|chạm TP1.*✓|✓✓|✗/, "U6 kết quả ✓/✗"],
  [/BỎ LỠ|Bỏ lỡ|cân nhắc kỹ trước khi vào|xem kế hoạch lệnh/i, "U7 ngôn ngữ FOMO"],
  [/Ưu tiên|XEM LONG|XEM SHORT|KHÔNG CHASE|KHÔNG SHORT ĐÁY|Không chase/, "U9/U10 khuyến nghị"],
  [/đủ chuẩn/i, "U11 'đủ chuẩn'"],
  [/\bThắng\b/, "U12 cột 'Thắng'"],
  [/đạt chuẩn/i, "U13 'đạt chuẩn'"],
  [/\bGIỮ\b|\bTẮT\b|→ BẬT|→ TẮT/, "U14 GIỮ/TẮT"],
  [/Công cụ kiểm chứng|dữ liệu Binance thật/i, "U15 'kiểm chứng' / 'thật'"],
  [/Chỉ vào khi app đủ điều kiện|trừ điểm Kỷ luật|Kỷ luật theo chỉ báo/, "U17 hướng dẫn nhật ký"],
  [/Chưa tính phí/i, "U21 mâu thuẫn phí"],
  [/(^|\s)anh(\s|$)/i, "U22 xưng 'anh'"],
  [/CẢNH BÁO/, "U24 'CẢNH BÁO'"],
  [/Failed to fetch/, "U25 lỗi thô"]
];
function assertClean(text, where) {
  for (const [re, why] of FORBIDDEN) { const m = re.exec(text); assert.ok(!m, `${where}: còn chuỗi cấm (${why}): "${m && m[0]}"`); }
}

// Kế hoạch giả để hiện các trạng thái "kế hoạch còn hiệu lực" / "diễn biến giá của kế hoạch gần nhất".
function seededPlan(kind) {
  const now = Date.now(), tClose = kind === "hold" ? now - 3 * 60000 : now - 20 * 60000;
  const x = { side: "short", setup: "S1", key: "5m", label: "5M", t: tClose - 300000, o: 100, c: 99, plan: { entries: [100.2, 100.6, 101], entry: 100.6, sl: kind === "hold" ? 160 : 90, risk: 5, tp1: kind === "hold" ? 40 : 95, tp2: kind === "hold" ? 30 : 90, rr1: 1.5, rr2: 3, sizeFactor: 1, partialTP1: 0.5, timeStopBars: 48 } };
  return { solpha_last_plan: JSON.stringify({ x, exp: tClose + 15 * 60000 }), solpha_acct: "1000", solpha_risk: "1" };
}

// ============ (a) chuỗi cấm + bố cục + không lỗi JS, hai bản Play/web ============
for (const [label, query] of [["play", "/?source=play"], ["web", "/"]]) {
  test(`(a) ${label}: không còn chuỗi cấm ở Tín hiệu/Phân tích/Công cụ/Nhật ký/Cài đặt, không tràn ngang, không lỗi JS`, { skip: SKIP, timeout: 120000 }, async () => {
    for (const planKind of ["hold", "outcome"]) {
      const ctx = await newCtx(seededPlan(planKind));
      await mockBinanceOk(ctx);
      const page = await ctx.newPage(), errs = [];
      page.on("pageerror", (e) => errs.push(String(e)));
      await page.goto(BASE + query);
      await page.waitForFunction(() => document.querySelector("#actBox .act-side") && !/Đang quét/.test(document.querySelector("#actBox").innerText), null, { timeout: 30000 });
      const overflow = async (name) => {
        const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
        assert.ok(o.sw <= o.iw + 1, `${label}/${planKind}/${name}: tràn ngang ${o.sw} > ${o.iw}`);
      };
      // Tín hiệu
      let text = await visibleText(page); assertClean(text, `${label}/${planKind}/Tín hiệu`);
      if (planKind === "hold") assert.match(text, /KẾ HOẠCH CÒN HIỆU LỰC/, "phải hiện kế hoạch còn hiệu lực");
      if (planKind === "hold") assert.match(text, /Nếu dùng giá hiện tại .* làm điểm vào/, "U2 diễn đạt trung tính");
      if (planKind === "outcome") assert.match(text, /Kế hoạch gần nhất:.*giá đã chạm mức dừng lỗ/, "U6 diễn đạt trung tính");
      if (planKind === "hold") assert.match(text, /Giá trị do bạn nhập; app không biết hoàn cảnh tài chính của bạn/);
      await overflow("signal");
      // Phân tích
      await openTab(page, "analysis"); text = await visibleText(page); assertClean(text, `${label}/${planKind}/Phân tích`);
      assert.match(text, /Trạng thái điều kiện/i); await overflow("analysis");
      // Công cụ: chạy Backtest (mock) rồi Tối ưu (mock)
      await openTab(page, "tools");
      await page.click("#btnBacktest");
      await page.waitForFunction(() => /Lệnh có lãi \(mô phỏng\)/.test(document.querySelector("#btBox").innerText), null, { timeout: 60000 });
      text = await visibleText(page); assertClean(text, `${label}/${planKind}/Công cụ (Backtest)`);
      assert.match(text, /Đã trừ phí và trượt giá ước tính 0,08% mỗi lệnh/, "U21: nêu đúng phí từ DEFAULTS.feeRate");
      assert.match(text, /Kết quả quá khứ không bảo đảm kết quả tương lai/, "U20 cảnh báo đầu bảng");
      assert.match(text, /5 ngày/);
      await overflow("tools-backtest");
      if (planKind === "hold") {
        await page.click("#btnOptimize");
        await page.waitForFunction(() => /Ngưỡng/.test(document.querySelector("#optBox").innerText) || /Không chạy được/.test(document.querySelector("#optBox").innerText), null, { timeout: 90000 });
        text = await visibleText(page); assertClean(text, `${label}/Công cụ (Tối ưu)`);
        assert.match(text, /Đủ ngưỡng|Chưa đủ ngưỡng/); assert.match(text, /không phải bảo chứng hiệu quả/);
        await overflow("tools-optimize");
      }
      // Nhật ký
      await openTab(page, "journal"); text = await visibleText(page); assertClean(text, `${label}/${planKind}/Nhật ký`);
      assert.match(text, /Bạn tự đặt quy tắc vào\/ra lệnh/); await overflow("journal");
      // Cài đặt
      await openTab(page, "settings"); text = await visibleText(page); assertClean(text, `${label}/${planKind}/Cài đặt`);
      assert.match(text, /Điều kiện thuận xu hướng tăng/); await overflow("settings");
      assert.deepStrictEqual(errs, [], `${label}: lỗi JS: ${errs.join("; ")}`);
      await ctx.close();
    }
  });
}

// ============ (b) không còn request tới Google Fonts; chữ Việt dùng Roboto tự host ============
test("(b) không có request tới fonts.googleapis/gstatic; chữ Việt có dấu hiển thị bằng Roboto tự host", { skip: SKIP, timeout: 90000 }, async () => {
  for (const [label, query] of [["play", "/?source=play"], ["web", "/"], ["privacy", "/privacy.html"], ["terms", "/terms.html"]]) {
    const ctx = await newCtx(); await mockBinanceOk(ctx);
    const page = await ctx.newPage(), reqs = [];
    page.on("request", (r) => reqs.push(r.url()));
    await page.goto(BASE + query);
    await page.waitForTimeout(1500);
    await page.evaluate(() => Promise.all(["400 16px Roboto", "500 16px Roboto", "700 16px Roboto"].map((f) => document.fonts.load(f, "Việt Nam đồng ắ ề ổ ữ ặ ẳ"))));
    const r = await page.evaluate(() => ({
      ok: document.fonts.check("400 16px Roboto", "Tiếng Việt có dấu: ắ ề ổ ữ ặ ẳ đ Đ"),
      loaded: [...document.fonts].filter((f) => f.family.replace(/"/g, "") === "Roboto" && f.status === "loaded").map((f) => f.weight + ":" + f.unicodeRange.slice(0, 12)),
      html: document.documentElement.outerHTML
    }));
    const bad = reqs.filter((u) => /fonts\.(googleapis|gstatic)\.com|google/i.test(u));
    assert.deepStrictEqual(bad, [], `${label}: còn request tới Google: ${bad.join(", ")}`);
    assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(r.html), `${label}: DOM còn tham chiếu Google Fonts`);
    assert.ok(r.ok, `${label}: document.fonts.check Roboto thất bại`);
    assert.ok(r.loaded.length >= 1, `${label}: không có mặt phông Roboto nào đã tải (${JSON.stringify(r.loaded)})`);
    assert.ok(reqs.some((u) => /\/fonts\/roboto-vietnamese-\d+\.woff2/.test(u)), `${label}: không tải tệp roboto-vietnamese từ cùng origin`);
    await ctx.close();
  }
  for (const f of ["index.html", "privacy.html", "terms.html"]) assert.ok(!/fonts\.(googleapis|gstatic)/.test(fs.readFileSync(path.join(ROOT, f), "utf8")), `${f} còn link Google Fonts`);
  for (const sub of ["latin", "latin-ext", "vietnamese"]) for (const w of [400, 500, 700]) assert.ok(fs.existsSync(path.join(ROOT, `fonts/roboto-${sub}-${w}.woff2`)), `thiếu fonts/roboto-${sub}-${w}.woff2`);
  assert.match(fs.readFileSync(path.join(ROOT, "fonts/LICENSE.txt"), "utf8"), /SIL OPEN FONT LICENSE|Apache License/);
  const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
  assert.ok(/fonts\/roboto-vietnamese-400\.woff2/.test(sw), "sw.js chưa nạp sẵn font");
});

// ============ (c) Binance bị chặn / lỗi mạng: ít request, thông báo thân thiện, có nút thử lại ============
test("(c) mạng Binance lỗi hoàn toàn: <40 request trong 20 giây, thông báo thân thiện, không lộ 'Failed to fetch' ở giao diện chính", { skip: SKIP, timeout: 120000 }, async () => {
  const ctx = await newCtx(), log = [];
  await ctx.addInitScript(() => { const W = window.WebSocket; window.__ws = 0; window.WebSocket = function (u, p) { window.__ws++; return new W(u, p); }; window.WebSocket.prototype = W.prototype; Object.assign(window.WebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 }); });
  await mockBinanceDown(ctx, "abort", log);
  const page = await ctx.newPage();
  await page.goto(BASE + "/?source=play");
  await page.waitForFunction(() => /Không tải được dữ liệu từ Binance trên mạng này/.test(document.querySelector("#actBox").innerText), null, { timeout: 20000 });
  await page.waitForTimeout(20000); // đo trọn ~20 giây từ lúc mở app
  const ws = await page.evaluate(() => window.__ws);
  assert.ok(log.length + ws < 40, `quá nhiều request tới Binance trong ~20 giây: ${log.length} HTTP + ${ws} WebSocket`);
  const main = await visibleText(page);
  assert.match(main, /Không tải được dữ liệu từ Binance trên mạng này \(Binance chặn một số khu vực như Mỹ\)\. Thử mạng khác hoặc VPN\./);
  assert.match(main, /Thử lại ngay/);
  assert.ok(!/Failed to fetch/.test(main), "chuỗi thô 'Failed to fetch' lộ ra giao diện chính");
  // Chi tiết kỹ thuật nằm trong <details> thu gọn
  const det = await page.evaluate(() => { const d = document.querySelector("#actBox details.tech"); return d ? { open: d.open, text: d.textContent } : null; });
  assert.ok(det && det.open === false && /Failed to fetch/.test(det.text), "chi tiết kỹ thuật phải nằm trong <details> thu gọn");
  // Sang tab Phân tích cũng không lộ lỗi thô
  await openTab(page, "analysis"); assert.ok(!/Failed to fetch/.test(await visibleText(page)));
  // "Thử lại ngay" thật sự thử lại
  await openTab(page, "signal");
  const before = log.length;
  await page.click("#btnRetryNow");
  await page.waitForTimeout(2500);
  assert.ok(log.length > before, "nút 'Thử lại ngay' không phát request mới");
  await ctx.close();
});

test("(c2) Binance trả 451: hiện nhánh chặn khu vực, vẫn ít request", { skip: SKIP, timeout: 60000 }, async () => {
  const ctx = await newCtx(), log = []; await mockBinanceDown(ctx, "451", log);
  const page = await ctx.newPage();
  await page.goto(BASE + "/?source=play");
  await page.waitForFunction(() => /Binance không phục vụ mạng này/.test(document.querySelector("#actBox").innerText), null, { timeout: 20000 });
  await page.waitForTimeout(8000);
  assert.ok(log.length < 20, `451: ${log.length} request`);
  await ctx.close();
});

test("(c3) thiết bị offline: hiện 'Thiết bị đang offline'", { skip: SKIP, timeout: 60000 }, async () => {
  const ctx = await newCtx(), log = []; await mockBinanceDown(ctx, "abort", log);
  const page = await ctx.newPage();
  await page.goto(BASE + "/?source=play");
  // Mô phỏng offline bằng cờ navigator.onLine (offline thật làm chính trang không tải được)
  await page.evaluate(() => Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true }));
  await page.evaluate(() => { document.querySelector("#btnRefresh").click(); });
  await page.waitForFunction(() => /Thiết bị đang offline/.test(document.querySelector("#actBox").innerText), null, { timeout: 20000 });
  await ctx.close();
});

// ============ (d) nội dung thông báo đẩy không có giá vào/SL/TP ============
test("(d) showNotification: nội dung trung tính, không kèm giá vào/SL/TP", { skip: SKIP, timeout: 60000 }, async () => {
  const ctx = await newCtx(); await mockBinanceOk(ctx);
  await ctx.addInitScript(() => {
    window.__notes = [];
    const orig = ServiceWorkerRegistration.prototype.showNotification;
    ServiceWorkerRegistration.prototype.showNotification = function (title, opts) { window.__notes.push({ title, body: (opts && opts.body) || "" }); return orig.apply(this, arguments); };
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/?source=play");
  await page.waitForFunction(() => typeof notify === "function" && window.SolphaNotice);
  const plan = { side: "short", setup: "S1", engine: "main", plan: { entries: [101.23, 101.5, 101.8], sl: 103.45, tp1: 98.76, tp2: 95.12 } };
  const sent = await page.evaluate(async (x) => {
    const r = [];
    r.push(await notify("SOLPHA · SOL", SolphaNotice.signal("SOL", x), "t1"));
    r.push(await notify("SOLPHA · SOL", SolphaNotice.signal("SOL", { ...x, engine: "m4h" }), "t2"));
    r.push(await notify("SOLPHA · SOL", SolphaNotice.bands("SOL", "giam"), "t3"));
    r.push(await notify("SOLPHA · SOL", SolphaNotice.missed("SOL", 2), "t4"));
    return { r, notes: window.__notes };
  }, plan);
  assert.ok(sent.notes.length >= 4, "không bắt được thông báo nào (quyền/service worker?) " + JSON.stringify(sent.r));
  for (const n of sent.notes) {
    const all = n.title + " " + n.body;
    assert.ok(!/\d+[.,]\d+/.test(all), `thông báo chứa số giá: ${all}`);
    assert.ok(!/\b(SL|TP1|TP2|Stop|Entry)\b|vào\s+\d/.test(all), `thông báo chứa SL/TP/mức vào: ${all}`);
  }
  assert.match(sent.notes[0].body, /^SOL: có nến đủ điều kiện quy tắc \(Short S1\) — mở app để xem kế hoạch tham khảo$/);
  // Không có đường nào trong app.js đưa giá vào lời gọi notify().
  const src = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  const calls = src.split("\n").filter((l) => /\bawait notify\(|\bnotify\(/.test(l) && !/^(async )?function notify/.test(l.trim()));
  assert.ok(calls.length >= 4);
  for (const l of calls) assert.ok(!/fp\(|\.sl\b|\.tp[12]\b|entries|summary|\bmsg\b/.test(l), "lời gọi notify() có thể kèm mức giá: " + l.trim());
  await ctx.close();
});
