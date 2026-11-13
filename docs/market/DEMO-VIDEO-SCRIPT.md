# SOLPHA Futures Desk — Kịch bản video demo 60–90 giây

Mục tiêu: cho người mua mã nguồn thấy **sản phẩm chạy thật**, cấu trúc gói và các giới hạn, trong 60–90 giây. Không bán lợi nhuận, không bán tín hiệu. Tổng thời lượng mục tiêu: **~80 giây**.

Định dạng: bản chính **dọc 1080×1920** (điện thoại; hợp Gumroad/ Product Hunt/ mạng xã hội) và bản **ngang 1920×1080** (trang bán) dựng cùng nội dung. Có phụ đề cứng (tiếng Anh cho bán quốc tế; tiếng Việt cho kênh Việt). Giọng đọc rõ, nhạc nền rất nhỏ hoặc không có. Xuất MP4 H.264, ≤ 90 giây.

---

## 0. Chuẩn bị trước khi quay

| Việc | Chi tiết |
|---|---|
| Bản chạy | Triển khai sạch trên **tên miền demo của bạn** (xem `SELLER-CHECKLIST.md` mục F). Mở bằng Chrome, xoá cache và dữ liệu cũ để vào đúng lần đầu (hộp "Trước khi dùng" sẽ hiện, đó là cảnh quay có ích). |
| Dữ liệu | Dùng dữ liệu công khai đang chạy. **Vốn mẫu 1.000 USDT, rủi ro 1%**. Nhật ký: nhập 3–5 ngày mẫu bằng ví dụ giả, ghi rõ "dữ liệu mẫu" trong video. Không vị thế thật, không số dư thật. |
| Màn hình | Điện thoại thật (hoặc DevTools giả lập 390×844, DPR 3). Tắt thông báo hệ thống, ẩn thanh trạng thái cá nhân, đặt giờ/pin trung tính. |
| Công cụ | Ghi màn hình hệ thống (Android: Ghi màn hình; PC: OBS 1080p 30fps). Chỉnh bằng CapCut/DaVinci Resolve/ffmpeg. |
| Nhạc/phông | Chỉ dùng nhạc có giấy phép sử dụng thương mại (ghi nguồn). Phông chữ phụ đề không ràng buộc. |
| Cấm xuất hiện | Logo/ứng dụng Binance hay sàn khác, ảnh lãi/lỗ thật, email/tên thật, tài khoản GitHub cá nhân, thanh địa chỉ của máy chủ nội bộ, URL cũ chứa tên đơn vị khác, các thông báo ngoài app. |
| Quay thử | Quay thử 1 lần, xem lại có lộ thông tin cá nhân không; tách riêng từng cảnh để dễ cắt. |

---

## 1. Kịch bản từng cảnh

Thời lượng cảnh là mục tiêu. Lời đọc: bản Việt (VI) và bản Anh (EN) tương đương. Chữ trên màn hình (OST) ngắn, ≤ 6 từ.

### Cảnh 1 — Mở đầu và cảnh báo (0:00–0:08)
- **Hình:** logo SOLPHA trên nền tối (2 giây) → mở app lần đầu, hiện hộp "Trước khi dùng"; con trỏ dừng 1 giây rồi bấm "Tôi đã hiểu và đồng ý".
- **OST:** "SOLPHA Futures Desk · Mã nguồn PWA"
- **VI:** "SOLPHA Futures Desk: mã nguồn một ứng dụng PWA phân tích futures. Không phải tư vấn đầu tư."
- **EN:** "SOLPHA Futures Desk: the source code of a futures-analysis PWA. Not investment advice."
- **Mục đích:** đặt khung đúng ngay từ giây đầu.

### Cảnh 2 — Giá realtime và nhiều cặp (0:08–0:20)
- **Hình:** màn hình chính, thanh tab SOL / BTC / ETH / DOGE với giá và %24h nhảy theo thời gian thực; bấm đổi sang BTC, rồi ETH. Bấm nút "＋" (Thêm cặp), gõ một cặp USDT (ví dụ `XRP`), thêm vào, thấy tab mới.
- **OST:** "Realtime · Tối đa 8 cặp"
- **VI:** "Giá và nến chạy realtime qua WebSocket công khai. Thêm bất kỳ cặp USDT nào trên Futures, tối đa tám cặp."
- **EN:** "Prices and candles stream in real time over public WebSockets. Add any USDT futures pair, up to eight."

