# Cài đặt và triển khai — SOLPHA Futures Desk

Gói là một thư mục tệp tĩnh. Không có bước build, không cần Node.js để chạy. Bạn chỉ cần: (1) điền các `{{...}}`, (2) đưa thư mục lên một host tĩnh có HTTPS, (3) trỏ tên miền.

## 0. Điền các chỗ `{{...}}` (làm trước khi deploy)

Tìm toàn bộ bằng lệnh (Linux/macOS/Git Bash): `grep -rn "{{" . --include="*" -I`

| Placeholder | Dùng để | Nằm ở | Điền gì |
|---|---|---|---|
| `{{DOMAIN}}` | Tên miền của app | `twa-manifest.json`, `docs/play/LISTING.md`, `worker/wrangler.toml`, `worker/src/index.js` (nếu có) | Tên miền không kèm `https://`, ví dụ `desk.tenmiencuaban.com` |
| `{{COMPANY_NAME}}` | Đơn vị phát hành | `privacy.html`, `terms.html`, `LICENSE.md` | Tên pháp nhân hoặc cá nhân phát hành |
| `{{CONTACT_EMAIL}}` | Email liên hệ/xoá dữ liệu | `privacy.html`, `terms.html`, `LICENSE.md` | Email thật, đọc thường xuyên |
| `{{WEBSITE}}` | Website | `privacy.html`, `terms.html`, `LICENSE.md` | Địa chỉ website của bạn |

Ghi chú:
- Ứng dụng chạy được dùng **đường dẫn tương đối**, nên chạy ở bất kỳ tên miền nào mà không cần điền `{{DOMAIN}}`. `{{DOMAIN}}` chỉ cần cho phần đóng gói Android và backend thanh toán.
- `privacy.html` mục 2 nêu hosting là "Cloudflare Pages" và mục 4 có chỗ `[SỐ NGÀY]` (thời hạn giữ dữ liệu thanh toán, chỉ áp dụng khi bạn bật gói trả phí): **đổi theo nhà cung cấp hosting bạn dùng** và điền thời hạn nếu bật thanh toán. Câu "không bật công cụ phân tích truy cập bổ sung" chỉ đúng nếu bạn thật sự không bật Web Analytics/Logpush ở host của mình.
- `privacy.html` và `terms.html` là **mẫu**. Đọc kỹ, chỉnh theo thực tế sản phẩm của bạn (có thu phí hay không, có backend hay không) và nhờ luật sư soát trước khi công bố. Bản này viết cho trường hợp "không tài khoản, không máy chủ, dữ liệu nằm trên thiết bị".
- Tệp `LICENSE.md`, `docs/`, `tests/`, `tools/`, `worker/` nằm cùng thư mục gốc và sẽ bị xuất bản công khai nếu bạn deploy nguyên thư mục. Không có bí mật nào trong các tệp này, nhưng bạn nên **xoá** `LICENSE.md`, `CHANGELOG.md`, `docs/`, `tests/`, `tools/`, `worker/`, `play-assets/` và `package.json` khỏi bản deploy (cất bản đầy đủ ở nơi riêng tư) để gọn và không lộ tài liệu bán hàng. Đừng xoá `.well-known/`, `icons/`, `_headers`, `_redirects`.

## 1. Thử chạy cục bộ

```bash
cd solpha-futures-desk-v1.0.0
python3 -m http.server 8080      # hoặc: npx serve .
# mở http://localhost:8080
```
Service worker và nút "Cài app" chỉ hoạt động trên `https://` hoặc `http://localhost`.

## 2. Triển khai

### 2.1 Cloudflare Pages (khuyến nghị, miễn phí)

**Cách A — kéo thả (không cần Git):**
1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Upload assets**.
2. Đặt tên project, ví dụ `solpha-desk` → **Create project**.
3. Kéo thả **thư mục đã giải nén** (chứa `index.html` ở gốc) lên khung tải lên → **Deploy**.
4. Mở link `https://<tên-project>.pages.dev` để kiểm tra.

**Cách B — Git:**
1. Đưa thư mục lên một repo riêng tư của bạn (GitHub/GitLab). **Không đặt repo công khai** nếu bạn mua giấy phép không cho phép phát tán mã nguồn.
2. Workers & Pages → Create → Pages → Connect to Git → chọn repo.
3. **Framework preset: None. Build command: để trống. Build output directory: `/`** (hoặc `.`). Deploy.

**Gắn tên miền riêng:** project → **Custom domains** → **Set up a custom domain** → nhập `desk.tenmiencuaban.com` → làm theo hướng dẫn DNS (CNAME tới `<tên-project>.pages.dev` nếu DNS ở nơi khác; tự động nếu tên miền đã ở Cloudflare). Chờ chứng chỉ HTTPS tự cấp (vài phút).

`_headers` và `_redirects` trong gói được Cloudflare Pages áp dụng tự động (tiêu đề bảo mật, không cache `sw.js`, kiểu nội dung của manifest và `assetlinks.json`).

