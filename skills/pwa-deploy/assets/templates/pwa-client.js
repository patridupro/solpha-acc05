// Dán vào cuối app.js (hoặc nạp riêng). Cần nút #btnInstall (ẩn sẵn bằng class "hidden") và #btnNotify.
let deferredPrompt = null;
const $id = (id) => document.getElementById(id);

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); deferredPrompt = e; $id("btnInstall")?.classList.remove("hidden");
});
$id("btnInstall")?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null;
  $id("btnInstall").classList.add("hidden");
});
window.addEventListener("appinstalled", () => { deferredPrompt = null; $id("btnInstall")?.classList.add("hidden"); });

// Chrome Android cấm new Notification() — phải đi qua service worker.
async function notify(title, body) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const opts = { body, icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: "app-alert", renotify: true, vibrate: [200, 100, 200] };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.ready : null;
    if (reg) return reg.showNotification(title, opts);
  } catch (_) {}
  try { new Notification(title, opts); } catch (_) {}
}
$id("btnNotify")?.addEventListener("click", async () => {
  if (!("Notification" in window)) return;
  const perm = await Notification.requestPermission();
  if (perm === "granted") notify("Đã bật thông báo", "Bạn sẽ nhận cảnh báo khi app đang mở.");
});
