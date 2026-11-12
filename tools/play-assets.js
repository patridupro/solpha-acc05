// Tạo bộ ảnh cho trang Google Play: icon 512×512 (không trong suốt), feature graphic 1024×500,
// và ảnh chụp màn hình nháp 1080×1920 (dữ liệu giả lập — ảnh thật nên chụp từ điện thoại khi đang chạy dữ liệu thật).
// Chạy: node tools/play-assets.js   (cần playwright + chromium; CHROMIUM_PATH nếu có sẵn)
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const OUT = "play-assets";
const svg = fs.readFileSync("icon.svg", "utf8");
const logo = fs.readFileSync("icons/etek-logo.png").toString("base64");
const b64 = (s) => Buffer.from(s).toString("base64");
const feature = `<!doctype html><html><body style="margin:0;width:1024px;height:500px;background:#189848;font-family:Roboto,Segoe UI,sans-serif;color:#fff;position:relative;overflow:hidden">
  <div style="position:absolute;right:-120px;top:-160px;width:520px;height:520px;border-radius:50%;background:#0e2e1c;opacity:.35"></div>
  <div style="position:absolute;left:-80px;bottom:-220px;width:420px;height:420px;border-radius:50%;background:#0e2e1c;opacity:.25"></div>
  <img src="data:image/svg+xml;base64,${b64(svg)}" style="position:absolute;left:64px;top:110px;width:200px;height:200px;border-radius:44px;box-shadow:0 12px 40px rgba(0,0,0,.25)">
  <div style="position:absolute;left:300px;top:118px">
    <div style="font-size:58px;font-weight:900;letter-spacing:.06em;line-height:1">SOLPHA</div>
    <div style="font-size:26px;font-weight:600;margin-top:10px;opacity:.95">Futures Desk · SOL · BTC · ETH · DOGE</div>
    <div style="font-size:19px;margin-top:22px;line-height:1.5;opacity:.92;max-width:640px">Tín hiệu nến 5M theo xu hướng 1D/4H/1H · kế hoạch vào lệnh, SL, TP, khối lượng · giá realtime Binance Futures · backtest 30 ngày</div>
  </div>
  <div style="position:absolute;right:36px;bottom:26px;background:#fff;border-radius:12px;padding:8px 14px"><img src="data:image/png;base64,${logo}" style="height:34px;display:block"></div>
</body></html>`;
const icon = `<!doctype html><html><body style="margin:0;background:#189848"><img src="data:image/svg+xml;base64,${b64(svg)}" width="512" height="512" style="display:block"></body></html>`;
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
