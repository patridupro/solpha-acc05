---
name: pwa-deploy
description: Biến một web app tĩnh (HTML/CSS/JS, dashboard, công cụ nội bộ, app theo dõi giá, báo cáo) thành PWA cài được trên Chrome Android/desktop có logo riêng, thông báo đẩy khi app mở, tự cập nhật sau mỗi deploy, rồi deploy miễn phí lên Cloudflare Pages (hoặc GitHub Pages/Netlify). Dùng skill này BẤT CỨ KHI NÀO người dùng muốn "làm app cài được trên điện thoại", "install app trên Chrome", "thêm logo/icon cho app", "deploy lên Cloudflare/Netlify/GitHub Pages", "app không hiện nút cài", "deploy xong điện thoại vẫn bản cũ", "thông báo không hiện trên Android", "Netlify hết credit" — kể cả khi họ chỉ nói "làm giống app etek finance/SOLPHA" hoặc "đưa app này lên mạng cho anh dùng trên điện thoại".
---

# PWA Deploy — web app → app cài được trên Chrome Android → deploy miễn phí

Quy trình này rút ra từ dự án SOLPHA (09/2026): app đã cài thành công trên Chrome Android qua Cloudflare Pages. Mục tiêu: người dùng mở link → bấm **Cài app** → có icon trên màn hình chính → thông báo hoạt động → mỗi lần push code, điện thoại tự nhận bản mới.

Tài liệu đầy đủ (lý do, bảng so sánh hosting, xử lý sự cố): `references/full-guide.md`. Đọc khi gặp tình huống không có trong quy trình dưới đây.

## Năm lỗi đã gặp — lý do của từng bước

| Lỗi | Hậu quả | Cách đúng |
|---|---|---|
| Manifest chỉ có icon SVG | Chrome Android không cho cài | PNG 192 + 512 + bản maskable |
| `new Notification()` | Android lỗi âm thầm, không bao giờ báo | `registration.showNotification()` |
| Service worker cache-first | Deploy mới nhưng máy vẫn chạy bản cũ | Network-first, cache chỉ để offline |
| Đường dẫn tuyệt đối `/app.js` | Vỡ khi chạy ở thư mục con (GitHub Pages) | Đường dẫn tương đối |
| Netlify Free (~15 credit/deploy) | Hết credit, deploy bị dừng | Cloudflare Pages (500 build/tháng, băng thông không giới hạn) |

## Quy trình

### 1. Khảo sát app
- Tìm file HTML chính, các file JS/CSS, nơi gọi `serviceWorker.register`, `new Notification`, `manifest`.
- Grep đường dẫn bắt đầu bằng `/` trong `href`, `src`, `register(`, manifest — sẽ đổi sang tương đối.
- Ghi chú API bên ngoài mà app gọi (cần cho phép CORS; service worker không được chặn chúng).
- Có API key/secret trong JS? Cảnh báo người dùng: app tĩnh là công khai, không được nhúng secret.

### 2. Logo và icon
- Cần `icon.svg` vuông 512×512, nền đặc, bo góc. Nếu app chưa có logo, vẽ một SVG đơn giản theo màu app và hỏi người dùng có muốn dùng logo riêng không.
- Tạo bộ icon: `node <skill>/scripts/make-icons.js` (chạy tại thư mục app). Script cần Playwright + Chromium. Ở môi trường có sẵn Chromium thì đặt `CHROMIUM_PATH` (ví dụ `/opt/pw-browsers/chromium`) và gọi Playwright theo đường dẫn global nếu `require("playwright")` lỗi.
- Mở `icons/maskable-512.png` và xem: nội dung chính phải nằm trong vùng an toàn 80% ở giữa.