### 2.2 Netlify

**Kéo thả:** vào `app.netlify.com/drop` → kéo thư mục đã giải nén vào → có link `https://<tên>.netlify.app`.

**Git:** Add new site → Import an existing project → chọn repo. **Build command:** để trống. **Publish directory:** `.` (thư mục gốc). Deploy.

**Tên miền riêng:** Site configuration → **Domain management** → **Add a domain** → làm theo hướng dẫn DNS. HTTPS được cấp tự động.

Netlify đọc `_headers` và `_redirects` của gói như Cloudflare Pages.

### 2.3 GitHub Pages (tạo mới từ zip)

1. Tạo repo mới trên GitHub. (GitHub Pages miễn phí cho repo công khai; repo riêng tư cần gói trả phí. Nếu giấy phép của bạn cấm phát tán mã nguồn, hãy dùng gói trả phí hoặc dùng Cloudflare/Netlify.)
2. Giải nén zip, đưa **nội dung thư mục** (để `index.html` ở gốc repo) lên nhánh `main`:
   ```bash
   cd solpha-futures-desk-v1.0.0
   git init -b main && git add -A && git commit -m "SOLPHA Futures Desk v1.0.0"
   git remote add origin git@github.com:<tài-khoản>/<repo>.git
   git push -u origin main
   ```
3. Repo → **Settings → Pages** → Source: **Deploy from a branch** → Branch `main`, thư mục `/ (root)` → Save.
4. **Tên miền riêng:** Settings → Pages → **Custom domain** → nhập tên miền, bật **Enforce HTTPS**; tạo bản ghi CNAME tại nhà cung cấp DNS trỏ tới `<tài-khoản>.github.io`.
5. Hạn chế của GitHub Pages: **không đọc** `_headers` và `_redirects` (app vẫn chạy; chỉ mất tinh chỉnh tiêu đề cache và lối tắt `/dashboard`). Nếu để địa chỉ dạng `<tài-khoản>.github.io/<repo>/` (thư mục con), PWA vẫn chạy nhờ đường dẫn tương đối, nhưng **đóng gói Android và `assetlinks.json` cần tên miền gốc** nên hãy dùng tên miền riêng.
6. Tệp `.nojekyll` có sẵn trong gói để GitHub không xử lý Jekyll.

## 3. Kiểm tra PWA cài được

Trên Chrome (máy tính hoặc Android), mở địa chỉ HTTPS của bạn:
1. Mở **DevTools → Application → Manifest**: không có lỗi, thấy tên "SOLPHA · Futures Desk" và các icon 192/512/maskable.
2. **Application → Service Workers**: `sw.js` ở trạng thái *activated and running*.
3. Chrome Android: menu ⋮ → **Cài đặt ứng dụng** (hoặc nút **Cài app** trong header của app). Chrome máy tính: biểu tượng cài đặt ở thanh địa chỉ.
4. iOS Safari: nút Chia sẻ → **Thêm vào MH chính** (không có nút "Cài app", thông báo đẩy khi app mở có hạn chế trên iOS).
5. Lighthouse (DevTools → Lighthouse → Progressive Web App) để đối chiếu nếu cần.
6. Mở tab **Tín hiệu**: giá cập nhật, không có lỗi đỏ trong Console. Nếu giá không tải được: kiểm tra mạng có truy cập Binance không.
7. **Sau mỗi lần deploy:** `sw.js` dùng chiến lược mạng-trước nên người dùng nhận bản mới ở lần mở kế tiếp. Nếu bạn thêm/xoá tệp, nhớ cập nhật mảng `ASSETS` trong `sw.js` (xem `docs/CUSTOMIZE.md`).

## 4. Đổi thương hiệu (tên, màu, logo)

Chi tiết từng tệp nằm trong `docs/CUSTOMIZE.md`. Tóm tắt:

| Muốn đổi | Sửa ở đâu |
|---|---|
| Tên hiển thị | `index.html` (`<title>`, `<h1>`, `alt` của logo, `apple-mobile-web-app-title`, `description`), `manifest.webmanifest` (`name`, `short_name`, `description`), `privacy.html`, `terms.html`, `twa-manifest.json` (`name`, `launcherName`), `brand.js` (`name`) |
| Màu | Biến CSS trong `:root` của `styles.css` **và** khối `html[data-brand="solpha"]` đầu `solpha-theme.css` (`--bg --card --line --text --muted --brand --cyan --violet --lime --gold --up --down --warn --raise --soft`); màu thanh trình duyệt: `<meta name="theme-color">` trong 3 tệp HTML, `theme_color`/`background_color` trong `manifest.webmanifest`, màu trong `twa-manifest.json` |
| Logo/icon | Sửa `icons/icon.svg` (nền + hình), rồi sinh lại bộ PNG: |

