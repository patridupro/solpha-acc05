# SOLPHA · Futures Desk — Kế hoạch 8 ảnh chụp màn hình Google Play

Cập nhật 13/11/2026 · Kích thước mỗi ảnh: **1080 × 1920 px** (dọc, tỷ lệ 9:16), PNG hoặc JPEG 24 bit không kênh alpha.

Giới hạn kỹ thuật của Play (số ảnh tối thiểu/tối đa, kích thước, dung lượng): **chưa xác nhận bằng tìm kiếm trong phiên này**; 1080×1920 và 8 ảnh nằm trong mức thường gặp. Đối chiếu ở trang Main store listing khi tải lên.

Căn cứ chính sách: Metadata policy áp dụng cho tên, icon, mô tả, **ảnh chụp màn hình và ảnh quảng bá**; cấm metadata gây hiểu nhầm và chữ/hình trong tên, icon, tên nhà phát triển ám chỉ xếp hạng hoặc giá [Xác nhận từ kết quả tìm kiếm ngày 13/11/2026; nguyên văn trang gốc chưa mở được]. Ảnh chụp phải phản ánh đúng app thật đang chạy.

Phần chữ phụ đề (≤ 40 ký tự mỗi ảnh) đặt trên dải ngang phía trên ảnh, nền tối đồng màu giao diện app (`#07080c`), chữ trắng Roboto Bold ~64 px, tối đa 1 dòng (nếu tràn dòng thì rút gọn, không giảm cỡ chữ dưới 56 px). Không emoji, không biểu tượng ngôi sao, không mũi tên lên xuống màu xanh/đỏ trong phụ đề.

---

## 1. Quy tắc chung (áp dụng cho cả 8 ảnh)

**Không có số liệu lãi/lỗ hay kết quả giao dịch**
- Không PnL, không tổng R, không "R TB", không số lãi hay lỗ, không đường cong vốn, không "chạm TP ✓", không "chạm SL ✗".
- Không tỷ lệ phần trăm đi kèm chữ "thắng", "win", "đúng", "chính xác", "hiệu quả".
- Không điểm hạng A/B/C/D của nhật ký, không con số "Điểm: 92", không đếm "số ngày đạt" theo tỷ lệ.
- Không so sánh trước/sau, không "bắt đáy", không "x2 tài khoản".

**Quy tắc không dùng nhãn "thắng 90%"** (và các nhãn tương tự)
- Cấm trong ảnh, phụ đề, ảnh bìa, video: "thắng 90%", "win 90%", "tỷ lệ thắng cao", "chính xác 9x%", "AI dự đoán đúng", "lợi nhuận đảm bảo", "kiếm tiền", "x2", "không thua".
- Nếu chụp màn hình có cột "Thắng" (bảng backtest/tối ưu) thì **không chụp bảng đó**. Ảnh số 6 dùng trạng thái chưa chạy (chỉ nút và mô tả) và màn hình "Soi lại", không dùng bảng kết quả.
- Không dùng nhãn "GIỮ"/"TẮT" của bảng tối ưu vì dễ đọc như phán quyết kết quả.
- Mỗi lần đổi phụ đề, so với bảng ở `LISTING.md` mục 4 (từ cấm).

**Dữ liệu và trạng thái app**
- Chụp trên **dữ liệu thật đang chạy** (không mock giá giả). Kiểm tra badge "LIVE", cặp, giờ cập nhật có thật. Ảnh không được cho thấy điều app không làm được.
- Chọn thời điểm thị trường **bình thường**: biến động 24h trong khoảng ±5%. Tránh lúc pump/dump mạnh làm ảnh trông như hứa hẹn kết quả lớn.
- Không dùng số vốn thật của chủ app. Dùng vốn minh hoạ **1000** và rủi ro **1%** (con số đầu vào do người dùng nhập, không phải kết quả). Chú thích ngay trên ảnh 5: "Ví dụ".
- Giao diện chế độ tối mặc định của app. Ngôn ngữ app: Tiếng Việt cho bộ ảnh vi-VN, và một bộ ảnh phụ đề tiếng Anh cho en-US dùng **cùng ảnh app** (app chỉ có tiếng Việt: ghi rõ ở mô tả; nếu muốn bộ en-US chính thống, cần giao diện tiếng Anh. Hiện app chưa có giao diện tiếng Anh, nên bộ en-US chỉ đổi phụ đề, đây là phương án chấp nhận được miễn mô tả nói rõ ngôn ngữ giao diện [Chưa xác nhận hướng dẫn của Play về điều này]).