### Cảnh 3 — Chỉ báo đa khung (0:20–0:32)
- **Hình:** mục "Đa khung" và "Đồng pha": cuộn qua 5M, 15M, 1H, 4H, 1D với EMA/Bollinger/RSI/ATR/MACD. Phóng nhẹ vào ô "Cảnh báo BB".
- **OST:** "EMA · BB · RSI · ATR · MACD · 5M→1D"
- **VI:** "Năm chỉ báo trên năm khung, từ năm phút đến một ngày, cùng với đánh giá đồng pha giữa các khung."
- **EN:** "Five indicators across five timeframes, from 5 minutes to 1 day, plus a multi-timeframe alignment view."

### Cảnh 4 — Quy tắc nến và kế hoạch lệnh (0:32–0:44)
- **Hình:** mục "Nến tín hiệu": hiện trạng thái quét (nếu đang CHỜ thì hiện đúng CHỜ, **không dựng tín hiệu giả**). Cuộn tới "Lệnh tham khảo" (hoặc hiện ví dụ khi có điều kiện); chỉ ra vào lệnh 3 phần, SL, TP, khối lượng theo vốn mẫu 1.000 USDT và rủi ro 1%. Nếu lúc quay không có kế hoạch, dùng "Soi lại" ở cảnh sau để minh hoạ.
- **OST:** "Quy tắc cố định · Có thể chỉnh"
- **VI:** "Bộ quy tắc nến cố định, có tài liệu, chỉnh được từng thông số. Kế hoạch tham khảo chia vào lệnh ba phần và tính khối lượng theo vốn và phần trăm rủi ro bạn nhập."
- **EN:** "Fixed, documented candle rules with adjustable parameters. The planner splits entries into three parts and sizes the position from your capital and risk percentage."
- **Lưu ý:** nói "hiển thị điều kiện", đừng nói "tín hiệu mua" hay "cơ hội".

### Cảnh 5 — Backtest, Tối ưu 30 ngày, Soi lại (0:44–0:58)
- **Hình:** "Công cụ kiểm chứng": bấm "Backtest 5M (~5 ngày)" rồi "Tối ưu 30 ngày" (tua nhanh phần tải, hiện thanh tiến trình thật, ghi "tua nhanh ×4"). Hiện bảng kết quả **nguyên trạng** (kể cả điều kiện không đạt chuẩn, cột nửa đầu/nửa sau). Sau đó chọn ngày giờ và bấm "Soi lại 3 giờ" để hiện danh sách nến kèm lý do.
- **OST:** "Chạy ngay trên trình duyệt" → "Mô phỏng, không phải bằng chứng"
- **VI:** "Backtest và tối ưu ba mươi ngày chạy ngay trong trình duyệt, đã trừ phí và trượt giá. Đây là mô phỏng nhỏ để hiểu quy tắc, không chứng minh kết quả tương lai. Chức năng soi lại cho từng nến lý do quyết định."
- **EN:** "Backtest and 30-day optimizer run entirely in your browser, net of fees and slippage. It is a small simulation to understand the rules, not proof of future results. Replay shows the reason behind each candle's decision."
- **Quy tắc:** không cắt, không làm nổi bật con số đẹp; nếu kết quả xấu, vẫn để nguyên.

### Cảnh 6 — Nhật ký có chấm điểm kỷ luật (0:58–1:06)
- **Hình:** tab "Nhật ký": ngày mẫu, tick các tiêu chí, bấm "Lưu nhật ký", cuộn "Tổng kết tháng" (điểm TB, chuỗi kỷ luật). Bấm "Xuất CSV tháng" (hiện tệp tải xuống, **không mở ra nếu có dữ liệu thật**).
- **OST:** "Nhật ký · Điểm kỷ luật · CSV/JSON"
- **VI:** "Nhật ký chấm điểm kỷ luật theo năm tiêu chí có trọng số; dữ liệu lưu trên máy bạn, xuất được CSV và sao lưu JSON."
- **EN:** "A journal that scores your discipline on five weighted criteria. Data stays on your device; export CSV or back up as JSON."

