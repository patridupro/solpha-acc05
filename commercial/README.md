# SOLPHA Futures Desk — Gói thương mại (v1.0.0)

Ứng dụng web tĩnh (PWA) để theo dõi **điều kiện kỹ thuật futures đa khung** cho SOL, BTC, ETH, DOGE và các cặp bạn thêm. Chạy hoàn toàn trên trình duyệt, không cần máy chủ riêng: lấy dữ liệu công khai từ Binance Futures, tính chỉ báo ngay trên máy người dùng, cài được như app trên Android/iOS/máy tính. Giao diện tối, thương hiệu SOLPHA.

> English summary is at the bottom of this file.

## Cảnh báo — đây là công cụ phân tích, KHÔNG phải tư vấn

- SOLPHA Futures Desk là **công cụ phân tích kỹ thuật tham khảo**. Nó không phải tư vấn đầu tư, tư vấn tài chính, môi giới, tín hiệu "chắc thắng" hay khuyến nghị mua/bán.
- Giao dịch futures có đòn bẩy **có thể mất toàn bộ vốn**, thậm chí vượt vốn. Kết quả backtest không bảo đảm kết quả tương lai.
- Mọi quyết định giao dịch thuộc về người dùng. Người mua gói này (người phát hành app) **tự chịu trách nhiệm pháp lý** về giấy phép/đăng ký tại nơi hoạt động, về nội dung quảng bá, và về việc tuân thủ điều khoản của Google Play và Binance. Hãy dùng mẫu `privacy.html`, `terms.html` làm điểm khởi đầu và nhờ luật sư soát.
- Gói không kết nối tài khoản sàn, không giữ API key, không đặt lệnh thay người dùng.

## Tính năng

- **Bảng điều khiển (tab Tín hiệu):** hành động Long/Short/Chờ, xu hướng 5 khung (5M · 15M · 1H · 4H · 1D), range và volume của nến tín hiệu, giá realtime, mark price, funding.
- **Đồng pha + Bollinger:** chỉ báo EMA9/21, RSI14, ATR14, MACD, Bollinger Bands(20,2) cho từng khung; cảnh báo khi các khung cùng hướng và chạm dải ngoài.
- **Bộ quy tắc kỹ thuật rõ ràng** (`signals.js`): Long A/B (pullback, bứt phá sau nén), Short S1/S2/S3, Điều chỉnh, Momentum 4H; kế hoạch vào lệnh tham khảo gồm SL, TP1/TP2, khối lượng theo vốn và % rủi ro.
- **Nhiều cặp:** thanh cặp, thêm/xoá cặp bất kỳ có trên Binance Futures (tối đa 8), bật/tắt từng điều kiện riêng cho từng cặp trong Cài đặt (các ngưỡng số là tham số trong `signals.js` `DEFAULTS`, sửa bằng mã nguồn).
- **Công cụ mô phỏng:** Backtest 5M (khoảng 5 ngày dữ liệu), Tối ưu 30 ngày, "Soi lại thời điểm" (vì sao lúc đó có/không có điều kiện kỹ thuật). Đây là mô phỏng đơn giản trên dữ liệu quá khứ, không chứng minh kết quả tương lai.
- **Nhật ký giao dịch hằng ngày** có chấm điểm kỷ luật, tổng kết tháng, xuất CSV, sao lưu/khôi phục JSON.
- **Quét tự động + thông báo** trên thiết bị (khi app đang mở), âm báo, giữ màn hình sáng tuỳ chọn.
- **PWA:** cài được, chạy offline phần giao diện (service worker, mạng-trước), tự cập nhật sau mỗi lần deploy.
- **Có cấu hình đóng gói Android (bạn tự build, ký và gửi duyệt):** `twa-manifest.json` (Bubblewrap), `.well-known/assetlinks.json` (còn chỗ trống dấu vân tay), ảnh Google Play (`play-assets/`), mẫu mô tả cửa hàng (`docs/play/LISTING.md`). Gói không kèm bản `.aab` đã ký.
- **Backend + thư viện Google Play Billing kèm theo nhưng CHƯA nối vào giao diện** (nếu có `billing.js` và thư mục `worker/`): Cloudflare Worker xác minh giao dịch và thư viện phía app. `index.html` không nạp `billing.js`, chưa có màn hình mua gói, Worker chưa triển khai: bạn cần tự tích hợp (xem `docs/INSTALL.md` mục 6). Mặc định tắt.
- Phông Roboto **tự host trong gói** (thư mục `fonts/`), app không gọi Google Fonts.
- Không phụ thuộc framework hay bước build: HTML + CSS + JavaScript thuần.

## Cấu trúc tệp

