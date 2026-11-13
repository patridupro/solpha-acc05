// Tạo bộ ảnh cho trang Google Play: icon 512×512 (không trong suốt), feature graphic 1024×500,
// và ảnh chụp màn hình nháp 1080×1920 (dữ liệu giả lập — ảnh thật nên chụp từ điện thoại khi đang chạy dữ liệu thật).
// Chạy: node tools/play-assets.js   (cần playwright + chromium; CHROMIUM_PATH nếu có sẵn)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const OUT = "play-assets";
const svg = fs.readFileSync("icons/solpha/icon.svg", "utf8"); // thương hiệu SOLPHA (bản Play không dùng nhận diện ETEK)
const b64 = (s) => Buffer.from(s).toString("base64");
const feature = `<!doctype html><html><body style="margin:0;width:1024px;height:500px;background:#07080c;font-family:Roboto,Segoe UI,sans-serif;color:#e8edf7;position:relative;overflow:hidden">
  <div style="position:absolute;inset:0;background:radial-gradient(620px 340px at 8% -10%,rgba(62,203,255,.28),transparent 62%),radial-gradient(560px 320px at 96% 10%,rgba(155,92,255,.30),transparent 58%),radial-gradient(520px 260px at 70% 112%,rgba(198,255,58,.12),transparent 55%)"></div>
  <img src="data:image/svg+xml;base64,${b64(svg)}" style="position:absolute;left:64px;top:110px;width:200px;height:200px;border-radius:44px;box-shadow:0 14px 48px rgba(62,203,255,.22)">
  <div style="position:absolute;left:300px;top:112px">
    <div style="font-size:60px;font-weight:900;letter-spacing:.08em;line-height:1;background:linear-gradient(90deg,#3ecbff,#9b5cff);-webkit-background-clip:text;color:transparent">SOLPHA</div>
    <div style="font-size:26px;font-weight:600;margin-top:12px;color:#e8edf7">Futures Desk · SOL · BTC · ETH · DOGE</div>
    <div style="font-size:19px;margin-top:22px;line-height:1.5;color:#8b95a8;max-width:640px">Chỉ báo đa khung 5M → 1D, kế hoạch tham khảo theo quy tắc kỹ thuật, giá realtime Binance Futures, backtest 30 ngày trên máy bạn</div>
  </div>
  <div style="position:absolute;left:64px;bottom:22px;font-size:12px;color:#8b95a8">Công cụ phân tích kỹ thuật — không phải tư vấn đầu tư. Giao dịch futures có thể mất toàn bộ vốn.</div>
</body></html>`;
const icon = `<!doctype html><html><body style="margin:0;background:#0b0d12"><img src="data:image/svg+xml;base64,${b64(svg)}" width="512" height="512" style="display:block"></body></html>`;
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage();
  await p.setViewportSize({ width: 1024, height: 500 }); await p.setContent(feature); await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(OUT, "feature-graphic-1024x500.png") }); console.log(OUT + "/feature-graphic-1024x500.png");
  await p.setViewportSize({ width: 512, height: 512 }); await p.setContent(icon); await p.waitForTimeout(100);
  await p.screenshot({ path: path.join(OUT, "icon-512.png") }); console.log(OUT + "/icon-512.png");
  await b.close();
})();
