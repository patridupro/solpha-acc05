// Tạo bộ icon PWA (PNG 192/512, maskable, apple-touch, favicon) từ icon.svg.
// Chạy: node tools/make-icons.js   (cần playwright + chromium; trên máy thường: npx playwright install chromium)
const { chromium } = require("playwright");
const fs = require("fs");
const svg = fs.readFileSync("icon.svg", "utf8");
const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const bg = (svg.match(/<rect[^>]*fill="(#[0-9a-fA-F]{3,8})"/) || [])[1] || "#000000";
// Maskable: nền tràn viền, nội dung thu vào vùng an toàn 80%.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="${bg}"/><g transform="translate(51.2 51.2) scale(0.8)">${inner}</g></svg>`;
const jobs = [
  ["icon-192.png", 192, svg, true], ["icon-512.png", 512, svg, true],
  ["maskable-192.png", 192, maskable, false], ["maskable-512.png", 512, maskable, false],
  ["apple-touch-icon.png", 180, maskable, false], ["favicon-32.png", 32, svg, true]
];
(async () => {
  fs.mkdirSync("icons", { recursive: true });
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage();
  for (const [name, size, s, transparent] of jobs) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}" width="${size}" height="${size}" style="display:block"></body>`);
    await p.waitForTimeout(100);
    await p.screenshot({ path: "icons/" + name, omitBackground: transparent });
    console.log("icons/" + name);
  }
  await b.close();
})();
