# SOLPHA lên Google Play và thu phí — hướng dẫn đầy đủ

Cập nhật 12/11/2026. Mục tiêu: đưa web app SOLPHA (https://solpha.pages.dev) thành app Android trên Google Play và bán gói trả phí.

## 0. Ba quyết định phải chốt trước khi làm bất cứ việc gì

| Quyết định | Phương án | Hệ quả |
|---|---|---|
| **Pháp nhân phát hành** | (a) Tài khoản cá nhân · (b) Tài khoản tổ chức (công ty) | Cá nhân: 25 USD, xác minh CCCD, **bắt buộc thử nghiệm kín 12 người × 14 ngày** trước khi được phát hành. Tổ chức: cần mã D-U-N-S (xin miễn phí, tới 30 ngày), không phải thử nghiệm kín. Tiền bán app về tài khoản ngân hàng của pháp nhân này và chịu thuế theo pháp nhân này. |
| **Thương hiệu** | (a) SOLPHA độc lập · (b) gắn ETEK Power | ETEK Power là công ty năng lượng. Gắn thương hiệu vào sản phẩm tín hiệu futures crypto bán cho công chúng là **rủi ro uy tín và pháp lý cho ETEK** nếu khách thua lỗ hoặc cơ quan quản lý hỏi tới. Khuyến nghị: SOLPHA độc lập, pháp nhân riêng. |
| **Mô hình thu phí** | (a) Gói đăng ký tháng/năm · (b) Mua một lần · (c) Miễn phí + affiliate Binance | (a)/(b) **bắt buộc** đi qua Google Play Billing, Google giữ 15% (doanh thu < 1 triệu USD/năm; gói đăng ký 15% từ ngày đầu). (c) không mất phí Google, không cần backend, nhưng doanh thu phụ thuộc khối lượng giao dịch của người dùng. |

`packageId` (hiện đặt `app.solpha.desk` trong `twa-manifest.json`) **không đổi được** sau lần tải lên Play Console đầu tiên. Chốt tên trước.

## 1. Kiến trúc: web app → app Android (Trusted Web Activity)

App Android chỉ là "vỏ" mở đúng web app https://solpha.pages.dev toàn màn hình, không thanh địa chỉ. Mọi tính năng, sửa lỗi vẫn deploy qua Cloudflare như hiện nay; **không phải phát hành lại trên Play mỗi lần sửa**. Chỉ phát hành lại khi đổi icon, tên, quyền, hoặc bật thanh toán.

Điều kiện: web app đạt chuẩn PWA (đã đạt), có file `/.well-known/assetlinks.json` khớp khoá ký của app (Digital Asset Links). Thiếu hoặc sai file này thì app vẫn chạy nhưng hiện thanh địa chỉ Chrome.

## 2. Việc đã làm sẵn trong repo

| File | Việc |
|---|---|
| `.well-known/assetlinks.json` | Khai báo liên kết app ↔ web. Còn chỗ trống `THAY_BANG_SHA256...` phải điền ở bước 4. |
| `_headers` | Trả đúng `Content-Type: application/json` cho file trên. |
| `privacy.html`, `terms.html` | Chính sách quyền riêng tư và điều khoản + cảnh báo rủi ro (Play bắt buộc có URL chính sách riêng tư). Điền `[TÊN PHÁP NHÂN]`, `[EMAIL]`, `[WEBSITE]`. |
| `twa-manifest.json` | Cấu hình Bubblewrap (packageId, màu, icon, startUrl, Play Billing tắt). |
| `tools/play-assets.js` | Tạo icon 512 (nền xanh, không trong suốt) và feature graphic 1024×500 vào thư mục `play-assets/`. |
| Footer app | Link tới hai trang pháp lý. |

## 3. Tạo tài khoản Google Play Console

1. https://play.google.com/console → đăng ký, phí 25 USD một lần.
2. Cá nhân: xác minh danh tính (CCCD) và số điện thoại. Tổ chức: D-U-N-S + giấy tờ công ty.
3. **Hồ sơ thanh toán (Payments profile)**: Google hỗ trợ đăng ký người bán tại Việt Nam, tiền tệ mặc định VND. Cần tài khoản ngân hàng đứng tên đúng pháp nhân. Thuế: Google là bên bán hàng (merchant of record) với người mua; khoản Google trả cho anh là doanh thu của anh và kê khai thuế theo pháp nhân.

## 4. Đóng gói app (không cần cài Android Studio)

**Cách nhanh — PWABuilder (trên trình duyệt):**
1. Vào https://www.pwabuilder.com → nhập `https://solpha.pages.dev` → **Package for stores → Android**.
2. Điền: Package ID `app.solpha.desk` (đúng như `twa-manifest.json`), App name `SOLPHA · Futures Desk`, Launcher name `SOLPHA`, Theme color `#07080c`, Background `#07080c` (thương hiệu SOLPHA), Start URL `/?source=play`, bật **Notifications**, Signing key: **Create new** (lần đầu).
3. Tải về file zip. Trong zip có: `app-release-bundle.aab` (tải lên Play), `signing.keystore` + mật khẩu (**lưu kỹ, mất là không cập nhật app được nữa**), `assetlinks.json`.
4. Mở `assetlinks.json` trong zip, copy chuỗi `sha256_cert_fingerprints` vào file `.well-known/assetlinks.json` của repo, commit, push. Kiểm tra: mở https://solpha.pages.dev/.well-known/assetlinks.json phải thấy đúng chuỗi.
5. Khi Play Console bật **Play App Signing** (mặc định), Google ký lại app bằng khoá của Google. Vào Play Console → *Setup → App signing* → copy **SHA-256 certificate fingerprint** của *App signing key* và **thêm** vào mảng `sha256_cert_fingerprints` (giữ cả hai chuỗi). Thiếu bước này app cài từ Play sẽ hiện thanh địa chỉ.

**Cách chuẩn — Bubblewrap (máy tính có Node ≥ 18, JDK 17, Android SDK):**
```
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://solpha.pages.dev/manifest.webmanifest   # hoặc dùng sẵn twa-manifest.json trong repo
bubblewrap build        # ra app-release-bundle.aab + android.keystore
bubblewrap fingerprint  # in SHA-256 để điền assetlinks.json
```

## 5. Tạo app trên Play Console và tải lên

1. **Create app**: tên `SOLPHA · Futures Desk`, ngôn ngữ mặc định Tiếng Việt, loại App, Free (đổi sang có mua trong app sau).
2. **Store listing** (ảnh tạo bằng `node tools/play-assets.js`, ảnh chụp màn hình chụp từ điện thoại khi đang chạy dữ liệu thật, ≥ 2 ảnh, tỷ lệ 9:16):
   - Tên ≤ 30 ký tự: `SOLPHA · Futures Desk`
   - Mô tả ngắn ≤ 80: `Tín hiệu nến 5M theo xu hướng đa khung cho SOL, BTC, ETH futures`
   - Mô tả dài: nêu rõ *công cụ phân tích kỹ thuật, không phải tư vấn đầu tư, không bảo đảm lợi nhuận, futures có thể mất toàn bộ vốn*. Google từ chối app tài chính hứa hẹn lợi nhuận.
   - Danh mục: Finance. Email liên hệ bắt buộc.
3. **App content** (mục Policy): Privacy policy URL `https://solpha.pages.dev/privacy.html` · Ads: không · Data safety: *không thu thập, không chia sẻ dữ liệu* (đúng với app hiện tại) · Content rating: làm bảng hỏi IARC · Target audience: 18+ · **Financial features declaration**: khai "công cụ phân tích thị trường, không phải sàn, không ví, không cho vay" · Government apps: không.
4. **Testing**: tải `.aab` lên **Internal testing** trước (tối đa 100 người, hiệu lực ngay) để tự kiểm tra bản cài từ Play.
5. **Closed testing** (bắt buộc với tài khoản cá nhân tạo sau 13/11/2023): tạo danh sách email ≥ 12 người, họ cài và **giữ tham gia liên tục 14 ngày**; rớt một người là đếm lại. Sau 14 ngày bấm *Apply for production access*, trả lời bảng hỏi về quá trình thử nghiệm.
6. **Production**: tải lên, chọn quốc gia phát hành, gửi duyệt. Duyệt lần đầu thường 2–7 ngày; app tài chính có thể lâu hơn.

## 6. Thu phí — ba lựa chọn

### 6a. Gói đăng ký qua Google Play Billing (chuẩn Play, cần backend)
Google bắt buộc: bán tính năng số trong app trên Play phải qua Play Billing; không được dẫn ra ngoài để thanh toán.

Việc cần làm (ước lượng 2–3 ngày code + thời gian duyệt):
1. **Play Console → Monetize → Subscriptions**: tạo sản phẩm, ví dụ `solpha_pro_monthly` (giá đề xuất 199.000–299.000 đ/tháng) và `solpha_pro_yearly`. Thêm bản dùng thử 7 ngày để giảm hoàn tiền.
2. **Đóng gói lại app với Play Billing bật**: trong `twa-manifest.json` đặt `features.playBilling.enabled = true` (PWABuilder có ô tương ứng), build lại, tải phiên bản mới.
3. **Trong web app** (chỉ chạy khi mở từ app Play, có `window.getDigitalGoodsService`):
   - `getDigitalGoodsService('https://play.google.com/billing')` → `getDetails(['solpha_pro_monthly'])` lấy giá hiển thị.
   - Bấm mua → `new PaymentRequest([{ supportedMethods: 'https://play.google.com/billing', data: { sku } }]).show()` → nhận `purchaseToken`.
   - Gửi `purchaseToken` lên backend để xác minh.
4. **Backend nhỏ** (Cloudflare Worker, cùng hạ tầng Pages, miễn phí ở quy mô nhỏ): gọi Google Play Developer API `purchases.subscriptionsv2.get` bằng service account để xác minh và **acknowledge** (không acknowledge trong 3 ngày Google tự hoàn tiền), lưu quyền vào KV theo `purchaseToken`/định danh thiết bị; nhận Real-time Developer Notifications (Pub/Sub) để biết huỷ/hết hạn. Web app hỏi backend khi mở để mở/khoá tính năng.
5. **Khoá tính năng**: bản miễn phí xem SOL + bảng Phân tích; bản Pro mở thêm cặp, kế hoạch lệnh, thông báo, Backtest/Tối ưu/Soi lại. Vì web app công khai, phần Pro phải được backend kiểm tra, không chỉ ẩn bằng giao diện.
6. **Bản web ở solpha.pages.dev**: hoặc khoá tính năng Pro giống app, hoặc chỉ dùng làm trang giới thiệu dẫn tới Play. Nếu bản web miễn phí có đủ tính năng thì không ai trả tiền trên Play.

### 6b. Mua một lần (in-app product)
Giống 6a nhưng sản phẩm là `inapp` không gia hạn; xác minh bằng `purchases.products.get`. Đơn giản hơn, doanh thu một lần.

### 6c. Miễn phí + affiliate Binance (nhanh nhất, không backend)
Đăng ký Binance Affiliate, gắn link giới thiệu trong app ("Mở tài khoản Binance Futures"). Nhận % phí giao dịch của người đăng ký qua link. Không qua Play Billing (không bán hàng số trong app) nên không mất 15%. Cần đọc kỹ điều khoản affiliate của Binance và chính sách tài chính của Google Play (app không được là sàn/ví không phép; chỉ dẫn link ra sàn thì được, nhưng phải khai trong Financial features declaration).

## 7. Rủi ro phải xử lý trước khi bán

1. **Kết quả chưa được chứng minh.** Backtest trong app mới chạy 5–30 ngày, nhiều bộ điều kiện 0–6 lệnh. Bán tín hiệu chưa có thống kê thật là nhận rủi ro hoàn tiền, đánh giá 1 sao và khiếu nại. Việc nên làm: chạy app 60–90 ngày, ghi **mọi** tín hiệu vào nhật ký (app đã có), công bố tỷ lệ thắng, R trung bình, chuỗi thua; chỉ bán khi số liệu đứng vững.
2. **Chính sách Google Play về tài chính và crypto**: cấm hứa hẹn lợi nhuận, cấm đào coin, sàn/ví cần giấy phép; app phân tích thì được nhưng phải khai Financial features. Mô tả và ảnh cửa hàng không được dùng chữ "lợi nhuận x%", "thắng 90%".
3. **Pháp lý Việt Nam**: Luật Công nghiệp công nghệ số (hiệu lực 01/01/2026) và Nghị quyết 05/2025/NQ-CP thí điểm thị trường tài sản mã hoá; giao dịch phái sinh trên sàn quốc tế không nằm trong khung thí điểm. Bán dịch vụ hỗ trợ giao dịch futures cho công chúng cần luật sư xác nhận trước khi thu tiền, đặc biệt nếu dùng pháp nhân công ty.
4. **Dữ liệu Binance**: app dùng API công khai. Trước khi thu phí, đọc Binance API Terms of Use về dùng dữ liệu cho mục đích thương mại; nếu bị chặn IP theo vùng thì app mất nguồn dữ liệu.
5. **Thông báo 24/7**: web app chỉ quét khi mở. Khách trả tiền sẽ kỳ vọng cảnh báo khi tắt màn hình → cần máy chủ quét + Web Push/Telegram (chưa có). Nên làm trước khi bán gói đăng ký.

## 8. Lộ trình đề xuất

| Giai đoạn | Việc | Thời gian |
|---|---|---|
| 1. Lên Play miễn phí | Chốt pháp nhân + tên gói · tài khoản Console · PWABuilder · assetlinks · listing · internal test · closed test 12×14 ngày · production | 3–5 tuần (phần lớn là chờ) |
| 2. Chứng minh hiệu quả | Chạy thật, nhật ký đầy đủ, công bố thống kê; làm máy chủ cảnh báo 24/7 | song song, 60–90 ngày |
| 3. Thu phí | Backend xác minh Play Billing · khoá tính năng Pro · bản dùng thử 7 ngày · phát hành bản có thanh toán | 1–2 tuần sau khi chốt mô hình |

Nguồn: [Google Play — yêu cầu thử nghiệm kín với tài khoản cá nhân](https://support.google.com/googleplay/android-developer/answer/14151465) · [Google Play — quốc gia hỗ trợ đăng ký người bán](https://support.google.com/googleplay/android-developer/answer/9306917) · [Chrome — nhận thanh toán Play Billing trong Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing) · [Mẫu PWA Play Billing của Google](https://github.com/chromeos/pwa-play-billing).