**Thương hiệu và pháp lý**
- Không logo/chữ của thương hiệu hay công ty nào khác ngoài SOLPHA (hiện còn ở header, `index.html:37`; phải gỡ khỏi bản dùng để chụp: xem `REVIEW-RISKS.md` mục R0).
- Không logo/chữ **Binance** nổi bật. Dòng nhỏ "Binance Futures" trong thanh meta của app thì được, nhưng nên che nếu nó nằm trong khung chụp chính.
- Không logo Google Play, không huy hiệu, không nhãn "Editor's choice", "Top", "#1".
- Không ảnh người, không tiền thật, không xe sang, không biểu tượng tên lửa, không "to the moon".

**Thiết bị**
- Điện thoại Android thật hoặc máy ảo 1080×1920 (ví dụ Pixel 5 profile), Chrome/TWA bản cài từ Play (internal testing) để thấy app **không có thanh địa chỉ**.
- Thanh trạng thái sạch: pin đầy, sóng đầy, **không biểu tượng thông báo**, không tên nhà mạng, giờ cố định (ví dụ 09:41). Có thể bật chế độ demo của Android (System UI Demo Mode) để làm việc này.
- Không để lộ tên người dùng, email, tên máy, tên Wi-Fi.
- Cắt bỏ thanh điều hướng hệ thống (hoặc để thanh cử chỉ, nhưng không có nút nổi khác).

**Chất lượng**
- Chụp thật ở độ phân giải gốc rồi đặt vào khung 1080×1920; không phóng to ảnh nhỏ gây mờ.
- Chữ trong app đọc được ở kích thước hiển thị trên Play (chỉ ~340 px bề ngang): ưu tiên màn hình ít cột, phóng thông tin chính.
- Cùng một kiểu viền, bóng, màu nền dải phụ đề cho cả 8 ảnh.

---

## 2. Danh sách 8 ảnh

Số đếm ký tự đã kiểm tra bằng máy (≤ 40).

