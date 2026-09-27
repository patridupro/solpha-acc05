// Kiểm tra app có cài được trên Chrome không (giống Chrome Android quyết định hiện nút cài).
// Chạy:  npx http-server -p 8765 -c-1 <thư-mục-app> &   rồi   node check-pwa.js http://localhost:8765/
// Kết quả mong muốn: installability [] · manifest errors [] · SW controlled true · page errors [].
const { chromium } = require("playwright");
const os = require("os"), path = require("path"), fs = require("fs");
const url = process.argv[2] || "http://localhost:8765/";
(async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "pwa-check-"));
  // Persistent profile: context ẩn danh luôn báo lỗi "in-incognito".
  const ctx = await chromium.launchPersistentContext(profile, {
    ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
    viewport: { width: 412, height: 915 }, isMobile: true
  });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(url);
  await p.evaluate(() => navigator.serviceWorker && navigator.serviceWorker.ready);
  await p.reload(); await p.waitForTimeout(1500);
  const cdp = await ctx.newCDPSession(p);
  const inst = await cdp.send("Page.getInstallabilityErrors");
  const man = await cdp.send("Page.getAppManifest");
  const controlled = await p.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
  console.log("installability:", JSON.stringify(inst.installabilityErrors));
  console.log("manifest errors:", JSON.stringify(man.errors));
  console.log("SW controlled:", controlled);
  console.log("page errors:", JSON.stringify(errs));
  await ctx.close();
  process.exit(inst.installabilityErrors.length || man.errors.length || !controlled ? 1 : 0);
})();
