# SOLPHA — SOL/USDT Perpetual Desk

PWA theo dõi SOL/USDT futures đa khung (5M, 15M, 1H, 4H, 1D), RSI / EMA / Bollinger, cảnh báo khi **đồng pha + chạm band**.

## Link đang chạy (GitHub Pages)

https://patridupro.github.io/solpha-acc05/ — nhánh `gh-pages` là bản publish. Đường dẫn trong app đều tương đối nên chạy được cả ở gốc domain (Netlify/Cloudflare) lẫn thư mục con (GitHub Pages).

## Playbook cho app sau

Xem [`docs/PWA-DEPLOY-GUIDE.md`](docs/PWA-DEPLOY-GUIDE.md) (bản PDF: `docs/PWA-DEPLOY-GUIDE.pdf`) · skill Claude: `skills/pwa-deploy/` · tạo icon: `node tools/make-icons.js`.

## Deploy lên Cloudflare Pages (miễn phí, link chính: https://solpha.pages.dev)

1. dash.cloudflare.com → **Workers & Pages → Create → tab Pages → Connect to Git** → chọn `patridupro/solpha-acc05`.
2. Production branch: nhánh chính của repo. Framework preset: **None**. Build command: **để trống**. Build output directory: **để trống** (gốc repo).
3. **Save and Deploy** → link dạng `https://<tên-project>.pages.dev`.
4. Header/cache cho service worker nằm trong `_headers`, redirect trong `_redirects` (Cloudflare tự đọc).

## Deploy lên Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/patridupro/solpha-acc05)

1. app.netlify.com → **Add new site → Import an existing project → GitHub** → chọn `patridupro/solpha-acc05`.
2. Branch: `main` (hoặc nhánh đang dùng). Build command: **để trống**. Publish directory: `.` — đã cấu hình sẵn trong `netlify.toml`.
3. **Deploy site** → đổi tên site tại *Site configuration → Change site name* (vd `solpha-desk` → `https://solpha-desk.netlify.app`).
4. Mỗi lần push, Netlify tự deploy lại; service worker network-first nên app trên điện thoại tự cập nhật bản mới.

## Cài lên Chrome Android
1. Mở link `https://<site>.netlify.app` bằng Chrome.
2. Bấm nút **Cài app** trong app, hoặc menu ⋮ → **Thêm vào màn hình chính / Cài đặt ứng dụng**.
3. Mở app từ icon SOLPHA → bấm **Bật cảnh báo** → cho phép thông báo.
4. Giữ app mở (chạy nền) để quét mỗi 5 phút và mỗi giờ.

## Checklist PWA đã đạt
- Manifest có `id`, `start_url`, `scope`, icon PNG 192/512 + maskable (bắt buộc cho WebAPK trên Android).
- Service worker kiểm soát trang, có offline fallback, cache tự làm mới khi deploy.
- Thông báo dùng `ServiceWorkerRegistration.showNotification` (Chrome Android không hỗ trợ `new Notification()`).
- Kiểm tra bằng Chromium DevTools Protocol `Page.getInstallabilityErrors` → **0 lỗi**.

## Rule
- Đồng pha = 1D + 4H + 1H cùng hướng, 15M không ngược mạnh.
- Cảnh báo khi đồng pha và chạm BB trên ≥2 khung, có ≥1 khung ≥1H.
- Không phải tư vấn tài chính. Tự quản size/leverage.
