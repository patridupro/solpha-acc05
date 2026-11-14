/* Chọn thương hiệu: "solpha" (bản Google Play / TWA) hoặc "etek" (web thường). Nạp đồng bộ trong <head>. */
(function () {
  var KEY = "solpha_brand";
  var brand = "etek";
  var fromUrl = false;
  try {
    var q = new URLSearchParams(location.search);
    fromUrl = q.get("source") === "play" || q.get("brand") === "solpha" || String(document.referrer || "").indexOf("android-app://") === 0;
  } catch (e) {}
  // Trang pháp lý chỉ có nội dung SOLPHA: luôn dùng giao diện SOLPHA (URL dán lên Play Console không cần kèm tham số).
  try { if (/\/(privacy|terms)(\.html)?\/?$/.test(location.pathname)) fromUrl = true; } catch (e) {}
  if (fromUrl) {
    brand = "solpha";
    try { sessionStorage.setItem(KEY, "solpha"); } catch (e) {} // sessionStorage: không lan sang Chrome/PWA ETEK cùng thiết bị
  } else {
    try { if (sessionStorage.getItem(KEY) === "solpha") brand = "solpha"; } catch (e) {}
  }
  var root = document.documentElement;
  root.dataset.brand = brand;
  var solpha = brand === "solpha";
  window.SOLPHA_BRAND = { id: brand, icon192: solpha ? "icons/solpha/icon-192.png" : "icons/icon-192.png" };

  function setAttr(sel, attr, val) {
    var el = document.querySelector(sel);
    if (el) el.setAttribute(attr, val);
  }
  if (solpha) {
    setAttr('meta[name="theme-color"]', "content", "#07080c");
    setAttr('link[rel="manifest"]', "href", "manifest-solpha.webmanifest");
    setAttr('link[rel="icon"][type="image/svg+xml"]', "href", "icons/solpha/icon.svg");
    setAttr('link[rel="icon"][sizes="32x32"]', "href", "icons/solpha/favicon-32.png");
    var plain = document.querySelector('link[rel="icon"]:not([type]):not([sizes])');
    if (plain) plain.setAttribute("href", "icons/solpha/favicon-32.png");
    setAttr('link[rel="apple-touch-icon"]', "href", "icons/solpha/apple-touch-icon.png");
  }

  // Ảnh trong thân trang dùng data-src để bản solpha không tải ảnh thương hiệu khác.
  function images() {
    var list = document.querySelectorAll("img[data-src]");
    for (var i = 0; i < list.length; i++) {
      var img = list[i];
      if (img.classList.contains("etek-logo")) {
        if (solpha) img.parentNode.removeChild(img);
        else img.src = img.getAttribute("data-src");
      } else {
        img.src = solpha ? "icons/solpha/icon.svg" : img.getAttribute("data-src");
      }
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", images);
  else images();
})();