```
fonts/                Phông Roboto (woff2) tự host, kèm giấy phép phông
index.html            Giao diện chính (5 tab: Tín hiệu · Phân tích · Công cụ · Nhật ký · Cài đặt)
privacy.html          Mẫu chính sách quyền riêng tư (điền {{...}} rồi nhờ luật sư soát)
terms.html            Mẫu điều khoản + cảnh báo rủi ro (điền {{...}})
app.js                Logic giao diện, lấy dữ liệu Binance, quét, thông báo, backtest
signals.js            Bộ máy tín hiệu + chỉ báo (EMA, RSI, ATR, Bollinger); tham số ở DEFAULTS
journal.js            Nhật ký giao dịch
billing.js            (tuỳ chọn) Thư viện Google Play Billing phía app
brand.js              Khai báo thương hiệu rút gọn
styles.css            Kiểu dáng gốc + biến màu (:root)
solpha-theme.css      Giao diện tối SOLPHA (khối biến màu và các luật theo html[data-brand])
sw.js                 Service worker (cache + thông báo)
manifest.webmanifest  Web App Manifest (tên, màu, icon)
icons/                Bộ icon PNG + icon.svg (sinh lại bằng tools/make-icons.js)
_headers, _redirects  Cấu hình cho Cloudflare Pages / Netlify
.nojekyll             Cho GitHub Pages
twa-manifest.json     Cấu hình Bubblewrap (Android)
.well-known/          assetlinks.json (liên kết app Android với tên miền)
play-assets/          Icon 512 + feature graphic cho Google Play
worker/               (tuỳ chọn) Cloudflare Worker xác minh Play Billing
tools/                make-icons.js, play-assets.js (cần Playwright)
tests/                signals.test.js — kiểm tra bộ máy tín hiệu
docs/                 INSTALL, CUSTOMIZE, SUPPORT, ANDROID, play/LISTING
LICENSE.md            Giấy phép thương mại (mẫu, cần luật sư soát)
CHANGELOG.md
```

## Yêu cầu

- **Để chạy/triển khai:** chỉ cần một dịch vụ lưu trữ tệp tĩnh (Cloudflare Pages, Netlify, GitHub Pages...) có **HTTPS** và một tên miền. Không cần Node.js.
- **Để phát triển cục bộ:** trình duyệt hiện đại (Chrome/Edge/Safari/Firefox), Python 3 hoặc Node 18+ để mở máy chủ tĩnh thử (`python3 -m http.server 8080`).
- **Để chạy test:** Node 18+ (`node tests/signals.test.js`).
- **Để sinh icon / ảnh Play:** Node 18+, `npm i playwright` và Chromium (`npx playwright install chromium`).
- **Để đóng gói Android:** tài khoản Google Play Console, và PWABuilder (web) hoặc Bubblewrap (cần JDK 17 + Android SDK).
- **Để bật thanh toán Play:** tài khoản Cloudflare (Worker + KV) và Google Cloud service account.
- Người dùng cuối cần truy cập được `fapi.binance.com` / `fapi1.binance.com` / `fstream.binance.com` / `api.binance.com` (một số quốc gia/mạng chặn Binance; khi bị chặn app hiện thông báo và không có dữ liệu).

## Bắt đầu nhanh

1. Giải nén gói, mở `docs/INSTALL.md`.
2. Tìm và điền mọi `{{...}}` (xem bảng trong INSTALL: `{{DOMAIN}}`, `{{COMPANY_NAME}}`, `{{CONTACT_EMAIL}}`, `{{WEBSITE}}`).
3. Deploy thư mục gốc lên host tĩnh, kiểm tra cài được như app.
4. Đổi tên/màu/logo theo `docs/CUSTOMIZE.md` nếu cần.

## Giấy phép và hỗ trợ

Xem `LICENSE.md` (Single / Extended) và `docs/SUPPORT.md`.

---

## English summary

**SOLPHA Futures Desk** is a static PWA (plain HTML/CSS/JS, no build step, no server of its own) that tracks multi-timeframe futures technical conditions for SOL, BTC, ETH, DOGE and any pair you add. It pulls public Binance Futures data, computes EMA/RSI/ATR/MACD/Bollinger in the browser, shows a cockpit with Long/Short/Wait, a reference trade plan (SL/TP, position size from equity and risk %), a 5M backtest (about 5 days), a 30-day optimiser, a replay tool, per-pair on/off switches for each rule (numeric thresholds live in `signals.js` `DEFAULTS`), a daily trading journal with discipline scoring, notifications, and installs as an app. Android packaging configuration (Bubblewrap/TWA, Digital Asset Links, Play Store graphics and listing template; you build, sign and submit the app yourself) is included, as are a Google Play Billing backend (Cloudflare Worker) and client library that are NOT yet connected to the interface (you need to integrate them). The Roboto font is self-hosted in the package; the app does not call Google Fonts.

**Requirements:** any static HTTPS host and a domain; Node 18+ only for tests and icon generation; Google Play Console for Android.

**Quick start:** unzip, read `docs/INSTALL.md`, fill in every double-brace placeholder, deploy the folder root, verify the app is installable, optionally rebrand via `docs/CUSTOMIZE.md`.

**Warning:** this is an analysis tool, **not financial advice**. Leveraged futures trading can lose all your capital; backtests do not predict the future. You, the buyer/publisher, are responsible for the licences and registrations required where you operate, for your marketing claims, and for complying with Google Play and Binance terms. The privacy policy and terms pages are templates: have a lawyer review them. See `LICENSE.md` and `docs/SUPPORT.md`.
