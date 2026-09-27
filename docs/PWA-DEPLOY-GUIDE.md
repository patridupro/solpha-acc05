# Cẩm nang PWA & Deploy miễn phí

**Từ web app tĩnh → app cài được trên Chrome Android → chạy trên Cloudflare Pages**

Phiên bản 1.0 · 09/2026 · Rút ra từ dự án SOLPHA (https://solpha.pages.dev)

---

## Mục lục

1. Tóm tắt điều hành
2. Khái niệm cần nắm
3. Năm bài học từ SOLPHA
4. Checklist file bắt buộc
5. Quy trình 6 bước
6. So sánh nền tảng hosting
7. Hướng dẫn deploy từng nền tảng
8. Kiểm tra & nghiệm thu
9. Xử lý sự cố
10. Bảo mật & vận hành
11. Giới hạn của PWA và hướng nâng cấp
12. Phụ lục: mẫu file
13. Nguồn tham khảo

---

## 1. Tóm tắt điều hành

- **Mục tiêu:** mọi web app nội bộ (dashboard, công cụ tính toán, app theo dõi) đều có thể thành "app điện thoại" trong khoảng **15 phút**, **0 đồng**, không cần lên Google Play.
- **Công thức:** manifest đủ icon PNG + service worker network-first + thông báo qua service worker + đường dẫn tương đối → deploy **Cloudflare Pages**.
- **Kết quả SOLPHA:** kiểm tra bằng Chrome DevTools Protocol trả về **0 lỗi cài đặt**; người dùng đã cài thành công trên Chrome Android.
- **Quyết định hosting:** Cloudflare Pages là mặc định; GitHub Pages để dự phòng; Netlify Free dễ hết credit.
- **Giới hạn:** PWA chỉ cảnh báo khi app đang mở/chạy nền. Muốn cảnh báo 24/7 cần thêm server gửi Web Push.

## 2. Khái niệm cần nắm

| Thuật ngữ | Ý nghĩa đơn giản |
|---|---|
| **PWA** (Progressive Web App) | Trang web có thể "cài" như app: có icon, mở toàn màn hình, chạy offline một phần |
| **Manifest** (`manifest.webmanifest`) | "Căn cước" của app: tên, màu, icon, trang khởi động |
| **Service worker** (`sw.js`) | Đoạn code chạy nền: lưu cache để mở offline, hiển thị thông báo |
| **Maskable icon** | Icon có vùng đệm để Android cắt thành tròn/vuông/giọt nước mà không mất logo |
| **WebAPK** | Gói app mà Chrome Android tự tạo khi người dùng bấm cài PWA |
| **Cache-first / Network-first** | Ưu tiên bản lưu sẵn trong máy / ưu tiên bản mới trên mạng |
| **Static site** | Web chỉ gồm file HTML/CSS/JS, không cần server chạy code |

## 3. Năm bài học từ SOLPHA

### Bài học 1 — Icon SVG là không đủ
- **Triệu chứng:** Chrome Android không hiện nút "Cài đặt ứng dụng".
- **Nguyên nhân:** manifest chỉ khai báo `icon.svg`. Chrome cần icon PNG để tạo WebAPK.
- **Cách đúng:** khai báo PNG **192×192** và **512×512** (`purpose: any`) và bản **maskable** (`purpose: maskable`). Dùng `make-icons.js` để sinh tự động từ SVG.

### Bài học 2 — `new Notification()` bị cấm trên Android
- **Triệu chứng:** desktop có thông báo, điện thoại thì không bao giờ có; không báo lỗi gì.
- **Nguyên nhân:** Chrome Android ném lỗi `Illegal constructor` với `new Notification()`.
- **Cách đúng:** `navigator.serviceWorker.ready.then(reg => reg.showNotification(title, opts))`. Thêm `notificationclick` trong `sw.js` để bấm vào thông báo thì mở lại app.

### Bài học 3 — Cache-first làm app "đóng băng"
- **Triệu chứng:** đã deploy bản mới nhưng app đã cài vẫn chạy bản cũ.
- **Nguyên nhân:** service worker trả file từ cache trước, không bao giờ hỏi mạng.
- **Cách đúng:** **network-first** cho file cùng domain; chỉ dùng cache khi mất mạng. Header `Cache-Control: no-cache` cho `sw.js`, `manifest.webmanifest`, `index.html`.

### Bài học 4 — Đường dẫn tuyệt đối vỡ ở thư mục con
- **Triệu chứng:** chạy tốt ở `solpha.pages.dev` nhưng trắng trang ở `user.github.io/repo/`.
- **Nguyên nhân:** `/app.js` trỏ về gốc domain, không phải thư mục app.
- **Cách đúng:** dùng `app.js`, `./sw.js`, manifest `"start_url": "./"`, `"scope": "./"`. Một bản code chạy mọi nơi.

### Bài học 5 — Chọn hosting theo giới hạn gói miễn phí
- **Triệu chứng:** Netlify báo *"running on operational credits… production deploys are paused"*.
- **Nguyên nhân:** gói Free tính theo credit (khoảng 300 credit/tháng; mỗi production deploy khoảng 15 credit) — dùng chung cho mọi site của team.
- **Cách đúng:** Cloudflare Pages (500 build/tháng, băng thông không giới hạn). Gom thay đổi, hạn chế push lẻ tẻ; tắt Deploy Preview nếu không dùng.

## 4. Checklist file bắt buộc

| File | Bắt buộc | Nội dung chính |
|---|---|---|
| `index.html` | ✅ | `<link rel="manifest">`, `theme-color`, `apple-touch-icon`, viewport |
| `manifest.webmanifest` | ✅ | `id`, `name`, `short_name`, `start_url "./"`, `scope "./"`, `display "standalone"`, icons PNG + maskable |
| `sw.js` | ✅ | install / activate / fetch network-first / notificationclick |
| `icon.svg` | ✅ | Logo gốc vuông, nền đặc |
| `icons/*.png` | ✅ | 192, 512, maskable-192, maskable-512, apple-touch 180, favicon 32 |
| `_headers` | Cloudflare | no-cache cho sw/manifest/html; Content-Type manifest |
| `netlify.toml` | Netlify | cùng nội dung header |
| `.nojekyll` | GitHub Pages | tránh Jekyll bỏ qua file bắt đầu bằng `_` |

**Điều kiện Chrome yêu cầu để hiện nút cài:** chạy trên HTTPS (hoặc localhost); manifest hợp lệ có `name`/`short_name`, `start_url`, `display` standalone/fullscreen/minimal-ui, icon 192 và 512; có service worker kiểm soát trang.

## 5. Quy trình 6 bước

1. **Khảo sát app** — liệt kê file, tìm `new Notification`, đường dẫn tuyệt đối, API bên ngoài, secret bị nhúng.
2. **Logo & icon** — chuẩn hoá `icon.svg` → `node make-icons.js` → xem bản maskable.
3. **Cấu hình** — copy mẫu `manifest.webmanifest`, `sw.js`, `_headers`, `head-snippet.html`, `pwa-client.js`; điền tên, màu; sửa `ASSETS`.
4. **Kiểm tra local** — `npx http-server -p 8765 -c-1 .` → `node check-pwa.js http://localhost:8765/` → phải ra 0 lỗi.
5. **Deploy** — Cloudflare Pages (mục 7.1).
6. **Nghiệm thu trên điện thoại** — theo bảng mục 8.

## 6. So sánh nền tảng hosting

| Tiêu chí | Cloudflare Pages | GitHub Pages | Netlify Free |
|---|---|---|---|
| Link | `ten.pages.dev` (gốc domain) | `user.github.io/repo/` (thư mục con) | `ten.netlify.app` |
| Giới hạn build | 500 build/tháng | Mềm ~10 build/giờ | Theo credit (~15 credit/deploy) |
| Băng thông | Không giới hạn | Mềm ~100 GB/tháng | Trừ credit |
| Repo private | Miễn phí | Cần GitHub trả phí | Miễn phí |
| Header tuỳ chỉnh | Có (`_headers`) | Không (cache cố định ~10 phút) | Có (`netlify.toml`) |
| Code phía server | Có (Functions/Workers) | Không | Có (Functions) |
| Preview theo nhánh | Có | Không | Có |
| Ai thao tác | Người dùng bấm trên dashboard | Claude tự push được | Người dùng bấm |
| **Khuyến nghị** | **Mặc định** | Dự phòng / demo nhanh | Chỉ khi team còn credit |

*Số liệu giới hạn có thể thay đổi — kiểm tra trang giá chính thức trước khi ra quyết định.*

## 7. Hướng dẫn deploy từng nền tảng

### 7.1 Cloudflare Pages (khuyến nghị)
1. Vào **dash.cloudflare.com** → đăng ký/đăng nhập.
2. **Workers & Pages → Create → tab Pages → Connect to Git.** (Không thấy tab Pages: tìm dòng *"Looking to deploy Pages? Get started"*.)
3. **Connect GitHub** → cài GitHub App → chọn **Only select repositories** → chọn repo app.
4. Chọn repo → **Begin setup**:
   - Project name: tên ngắn (thành `ten.pages.dev`)
   - Production branch: nhánh chứa code
   - Framework preset: **None**
   - Build command: **để trống**
   - Build output directory: **để trống**
5. **Save and Deploy** → chờ ~1 phút → **Success**.
6. **Settings → Builds & deployments → Preview deployments: None.**

> ⚠️ Nếu thấy ô *"Deploy command: npx wrangler deploy"* là đang ở luồng **Workers** — quay lại chọn tab **Pages**.

### 7.2 GitHub Pages
- Cách nhanh (Claude làm được): đẩy code lên nhánh `gh-pages` → GitHub tự bật Pages → link `https://user.github.io/repo/`.
- Hoặc: repo **Settings → Pages → Source: Deploy from a branch** → chọn nhánh, thư mục `/ (root)`.
- Bắt buộc đường dẫn tương đối và file `.nojekyll`.
- Nhánh `gh-pages` không tự cập nhật theo nhánh chính — phải đẩy lại khi có bản mới.

### 7.3 Netlify
- **Add new site → Import an existing project → GitHub** → chọn repo; build command trống; publish directory `.`.
- Banner đỏ *"operational credits"* = team hết credit tháng, **không phải lỗi code**. Chọn: nâng gói, chờ chu kỳ mới, hoặc chuyển Cloudflare.

## 8. Kiểm tra & nghiệm thu

### 8.1 Kiểm tra tự động (trước deploy)
`check-pwa.js` dùng Chrome DevTools Protocol (`Page.getInstallabilityErrors`, `Page.getAppManifest`) — đúng tiêu chí Chrome dùng để quyết định hiện nút cài.

| Chỉ số | Đạt |
|---|---|
| installability | `[]` |
| manifest errors | `[]` |
| SW controlled | `true` |
| page errors | `[]` |

### 8.2 Kiểm tra thủ công bằng Chrome desktop
DevTools (F12) → **Application → Manifest** (không cảnh báo, icon hiện đủ) → **Service workers** (*activated and running*) → thanh địa chỉ có biểu tượng cài.

### 8.3 Nghiệm thu trên Chrome Android

| Bước | Kết quả đúng |
|---|---|
| Mở link bằng Chrome | Nội dung hiện ra, dữ liệu tải được |
| Nút **Cài app** / menu ⋮ → **Cài đặt ứng dụng** | Có lựa chọn cài |
| Cài | Icon đúng logo trên màn hình chính |
| Mở từ icon | Toàn màn hình, không thanh địa chỉ |
| **Bật cảnh báo** → Cho phép | Có thông báo thử |
| Push bản mới, mở lại app 1–2 lần | Thấy thay đổi mới |

## 9. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Không có nút cài | Thiếu icon PNG 192/512; SW chưa kiểm soát trang; không phải HTTPS | Chạy `check-pwa.js`; xem DevTools → Manifest |
| Đã sửa nhưng vẫn không có nút cài | Chrome nhớ trạng thái cũ | ⋮ → Cài đặt trang web → Xoá dữ liệu → mở lại |
| Icon bị cắt mất logo | Thiếu bản maskable hoặc logo tràn viền | Dùng maskable có vùng an toàn 80% |
| Thông báo không hiện trên Android | Dùng `new Notification()` | Chuyển sang `showNotification()` |
| Deploy xong vẫn bản cũ | SW cache-first; cache header dài | Network-first; `no-cache` cho sw/html; tăng số phiên bản CACHE |
| Trắng trang ở GitHub Pages | Đường dẫn tuyệt đối; thiếu `.nojekyll` | Đường dẫn tương đối; thêm `.nojekyll` |
| SW cài thất bại | Một file trong `ASSETS` bị 404 | Đối chiếu `ASSETS` với file thật |
| Lỗi "in-incognito" khi test tự động | Trình duyệt test chạy ẩn danh | Dùng persistent profile (script đã xử lý) |
| Dữ liệu API không tải | API chặn CORS hoặc chặn theo vùng | Thử trên mạng người dùng; cần proxy phía server nếu bị chặn |
| Netlify "operational credits" | Hết credit gói Free | Nâng gói / chờ / chuyển Cloudflare |
| Cloudflare hỏi "Deploy command" | Nhầm luồng Workers | Chọn tab Pages |

## 10. Bảo mật & vận hành

- **Không nhúng API key/secret** vào JS — app tĩnh ai cũng xem được mã nguồn.
- **Quyền tối thiểu:** GitHub App của Cloudflare/Netlify chỉ cấp **Only select repositories**.
- Header bảo mật mặc định: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options: DENY`, `Permissions-Policy`.
- **Tiết kiệm build:** gom thay đổi, tắt Preview deployments nếu không cần.
- **Một link chính** cho người dùng (Cloudflare); link dự phòng ghi rõ trong README.
- Dữ liệu người dùng lưu trong `localStorage` chỉ nằm trên máy đó — không phải nơi lưu trữ tin cậy.

## 11. Giới hạn của PWA và hướng nâng cấp

| Nhu cầu | PWA tĩnh | Nâng cấp |
|---|---|---|
| Cảnh báo khi app đang mở | ✅ | — |
| Cảnh báo 24/7 khi tắt màn hình | ❌ (Android dừng app chạy nền) | Cloudflare Worker cron + Web Push (VAPID) |
| Đăng nhập, phân quyền | ❌ | Cloudflare Access / Functions |
| Lưu dữ liệu dùng chung | ❌ | Cloudflare D1 / KV |
| Lên Google Play | ❌ | Đóng gói TWA (Bubblewrap / PWABuilder) |

## 12. Phụ lục: mẫu file

Toàn bộ mẫu nằm trong `skills/pwa-deploy/assets/templates/` của repo `patridupro/solpha-acc05`:

- `manifest.webmanifest` — thay `__APP_NAME__`, `__SHORT_NAME__`, `__DESCRIPTION__`, `__BG_COLOR__`, `__THEME_COLOR__`
- `sw.js` — thay `__APP_ID__`, chỉnh `ASSETS`
- `head-snippet.html` — dán vào `<head>`
- `pwa-client.js` — đăng ký SW, nút cài, hàm `notify()`
- `_headers`, `netlify.toml`
- Script: `scripts/make-icons.js` (sinh icon), `scripts/check-pwa.js` (kiểm tra cài đặt)

Đoạn cốt lõi của `sw.js` (network-first):

```js
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const c = res.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true })
      .then((hit) => hit || caches.match("./index.html")))
  );
});
```

Thông báo an toàn cho Android:

```js
const reg = await navigator.serviceWorker.ready;
reg.showNotification("Tiêu đề", { body: "Nội dung", icon: "icons/icon-192.png" });
```

## 13. Nguồn tham khảo

- web.dev — *What does it take to be installable?* https://web.dev/articles/install-criteria
- web.dev — *Maskable icons* https://web.dev/articles/maskable-icon
- MDN — *Web app manifests* https://developer.mozilla.org/docs/Web/Progressive_web_apps/Manifest
- MDN — *ServiceWorkerRegistration.showNotification()* https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/showNotification
- Chrome for Developers — *Chrome DevTools Protocol: Page.getInstallabilityErrors* https://chromedevtools.github.io/devtools-protocol/tot/Page/
- Cloudflare Docs — *Pages: Limits* https://developers.cloudflare.com/pages/platform/limits/ · *Headers* https://developers.cloudflare.com/pages/configuration/headers/
- GitHub Docs — *GitHub Pages limits* https://docs.github.com/pages/getting-started-with-github-pages/github-pages-limits
- Netlify Docs — *Billing for credit-based plans* https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/
