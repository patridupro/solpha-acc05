// Ghép ảnh chụp THẬT từ điện thoại thành ảnh cửa hàng Google Play 1080×1920 (dải phụ đề phía trên, nền #07080c).
// Không tạo ảnh từ dữ liệu giả: Play cấm ảnh gây hiểu nhầm — hãy chụp trên bản cài từ Internal testing, dữ liệu thật.
//
// Cách dùng:
//   1) Chụp 8 ảnh trên điện thoại theo docs/play/SCREENSHOT-PLAN.md, đặt tên 1.png … 8.png vào một thư mục (vd. shots/raw).
//   2) node tools/play-screenshots.js shots/raw shots/out [vi|en]
// Cần playwright + chromium (CHROMIUM_PATH nếu có sẵn).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const CAPTIONS = {
  vi: ["Giá futures realtime, 5 khung thời gian", "SOL, BTC, ETH, DOGE và cặp tuỳ chọn", "Chỉ báo EMA, BB, RSI, ATR, MACD", "Kế hoạch tham khảo theo quy tắc kỹ thuật",
    "Khối lượng theo vốn và % rủi ro của bạn", "Backtest và soi lại ngay trên máy", "Nhật ký giao dịch, tự chấm kỷ luật", "Quy tắc công khai. Không phải tư vấn."],
  en: ["Real-time futures prices, 5 timeframes", "SOL, BTC, ETH, DOGE and custom pairs", "EMA, BB, RSI, ATR and MACD indicators", "Reference plans from technical rules",
    "Size from your own capital and risk %", "Backtest and replay on your device", "Trading journal with discipline score", "Published rules. Not investment advice."]
};
const [, , inDir, outDir, lang = "vi"] = process.argv;
if (!inDir || !outDir || !CAPTIONS[lang]) { console.error("Dùng: node tools/play-screenshots.js <thư mục ảnh gốc> <thư mục ra> [vi|en]"); process.exit(1); }
const W = 1080, H = 1920, BAR = 230, MARGIN = 50;
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: W, height: H } });
  let made = 0;
  for (let i = 1; i <= 8; i++) {
    const src = ["png", "jpg", "jpeg"].map((e) => path.join(inDir, `${i}.${e}`)).find((f) => fs.existsSync(f));
    if (!src) { console.warn(`Thiếu ảnh ${i} (${inDir}/${i}.png) — bỏ qua`); continue; }
    const data = fs.readFileSync(src).toString("base64"), mime = src.endsWith(".png") ? "png" : "jpeg";
    const html = `<!doctype html><html><body style="margin:0;width:${W}px;height:${H}px;background:#07080c;font-family:Roboto,'Segoe UI',sans-serif;position:relative;overflow:hidden">
      <div style="position:absolute;left:0;right:0;top:0;height:${BAR}px;display:flex;align-items:center;justify-content:center;padding:0 ${MARGIN}px;text-align:center;color:#fff;font-weight:700;font-size:62px;line-height:1.15;background:linear-gradient(180deg,#0b0e16,#07080c)">${esc(CAPTIONS[lang][i - 1])}</div>
      <div style="position:absolute;left:${MARGIN}px;right:${MARGIN}px;top:${BAR}px;bottom:0;display:flex;align-items:flex-start;justify-content:center;overflow:hidden">
        <img src="data:image/${mime};base64,${data}" style="width:100%;border-radius:36px 36px 0 0;border:2px solid #1e2430;border-bottom:0;display:block">
      </div></body></html>`;
    await p.setContent(html); await p.waitForTimeout(120);
    const out = path.join(outDir, `${lang}-${i}.png`);
    await p.screenshot({ path: out }); console.log(out); made++;
  }
  await b.close();
  console.log(`Xong: ${made}/8 ảnh. Kiểm tra bằng mắt từng ảnh trước khi tải lên Play Console.`);
})();
