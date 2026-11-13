# Hỗ trợ — SOLPHA Futures Desk

> Mẫu để Bên bán chỉnh theo năng lực thực tế. Thay `{{...}}` và các con số cho phù hợp, rồi nhờ luật sư soát nếu bạn cam kết SLA trong hợp đồng.

## Liên hệ

- Email: {{CONTACT_EMAIL}}
- Website/Cổng hỗ trợ: {{WEBSITE}}
- Khi gửi yêu cầu, ghi: mã đơn hàng, mức giấy phép (Single/Extended), phiên bản (`VERSION`), mô tả lỗi, các bước tái hiện, trình duyệt/thiết bị, ảnh chụp màn hình hoặc nội dung Console (F12).

## Thời gian hỗ trợ và SLA mẫu

| Hạng mục | Cam kết mẫu |
|---|---|
| Thời gian hỗ trợ | {{SỐ THÁNG}} tháng kể từ ngày mua (cùng thời hạn cập nhật miễn phí), thứ Hai–thứ Sáu, giờ làm việc {{MÚI GIỜ}} |
| Phản hồi lần đầu | Trong **3 ngày làm việc** kể từ khi nhận đủ thông tin |
| Xử lý lỗi của gói gốc | Cố gắng đưa bản sửa hoặc cách khắc phục trong **10 ngày làm việc** với lỗi tái hiện được; không cam kết thời hạn cố định |
| Kênh | Email; kênh khác do Bên bán công bố |
| Ngôn ngữ | Tiếng Việt, tiếng Anh |

SLA là mục tiêu thiện chí, không phải bảo đảm kết quả. Đây là cam kết mẫu, không thay thế điều khoản trong `LICENSE.md`.

## Phạm vi HỖ TRỢ

- Lỗi trong mã gốc của gói (app không chạy, hiển thị sai, lỗi tính toán chỉ báo, lỗi service worker/PWA) tái hiện được trên bản gốc chưa sửa.
- Hướng dẫn triển khai trên Cloudflare Pages, Netlify, GitHub Pages theo `docs/INSTALL.md`.
- Giải đáp cách dùng các tham số trong `signals.js` và cách đổi cặp, màu, logo theo `docs/CUSTOMIZE.md`.
- Hướng dẫn sinh icon bằng `tools/make-icons.js`, cấu trúc `twa-manifest.json` và `assetlinks.json`.
- Cập nhật tương thích khi Binance đổi API công khai, trong thời hạn cập nhật miễn phí.

## KHÔNG hỗ trợ

- Mã đã bị sửa đổi bởi người mua hoặc bên thứ ba, hay xung đột với mã/thư viện thêm vào (Bên bán có thể gợi ý hướng xử lý nhưng không cam kết).
- Phát triển tính năng riêng, giao diện riêng, tích hợp sàn khác, chuyển sang framework khác (có thể nhận làm dịch vụ riêng có phí).
- **Tư vấn đầu tư, tín hiệu giao dịch, đánh giá lệnh cụ thể, hay bảo đảm lợi nhuận.** Gói là công cụ phân tích, không phải tư vấn.
- Tư vấn pháp lý, thuế, giấy phép hoạt động, soạn/duyệt chính sách quyền riêng tư và điều khoản của sản phẩm của bạn.
- Thủ tục phê duyệt của Google Play (từ chối hồ sơ, khiếu nại chính sách), tài khoản Play Console, xác minh nhà phát triển, thử nghiệm kín. Bên bán chỉ cung cấp hướng dẫn chung.
- Lỗi do dịch vụ bên thứ ba: Binance (chặn vùng, giới hạn tần suất, ngừng API), Cloudflare/Netlify/GitHub, Google, nhà cung cấp tên miền, trình duyệt cũ, thiết bị root/tuỳ biến.
- Cấu hình hạ tầng riêng của bạn (DNS, tường lửa, CDN ngoài), bảo mật máy chủ của bạn, sao lưu của bạn.
- Hỗ trợ trực tiếp cho **người dùng cuối** của sản phẩm bạn phát hành. Bạn chịu trách nhiệm hỗ trợ khách hàng của mình.
- Khôi phục dữ liệu người dùng (dữ liệu lưu trên thiết bị của họ; app có sao lưu JSON nhưng Bên bán không giữ bản sao nào).

## Cập nhật

- Bản cập nhật nhỏ (1.0.x) sửa lỗi và tương thích API; bản 1.x thêm tính năng không phá vỡ. Xem `CHANGELOG.md`.
- Khi nâng cấp, so sánh bản mới với bản đã sửa của bạn bằng công cụ diff; các tệp thường bị bạn sửa nhiều nhất là `index.html`, `styles.css`, `solpha-theme.css`, `manifest.webmanifest`, `privacy.html`, `terms.html`, `icons/`.
- Sau thời hạn cập nhật miễn phí bạn vẫn dùng phiên bản đã mua mãi mãi theo `LICENSE.md`; bản mới hơn cần mua/gia hạn theo chính sách của Bên bán ({{CHÍNH SÁCH GIA HẠN}}).

## Tự khắc phục nhanh

1. Mở `docs/INSTALL.md` mục "Khắc phục sự cố".
2. Chạy `node tests/signals.test.js` để chắc bộ máy tín hiệu vẫn nguyên vẹn.
3. Thử trên bản gốc chưa sửa trong cửa sổ ẩn danh để loại trừ cache và tiện ích trình duyệt.
