# Playbook: Web app → PWA cài được trên Chrome Android → deploy miễn phí

Rút ra từ dự án SOLPHA (09/2026). Áp dụng cho mọi app HTML/JS tĩnh (dashboard, công cụ nội bộ, báo cáo).

## 1. Bài học cốt lõi (5 lỗi đã gặp)

| # | Lỗi | Hậu quả | Cách đúng |
|---|---|---|---|
| 1 | Manifest chỉ có icon SVG | Chrome Android **không cho cài** | Bắt buộc PNG **192×192 + 512×512**, thêm bản **maskable** |
| 2 | Dùng `new Notification()` | Android **lỗi âm thầm**, không bao giờ báo | Dùng `registration.showNotification()` qua service worker |
| 3 | Service worker cache-first | Deploy bản mới nhưng điện thoại **vẫn chạy bản cũ** | **Network-first** cho HTML/JS/CSS, cache chỉ để offline |
| 4 | Đường dẫn tuyệt đối `/app.js` | Hỏng khi chạy ở thư mục con (GitHub Pages) | Dùng **đường dẫn tương đối** `app.js`, `./sw.js`, manifest `"start_url": "./"` |
| 5 | Netlify Free hết credit | Deploy bị dừng giữa chừng | Mỗi deploy ~15 credit; ưu tiên **Cloudflare Pages** (500 build/tháng, băng thông không giới hạn) |

## 2. Checklist file bắt buộc

```
index.html            <link rel="manifest" href="manifest.webmanifest">, theme-color, apple-touch-icon
manifest.webmanifest  id, name, short_name, start_url "./", scope "./", display "standalone", icons PNG + maskable
sw.js                 install/activate/fetch (network-first) + notificationclick
icon.svg              logo gốc (nền đặc, bo góc)
icons/                chạy: node tools/make-icons.js
_headers              (Cloudflare) sw.js + manifest: Cache-Control no-cache
netlify.toml          (Netlify, nếu dùng) cùng nội dung header
.nojekyll             (GitHub Pages) tránh Jekyll bỏ file bắt đầu bằng "_"
```

Mẫu chuẩn: copy nguyên `manifest.webmanifest`, `sw.js`, `_headers`, `tools/make-icons.js` từ repo này, đổi tên app, màu và danh sách `ASSETS`. **Tăng số phiên bản `CACHE`** trong `sw.js` mỗi lần đổi danh sách file.

## 3. Kiểm tra trước khi deploy (2 phút)

1. Chạy local: `npx http-server -c-1 .` → mở `http://localhost:8080` bằng Chrome.
2. DevTools → **Application → Manifest**: không có cảnh báo, icon hiện đủ.
3. DevTools → **Application → Service workers**: trạng thái *activated and running*.
4. Lighthouse / nút cài trên thanh địa chỉ xuất hiện = đạt.

## 4. Deploy lên Cloudflare Pages (khuyến nghị)

1. dash.cloudflare.com → **Workers & Pages → Create → tab Pages → Connect to Git**.
2. GitHub App: chỉ cấp **Only select repositories** → chọn đúng repo.
3. Framework preset **None** · Build command **trống** · Output directory **trống**.
4. Production branch = nhánh chính → **Save and Deploy** → `https://<tên>.pages.dev`.
5. Settings → Builds & deployments → **Preview deployments: None** (tránh build thừa).

## 5. Cài trên Chrome Android

Mở link → nút **Cài app** / menu ⋮ → **Cài đặt ứng dụng** → mở từ icon → bật thông báo.
Không thấy nút cài: ⋮ → Cài đặt trang web → xoá dữ liệu trang → mở lại.

## 6. Giới hạn cần biết

- PWA chỉ chạy khi app đang mở/chạy nền; Android sẽ dừng sau một thời gian. Cảnh báo 24/7 cần server gửi **Web Push** (Cloudflare Worker cron + VAPID).
- API bên thứ ba (Binance…) gọi thẳng từ trình duyệt: cần API cho phép CORS và không bị chặn theo vùng.
- Bảo mật: app tĩnh công khai — **không nhúng API key/secret** vào JS.
