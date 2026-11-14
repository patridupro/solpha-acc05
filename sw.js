const CACHE = "solpha-v42";
// Chỉ nạp sẵn tệp trung tính + tệp thương hiệu SOLPHA. Tệp của bản web thường (icon.svg, manifest.webmanifest, icons/*.png)
// KHÔNG nạp sẵn: chúng chỉ vào cache khi chính bản đó tải về (fetch handler bên dưới), nên máy dùng Play không lưu chúng.
const ASSETS = [
  "./", "./index.html", "./styles.css", "./signals.js", "./app.js", "./journal.js",
  "./brand.js", "./solpha-theme.css", "./manifest-solpha.webmanifest", "./icons/solpha/icon-192.png", "./icons/solpha/icon-512.png",
  "./privacy.html", "./terms.html"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
// Network-first cho code/HTML để mỗi lần deploy Netlify app tự cập nhật; offline thì dùng cache.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || caches.match("./index.html")))
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const win = list.find((c) => "focus" in c);
      // Giữ đúng thương hiệu khi mở lại từ thông báo (bản Play cần source=play).
      const play = e.notification.data && e.notification.data.brand === "solpha";
      return win ? win.focus() : self.clients.openWindow(play ? "./?source=play" : "./");
    })
  );
});