| # | Phụ đề tiếng Việt (≤ 40) | Ký tự | Màn hình trong app | Trạng thái dữ liệu cần chụp | Phải che/không để lộ |
|---|---|---|---|---|---|
| 1 | `Giá futures realtime, 5 khung thời gian` | 39 | Tab **Tín hiệu** (`data-view="signal"`), đầu trang: khối hero (giá, badge LIVE, thanh xu hướng 5 khung, Mark/Funding/H/L) | Cặp SOL, badge LIVE, thời gian cập nhật mới; trạng thái **"CHỜ"/không có kế hoạch đang hiệu lực**; thanh xu hướng 5 khung hiển thị đủ | Logo thương hiệu khác ở header; thay đổi 24h quá lớn; thẻ "ĐANG GIỮ"/"ĐÃ CHẠM TP1" |
| 2 | `SOL, BTC, ETH, DOGE và cặp tuỳ chọn` | 35 | Tab **Tín hiệu** + thanh cặp (`pairBar`) + panel **Thêm cặp** mở (`addPanel`, danh sách gợi ý BNB, XRP...) | 4 cặp mặc định trên thanh, panel thêm cặp mở, đang gõ một mã mẫu (ví dụ "BNB") | Cặp tuỳ chọn mà chủ app tự thêm kèm số liệu cá nhân |
| 3 | `Chỉ báo EMA, BB, RSI, ATR, MACD` | 31 | Tab **Phân tích**: bảng **Đa khung** (`tfBody`) | Dữ liệu thật đủ 5 hàng 5M/15M/1H/4H/1D; thẻ "Đồng pha", "Cảnh báo BB" ở trên; chữ nhỏ có "MACD*" giải thích | Bảng "Nhật ký 15 phút" nếu có dòng "tín hiệu bỏ lỡ" |
| 4 | `Kế hoạch tham khảo theo quy tắc kỹ thuật` | 40 | Tab **Phân tích**: thẻ **Lệnh tham khảo** (pill "Không phải lệnh sàn") hoặc khối hero khi có kế hoạch mới | Một kế hoạch ở trạng thái **MỚI** (chưa có kết quả): vùng vào 3 mức, mức dừng lỗ, hai mục tiêu, R:R. Nếu không có kế hoạch thật tại thời điểm chụp thì chụp lại sau, không chỉnh sửa/giả lập. | Bất kỳ nhãn kết quả (✓, ✗, "chạm TP"), số tiền rủi ro nếu quá cá nhân. Sau khi sửa từ ngữ ở `REVIEW-RISKS.md` R1, chụp bằng chữ mới |
| 5 | `Khối lượng theo vốn và % rủi ro của bạn` | 39 | Tab **Cài đặt**: ô **Vốn ($)** và **Rủi ro mỗi lệnh (%)** (`inpAcct`, `inpRisk`) + dòng khối lượng gợi ý ở kế hoạch (nếu cùng khung) | Vốn minh hoạ 1000, rủi ro 1%; dán nhãn "Ví dụ" trên ảnh. Con số khối lượng là kết quả tính theo quy tắc, không phải lãi | Vốn thật; PnL |
| 6 | `Backtest và soi lại ngay trên máy` | 33 | Tab **Công cụ**: nút "Backtest 5M", "Tối ưu 30 ngày" ở trạng thái **chưa chạy**; ô **Soi lại thời điểm** (`rpTime`, "Soi lại 3 giờ") và kết quả giải thích vì sao có/không có tín hiệu (không có bảng lệnh thắng/thua) | Chưa bấm Backtest/Tối ưu; nếu chụp kết quả "Soi lại" thì chỉ phần chỉ báo và lý do, không có số R | **Bảng kết quả backtest/tối ưu (cột Thắng, Tổng R)**: không chụp |
| 7 | `Nhật ký giao dịch, tự chấm kỷ luật` | 34 | Tab **Nhật ký**: form ngày, chế độ "Đứng ngoài (không vào lệnh)", checklist tiêu chí (`jCriteria`) | Chế độ **Đứng ngoài**, ô PnL **để trống**, checklist hiển thị tiêu chí và trọng số; ghi chú mẫu trung tính ("Chờ đủ điều kiện, không vào lệnh") | Pill "Điểm: ..." và hạng A/B/C/D (dùng trạng thái chưa lưu/"—"); bảng "Tổng kết tháng", cột PnL; ghi chú cá nhân thật |
| 8 | `Quy tắc công khai. Không phải tư vấn.` | 37 | Tab **Cài đặt**, cuộn tới thẻ **Rule cố định** (cuối trang), thấy dòng "Tự quản size/leverage. Futures có thể mất hết tài khoản." và footer "không phải tư vấn tài chính". Nếu đã thêm màn hình chào/cảnh báo ở màn đầu (`REVIEW-RISKS.md` R3) thì dùng chính màn hình đó thay thế. | Nội dung rule đọc được, không cắt dòng cảnh báo rủi ro | Mục tín hiệu bật/tắt gây hiểu nhầm là "chiến lược thắng" |

### Phụ đề tiếng Anh cho bộ ảnh en-US (≤ 40 ký tự)

| # | English caption | Chars |
|---|---|---|
| 1 | `Real-time futures prices, 5 timeframes` | 38 |
| 2 | `SOL, BTC, ETH, DOGE and custom pairs` | 36 |
| 3 | `EMA, BB, RSI, ATR and MACD indicators` | 37 |
| 4 | `Reference plans from technical rules` | 36 |
| 5 | `Size from your own capital and risk %` | 37 |
| 6 | `Backtest and replay on your device` | 34 |
| 7 | `Trading journal with discipline score` | 37 |
| 8 | `Published rules. Not investment advice.` | 39 |

Ảnh 7 ở bộ tiếng Anh: "discipline score" là điểm tuân thủ checklist của chính người dùng, nhưng vì ảnh không hiển thị điểm, có thể rút thành `Trading journal with a discipline checklist` nếu thấy dễ gây hiểu nhầm (đếm lại ≤ 40).

---

## 3. Thứ tự và vai trò

