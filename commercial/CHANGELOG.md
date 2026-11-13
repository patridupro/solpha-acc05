# Changelog — SOLPHA Futures Desk

Định dạng theo [Keep a Changelog](https://keepachangelog.com/); phiên bản theo [SemVer](https://semver.org/).

## [1.0.0] — Bản thương mại đầu tiên

### Có trong bản này
- PWA tĩnh thương hiệu SOLPHA (giao diện tối), 5 tab: Tín hiệu · Phân tích · Công cụ · Nhật ký · Cài đặt.
- Bảng điều khiển hành động Long/Short/Chờ, xu hướng 5 khung, range/volume nến tín hiệu, giá realtime, mark price, funding.
- Bộ máy tín hiệu `signals.js`: Long A/B, Short S1/S2/S3, Short điều chỉnh, Momentum 4H; kế hoạch SL/TP1/TP2 và khối lượng theo vốn và % rủi ro; bộ lọc giờ nhiễu, funding, RSI, "bám dải".
- Nhiều cặp (mặc định SOL, BTC, ETH, DOGE), thêm/xoá cặp, cài đặt tín hiệu riêng cho từng cặp.
- Công cụ kiểm chứng: Backtest 5M, Tối ưu 30 ngày, Soi lại thời điểm.
- Nhật ký giao dịch có chấm điểm kỷ luật, tổng kết tháng, xuất CSV, sao lưu/khôi phục JSON.
- Quét tự động, thông báo trên thiết bị, âm báo, giữ màn hình sáng tuỳ chọn.
- Service worker mạng-trước, manifest PWA, bộ icon (any + maskable), `_headers`/`_redirects`, `.nojekyll`.
- Gói Android: `twa-manifest.json` (Bubblewrap), `.well-known/assetlinks.json` (mẫu), `play-assets/`, mẫu hồ sơ cửa hàng `docs/play/LISTING.md`.
- Khung Google Play Billing tuỳ chọn: `billing.js` + `worker/` (Cloudflare Worker), mặc định tắt.
- Trang `privacy.html`, `terms.html` (mẫu, cần luật sư soát) với placeholder `{{COMPANY_NAME}}`, `{{CONTACT_EMAIL}}`, `{{WEBSITE}}`.
- Công cụ: `tools/make-icons.js`, `tools/play-assets.js`; test: `tests/signals.test.js`.
- Tài liệu: README, LICENSE (Single/Extended, mẫu), INSTALL, CUSTOMIZE, SUPPORT, ANDROID.

### Lưu ý
- Chỉ dùng dữ liệu công khai của Binance Futures; không kết nối tài khoản sàn.
- Là công cụ phân tích tham khảo, không phải tư vấn tài chính.