### Cảnh 7 — Cài như app và thông báo (1:06–1:12)
- **Hình:** nút "Cài app" → cài → mở từ icon trên màn hình chính (hiện toàn màn hình, không thanh địa chỉ). Vào Cài đặt, bấm "Gửi thông báo thử" và hiện thông báo hệ thống.
- **OST:** "Cài như app · Thông báo cục bộ"
- **VI:** "Cài như một ứng dụng và nhận thông báo cục bộ khi app đang chạy."
- **EN:** "Installs like a native app with local notifications while the app is running."

### Cảnh 8 — Những gì có trong gói (1:12–1:22)
- **Hình:** thoát sang trình soạn mã/trình duyệt tệp: mở cây thư mục (`index.html`, `app.js`, `signals.js`, `journal.js`, `billing.js`, `worker/`, `twa-manifest.json`, `docs/`, `tests/`). Chạy `node tests/signals.test.js` (kết quả hiển thị "OK"). Hiện nhanh `worker/` với 39 test qua. **Chỉ hiện tệp đã dọn sạch** (xem checklist mục C).
- **OST:** "App · Worker Play Billing · TWA · Tài liệu · Test"
- **VI:** "Bạn nhận toàn bộ mã nguồn: ứng dụng, Cloudflare Worker xác minh Google Play Billing, cấu hình Android, tài liệu và bộ test. Bạn tự triển khai."
- **EN:** "You get the full source: the app, a Cloudflare Worker that verifies Google Play Billing, Android configuration, documentation and tests. You deploy it yourself."

### Cảnh 9 — Giới hạn và kêu gọi (1:22–1:30)
- **Hình:** thẻ chữ trên nền tối, đọc chậm, ít nhất 5 giây:
  - "Không kèm tín hiệu. Không bảo đảm lợi nhuận. Không phải tư vấn đầu tư."
  - "Giao diện tiếng Việt · Cảnh báo chỉ khi app mở · Cần tự triển khai"
  - "Không liên kết với Binance hoặc Google."
  - Đường dẫn trang bán: `[URL TRANG BÁN]`
- **VI:** "Mã nguồn công cụ, không phải tín hiệu và không bảo đảm lợi nhuận. Giao diện tiếng Việt, cảnh báo hoạt động khi app đang mở, và bạn cần tự triển khai. Chi tiết ở trang bán."
- **EN:** "Source code of a tool, not signals, and no promise of profit. The interface is in Vietnamese, alerts work while the app is open, and you deploy it yourself. Details on the sales page."

---

## 2. Bản rút gọn 60 giây (nếu nền tảng giới hạn)

Giữ cảnh 1 (6 giây), 2 (9), 3 (9), 5 (14), 8 (9), 9 (8); bỏ cảnh 4, 6, 7; tổng ~55–60 giây. Vẫn phải có câu "Không phải tư vấn đầu tư" và "không bảo đảm lợi nhuận".

---

## 3. Danh sách kiểm tra trước khi đăng

☐ Không có ảnh lãi/lỗ, số dư thật, logo sàn, tên/địa chỉ không thuộc SOLPHA.
☐ Không có từ "lợi nhuận", "kiếm tiền", "tỷ lệ thắng", "chính xác", "bot", "tín hiệu mua/bán" trong lời đọc, OST và phụ đề.
☐ Kết quả backtest/tối ưu hiện đúng như app trả ra; nếu có điều kiện không đạt, vẫn nhìn thấy.
☐ Câu cảnh báo cuối đọc đủ và hiện đủ ≥ 5 giây.
☐ Âm nhạc có giấy phép thương mại; ghi nguồn nếu giấy phép yêu cầu.
☐ Phụ đề không sai chính tả; tên sản phẩm đúng "SOLPHA Futures Desk".
☐ Hình ảnh khớp với phiên bản đang bán (1.0.0); nếu giao diện đổi, quay lại.
☐ Đã xem lại toàn bộ video ở tốc độ chậm để dò thông tin cá nhân ở góc màn hình.
☐ Mô tả video có: link trang bán, câu "Không phải tư vấn đầu tư", ngày quay, phiên bản.

## 4. Mẫu mô tả video (dán)

```
SOLPHA Futures Desk v1.0.0 — source code of a self-hosted futures analysis PWA (HTML/CSS/vanilla JS, Cloudflare Worker for Google Play Billing included).
Not investment advice. No trading signals included or guaranteed. No profit claims. Simulation results are not evidence of future performance. UI in Vietnamese. Self-deployment required.
Not affiliated with Binance or Google.
Details: [URL TRANG BÁN]
Recorded [NGÀY QUAY] with sample data.
```