Thứ tự hiển thị đề xuất: 1 (giá realtime) → 3 (chỉ báo) → 4 (kế hoạch tham khảo) → 5 (khối lượng theo vốn) → 6 (công cụ kiểm chứng) → 7 (nhật ký) → 2 (cặp) → 8 (quy tắc). Hai ảnh đầu quyết định lượt cài: nên là ảnh có dữ liệu thật rõ nhất. Ảnh 8 (cảnh báo và quy tắc) giữ trong bộ để reviewer và người dùng thấy ngay app không hứa kết quả.

Không đưa **ảnh nào chỉ có chữ khẩu hiệu**. Không ghép nhiều màn hình thành một ảnh "demo kết quả".

## 4. Quy trình chụp

1. Gỡ logo thương hiệu khác khỏi bản triển khai; cài bản internal testing từ Play lên máy chụp.
2. Bật System UI Demo Mode (hoặc làm sạch thanh trạng thái bằng cách khác).
3. Vào Cài đặt, nhập vốn 1000, rủi ro 1%. Vào Tín hiệu, chờ badge LIVE.
4. Chụp thô từng màn theo bảng mục 2 (`adb exec-out screencap -p > shot-N.png` hoặc phím tắt thiết bị).
5. Dựng khung 1080×1920: dải phụ đề phía trên 160 px + ảnh app bên dưới. Xuất PNG. Lưu thư mục ngoài repo hoặc `play-assets/screens/` nếu muốn lưu cùng repo (không thuộc phạm vi tài liệu này).
6. Kiểm tra từng ảnh theo checklist dưới, người thứ hai duyệt.

## 5. Checklist trước khi tải ảnh lên

- [ ] 8 ảnh, mỗi ảnh đúng 1080×1920
- [ ] Phụ đề ≤ 40 ký tự, đúng bản ở bảng mục 2
- [ ] Không số lãi/lỗ, không R tổng, không tỷ lệ "thắng", không hạng điểm
- [ ] Không logo/chữ thương hiệu khác ngoài SOLPHA; không logo Binance nổi bật; không logo Google Play
- [ ] Thanh trạng thái sạch; không thông tin cá nhân
- [ ] Dữ liệu thật; badge LIVE; thời gian cập nhật hợp lý
- [ ] Mỗi ảnh khớp một tính năng có thật trong bản đang gửi duyệt (không ảnh Pro nếu chưa có Pro; nếu có thì gắn nhãn "Pro")
- [ ] Ảnh tuân thủ `LISTING.md` mục 4 (từ cấm)
- [ ] Không có người, trẻ em, hoạt hình
- [ ] Icon 512 và feature graphic 1024×500 lấy từ `play-assets/` (bộ SOLPHA, sạch thương hiệu khác) và khớp với phong cách ảnh

## 6. Gợi ý ảnh quảng bá (Feature graphic 1024×500)

Đã có `play-assets/feature-graphic-1024x500.png` sinh bởi `tools/play-assets.js`. Trước khi dùng, mở xem lại: chỉ có tên SOLPHA · Futures Desk và dòng mô tả trung tính, không hứa kết quả, không logo thương hiệu khác hay Binance. Nếu cần thêm dòng chữ, dùng: "Theo dõi và phân tích kỹ thuật futures" (không dùng "kiếm", "thắng", "lợi nhuận").

## 7. Nguồn

- Metadata policy (phạm vi gồm ảnh chụp màn hình và ảnh quảng bá; cấm metadata gây hiểu nhầm; tên ≤ 30 ký tự): https://support.google.com/googleplay/android-developer/answer/9898842
- Hướng dẫn trình bày store listing (tài sản đồ hoạ): https://support.google.com/googleplay/android-developer/answer/13393723
- Thông báo thay đổi metadata của Google Play (bài tổng hợp, thứ cấp): https://www.apptweak.com/en/aso-blog/how-to-prepare-for-new-google-metadata-policy-changes

**Chưa xác nhận:** số ảnh tối thiểu/tối đa và kích thước hợp lệ hiện hành của ảnh điện thoại; quy định của Play về ảnh chụp có giao diện khác ngôn ngữ listing; nguyên văn các điều khoản gốc (chỉ đọc qua kết quả tìm kiếm).
