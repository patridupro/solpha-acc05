# Đóng gói Android (Trusted Web Activity) — SOLPHA Futures Desk

App Android chỉ là "vỏ" mở web app của bạn toàn màn hình, không thanh địa chỉ. Mọi tính năng và bản sửa vẫn deploy lên host tĩnh như thường; **không phải phát hành lại trên Google Play mỗi lần sửa web**. Chỉ phát hành lại khi đổi icon, tên, quyền hoặc bật thanh toán.

Điều kiện: web app chạy trên HTTPS (đạt chuẩn PWA như `docs/INSTALL.md` mục 3) và có `/.well-known/assetlinks.json` khớp khoá ký của app (Digital Asset Links). Thiếu hoặc sai tệp này thì app vẫn chạy nhưng hiện thanh địa chỉ Chrome.

> Chính sách và giao diện của Google Play thay đổi thường xuyên. Đối chiếu với tài liệu chính thức của Google Play Console trước khi làm. Tài liệu này không phải tư vấn pháp lý.

## 1. Chuẩn bị

1. Deploy web lên tên miền thật (`docs/INSTALL.md`) và điền `{{DOMAIN}}` trong `twa-manifest.json` (tên miền, không kèm `https://`; các URL `https://{{DOMAIN}}/...` tương ứng).
2. Quyết định **Package ID** (mặc định `app.solpha.desk`). Mỗi ứng dụng một ID duy nhất, không đổi được sau khi phát hành. Nên đổi sang ID thuộc tên miền của bạn, ví dụ `com.tencongty.desk`, trong `twa-manifest.json` (`packageId`) và `.well-known/assetlinks.json` (`package_name`).
3. Điền `{{COMPANY_NAME}}`, `{{CONTACT_EMAIL}}`, `{{WEBSITE}}` trong `privacy.html`, `terms.html`; deploy lại. Play yêu cầu URL chính sách quyền riêng tư công khai.
4. Tạo tài khoản Google Play Console (phí đăng ký một lần; tài khoản cá nhân có thể phải xác minh danh tính và thử nghiệm kín trước khi phát hành, tài khoản tổ chức cần thông tin doanh nghiệp. Đối chiếu yêu cầu hiện hành trên Play Console).

## 2. Đóng gói

**Cách nhanh — PWABuilder (trên trình duyệt):**
1. Vào `pwabuilder.com`, nhập URL web của bạn → **Package for stores → Android**.
2. Điền Package ID, App name, Launcher name, màu theme/nền `#07080c`, Start URL `/`, bật Notifications nếu cần, Signing key **Create new** (lần đầu).
3. Tải zip về: có `.aab` (tải lên Play), keystore + mật khẩu (**lưu rất kỹ, mất là không cập nhật app được**), và `assetlinks.json`.
4. Copy chuỗi `sha256_cert_fingerprints` trong `assetlinks.json` đó vào `.well-known/assetlinks.json` của bạn, deploy lại, kiểm tra mở được `https://<tên-miền>/.well-known/assetlinks.json`.

**Cách chuẩn — Bubblewrap CLI** (Node 18+, JDK 17, Android SDK):
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://<tên-miền>/manifest.webmanifest   # hoặc dùng twa-manifest.json trong gói
bubblewrap build          # ra app-release-bundle.aab + android.keystore
bubblewrap fingerprint    # in SHA-256 để điền assetlinks.json
```

## 3. Play App Signing và assetlinks

Khi Play Console bật Play App Signing (mặc định), Google ký lại app bằng khoá của Google. Vào Play Console → *Setup → App signing* → copy **SHA-256 certificate fingerprint** của *App signing key* và **thêm** vào mảng `sha256_cert_fingerprints` (giữ cả khoá upload nếu bạn muốn thử bản cài thủ công). Thiếu bước này, app cài từ Play sẽ hiện thanh địa chỉ. Tệp mẫu trong gói còn chuỗi `THAY_BANG_SHA256_CUA_KHOA_KY_TU_PLAY_CONSOLE` phải thay bằng dấu vân tay thật.

## 4. Hồ sơ cửa hàng

- `docs/play/LISTING.md` (nếu có trong gói) là mẫu mô tả ngắn/dài và bảng các cụm từ nên tránh. Ảnh icon 512 và feature graphic 1024×500 ở `play-assets/`, sinh lại bằng `node tools/play-assets.js` sau khi đổi thương hiệu. Ảnh chụp màn hình thật nên chụp từ điện thoại, tỷ lệ 9:16.
- Mô tả phải nêu rõ: *công cụ phân tích kỹ thuật, không phải tư vấn đầu tư, không bảo đảm lợi nhuận, futures có thể mất toàn bộ vốn*. Không dùng cụm từ hứa hẹn lợi nhuận ("lãi x%", "thắng 90%"), không dùng tên/logo sàn trong tên app hay icon.
- **App content / Data safety / Financial features declaration:** khai đúng sự thật theo bản bạn phát hành. Bản không thu phí và không có backend: app không thu thập dữ liệu cá nhân (dữ liệu nằm trên thiết bị, chỉ gọi API công khai của Binance). Bản có Billing + Worker: khai dữ liệu giao dịch Worker lưu. Form phải khớp bản đang phát hành.
- Thử theo thứ tự: Internal testing → (Closed testing nếu tài khoản của bạn yêu cầu) → Production.

## 5. Thu phí

- Bán tính năng số **trong app trên Google Play** phải qua **Google Play Billing**; không dẫn người dùng ra ngoài để thanh toán cho tính năng đó. Đọc chính sách Payments của Google Play.
- Khung kỹ thuật có sẵn trong gói (nếu có `billing.js` và `worker/`): xem `docs/INSTALL.md` mục 6. Luồng chung: app (TWA) dùng Digital Goods API + Payment Request → nhận `purchaseToken` → Worker xác minh với Google Play Developer API, acknowledge và lưu quyền lợi → app hỏi Worker khi mở để mở/khoá tính năng. Phần Pro phải được backend kiểm tra, không chỉ ẩn bằng giao diện (web công khai).
- Mô hình thay thế không thu phí trong app: miễn phí + liên kết giới thiệu của chính bạn. Đọc kỹ điều khoản chương trình đó và chính sách nội dung tài chính của Google Play.

## 6. Việc người mua phải tự chịu trách nhiệm

- Giấy phép/đăng ký hoạt động tại quốc gia bạn phát hành; quy định về tư vấn đầu tư, tài sản số, quảng cáo tài chính, thuế.
- Điều khoản Google Play (nội dung tài chính, quảng cáo, thanh toán) và điều khoản API/dữ liệu của Binance, nhất là khi thu phí.
- Chưa có số liệu hiệu quả thực tế đã kiểm chứng thì không công bố tỷ lệ thắng hay lợi nhuận. Backtest chỉ mang tính tham khảo.
- Cảnh báo rủi ro hiển thị rõ trong app và trên cửa hàng.