### 3. File cấu hình (mẫu trong `assets/templates/`)
- `manifest.webmanifest`: thay các `__PLACEHOLDER__`. Giữ `id`, `start_url`, `scope` dạng `./`.
- `sw.js`: đặt `__APP_ID__`, sửa `ASSETS` khớp đúng các file thật (một file 404 trong `ASSETS` sẽ làm service worker cài thất bại). Tăng số phiên bản `CACHE` mỗi khi đổi danh sách.
- `head-snippet.html`: dán vào `<head>`.
- `pwa-client.js`: gộp vào app — đăng ký SW, nút cài, hàm `notify()` an toàn cho Android. Thay mọi `new Notification(...)` cũ bằng `notify(...)`.
- Hosting: `_headers` (Cloudflare) · `netlify.toml` (Netlify) · `.nojekyll` (GitHub Pages). Thêm cả ba không hại gì — mỗi nơi chỉ đọc file của mình.

### 4. Kiểm tra trước khi deploy
```bash
npx http-server -p 8765 -c-1 . &
node <skill>/scripts/check-pwa.js http://localhost:8765/
```
Đạt khi: `installability: []`, `manifest errors: []`, `SW controlled: true`, `page errors: []`. Lỗi `in-incognito` nghĩa là đang chạy context ẩn danh — script đã dùng profile thường để tránh.
Nếu app có thể chạy ở thư mục con, kiểm tra thêm bằng cách copy app vào `site/<tên-repo>/` và mở `http://localhost:8765/<tên-repo>/`.

### 5. Deploy
Mặc định khuyến nghị **Cloudflare Pages** — lý do và bảng so sánh trong `references/full-guide.md`.

**Cloudflare Pages** (người dùng tự bấm; Claude không có tài khoản Cloudflare):
1. dash.cloudflare.com → Workers & Pages → Create → **tab Pages** → Connect to Git.
2. GitHub App: chọn **Only select repositories** → repo của app.
3. Framework preset **None** · Build command **trống** · Build output directory **trống** · Production branch = nhánh chứa code.
4. Save and Deploy → `https://<tên>.pages.dev`. Sau đó: Settings → Builds → Preview deployments **None**.
Nếu người dùng thấy ô "Deploy command: npx wrangler deploy" là đã vào nhầm luồng Workers — quay lại chọn tab Pages.

**GitHub Pages** (Claude tự làm được khi có quyền push, repo public):
`git push origin HEAD:refs/heads/gh-pages` → GitHub tự bật Pages và chạy workflow "pages build and deployment". Link `https://<user>.github.io/<repo>/`. Kiểm tra trạng thái bằng GitHub MCP `actions_list` (list_workflow_runs → list_workflow_jobs) vì môi trường sandbox thường chặn `*.github.io` và `*.pages.dev`. Nhánh `gh-pages` không tự cập nhật — phải push lại khi có bản mới.

**Netlify**: chỉ khi người dùng muốn; cảnh báo credit của gói Free. Banner "running on operational credits" = hết credit, không phải lỗi code.

### 6. Bàn giao cho người dùng
Đưa bảng kiểm tra trên điện thoại:
1. Mở link bằng Chrome Android → nội dung hiện ra.
2. Nút **Cài app** hoặc menu ⋮ → **Cài đặt ứng dụng**.
3. Icon xuất hiện trên màn hình chính, mở ra toàn màn hình, không có thanh địa chỉ.
4. **Bật cảnh báo** → cho phép → thấy thông báo thử.
Không thấy nút cài: ⋮ → Cài đặt trang web → xoá dữ liệu trang → mở lại.

Nói rõ giới hạn: PWA chỉ quét/báo khi app đang mở hoặc chạy nền; cảnh báo 24/7 cần server gửi Web Push (Cloudflare Worker cron + VAPID) — đề xuất như bước tiếp theo nếu app cần.

Nhắc bảo mật: sau khi deploy, thu hẹp quyền GitHub App của hosting về **Only select repositories**.

## Cách báo cáo
Viết tiếng Việt, ngắn: đã sửa gì (theo bảng 5 lỗi), đã kiểm chứng gì (kết quả `check-pwa.js`), điều gì chưa kiểm chứng được (ví dụ sandbox chặn domain hosting hoặc API), các bước người dùng cần bấm.