```bash
npm i playwright && npx playwright install chromium
node tools/make-icons.js          # sinh icon-192/512, maskable-192/512, apple-touch-icon, favicon-32 từ icons/icon.svg vào icons/
node tools/play-assets.js         # (tuỳ chọn) icon 512 + feature graphic cho Google Play vào play-assets/
```
Nếu đã có Chromium sẵn: `CHROMIUM_PATH=/đường/dẫn/chromium node tools/make-icons.js`. Sau khi đổi icon, tăng tên cache trong `sw.js` (`solpha-c1.0.0` → `solpha-c1.0.1`) để thiết bị cũ nạp icon mới.

Nếu đổi **tên thương hiệu** (không còn là "SOLPHA"), nhớ đổi cả `package ID` Android, khoá ký và các chuỗi trong `docs/play/LISTING.md`.

## 5. Đóng gói Android (Google Play)

Đọc `docs/ANDROID.md` (từng bước PWABuilder/Bubblewrap, Digital Asset Links, hồ sơ cửa hàng). Tóm tắt:

1. Deploy web lên tên miền HTTPS thật ở bước 2, điền `{{DOMAIN}}` trong `twa-manifest.json`.
2. PWABuilder (`pwabuilder.com`) → nhập URL → **Package for stores → Android**; hoặc Bubblewrap CLI: `npx @bubblewrap/cli init --manifest https://<tên-miền>/manifest.webmanifest` rồi `npx @bubblewrap/cli build`.
3. Lấy `sha256_cert_fingerprints` của **khoá app signing trong Play Console** dán vào `.well-known/assetlinks.json`, deploy lại. Chưa dán đúng thì app mở ra có thanh địa chỉ trình duyệt.
4. Tải `.aab` lên Play Console, điền hồ sơ cửa hàng bằng `docs/play/LISTING.md` (nếu có trong gói).

## 6. Bật thanh toán Google Play Billing (tuỳ chọn)

Mặc định **không bật thanh toán** (`twa-manifest.json`: `features.playBilling.enabled = false`). Chỉ làm khi bạn đã có app trên Play Console với sản phẩm đăng ký.

- Nếu gói có `worker/README.md`: làm theo đó để triển khai Cloudflare Worker (`worker/src/index.js`, `worker/wrangler.toml`: tạo KV, đặt bí mật `GOOGLE_SA_JSON`, `RTDN_KEY`, điền `{{DOMAIN}}` ở `ALLOWED_ORIGINS`), rồi `npx wrangler deploy`.
- Nếu gói có `billing.js`: mở tệp, đặt `API_BASE` thành URL Worker của bạn (`https://<tên-worker>.<subdomain>.workers.dev`), đối chiếu `skus` với mã sản phẩm bạn tạo trong Play Console; đảm bảo `index.html` nạp `billing.js` trước `app.js` (thêm `<script src="billing.js"></script>` nếu chưa có) và `billing.js` có trong mảng `ASSETS` của `sw.js`.
- Đặt `features.playBilling.enabled = true` trong `twa-manifest.json` rồi build lại gói Android.
- Gói **chưa nối `billing.js` và Worker vào giao diện**: bạn cần tự thêm màn hình mua gói/khoá tính năng, nạp `billing.js` và triển khai Worker; Worker hiện chưa có lệnh xoá dữ liệu và chưa đặt hạn lưu, hãy bổ sung trước khi hứa "có thể yêu cầu xoá".
- Cập nhật `privacy.html` mục 4 (đã có mẫu danh sách dữ liệu Worker lưu: mã thiết bị ngẫu nhiên, băm và bản mã hoá của mã giao dịch, gói, trạng thái, hạn), `docs/play/LISTING.md` và mục "Data safety" trên Play Console (khai Purchase history **và** Device or other IDs) **trước khi** phát hành bản có thu phí.
- Nếu gói của bạn **không có** `worker/` hoặc `billing.js`, bỏ qua mục này: sản phẩm vẫn chạy đầy đủ như app miễn phí hoặc bạn tự tích hợp hệ thống thu phí khác.

## 7. Chạy test

```bash
node tests/signals.test.js      # in "OK" nếu bộ máy tín hiệu đúng
```

## Khắc phục sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Không có nút "Cài app" | Không phải HTTPS, manifest lỗi, hoặc đã cài | Kiểm tra DevTools → Application → Manifest |
| Deploy xong vẫn thấy bản cũ | Service worker cũ | Đóng hẳn app rồi mở lại; kiểm tra `sw.js` không bị cache (`_headers`) |
| Giá "—" mãi | Mạng chặn Binance / quá giới hạn tần suất | Đổi mạng; tăng "Làm mới giá" trong Cài đặt |
| App Android hiện thanh địa chỉ | `assetlinks.json` sai/chưa có dấu vân tay | Dán đúng SHA-256 của khoá app signing, deploy lại, chờ vài phút |
| Icon không đổi sau khi thay | Cache | Tăng tên cache trong `sw.js`, gỡ rồi cài lại app |
