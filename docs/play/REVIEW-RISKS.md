# SOLPHA · Futures Desk — Rủi ro bị từ chối hoặc gỡ khi duyệt, và cách giảm

Cập nhật 13/11/2026 · Áp dụng cho v1.0.0 (TWA, `solpha.pages.dev`) và bản có Pro sau này.

Cách đọc: mỗi rủi ro có 3 phần: **Điều khoản Google liên quan** / **Dấu hiệu trong app, listing có thể bị bắt** (có dòng code hoặc file) / **Cách xử lý**. Mức độ: **Cao** = nhiều khả năng bị từ chối hoặc gỡ; **Vừa** = có thể bị hỏi; **Thấp** = nên làm cho chắc. Nhãn xác nhận chính sách như ở `POLICY-ANSWERS.md`: **[Xác nhận]** thấy trong kết quả tìm kiếm ngày 13/11/2026, **[Một phần]**, **[Chưa xác nhận]**.

Hạn chế: không mở được nguyên văn trang `support.google.com` từ môi trường này (WebFetch bị chặn), mọi dẫn chứng lấy từ kết quả WebSearch. Không có số liệu nội bộ của Google về tỷ lệ từ chối; "mức độ" là đánh giá của người soạn.

Việc sửa nội dung trong app (đổi chữ, thêm màn hình cảnh báo, gỡ logo) **nằm ngoài thư mục `docs/play/`, chưa thực hiện**. Mục "Cách xử lý" ghi rõ cái gì cần sửa ở đâu.

---

## Tóm tắt xếp hạng

| # | Rủi ro | Mức | Loại hậu quả |
|---|---|---|---|
| 0 | Logo/nhắc thương hiệu công ty khác còn trong app (vi phạm yêu cầu SOLPHA độc lập) | Chặn nội bộ | Phải sửa trước khi chụp ảnh |
| 1 | App ra chỉ dẫn giao dịch cụ thể (SL, TP, khối lượng, "vào", "giữ") có thể bị coi là tư vấn tài chính / tư vấn cá nhân hoá | Cao | Từ chối bản, kháng nghị |
| 2 | Reviewer ở khu vực Binance chặn dữ liệu: app trống, bị coi là lỗi hoặc thiếu chức năng | Cao | Từ chối "chức năng hỏng" |
| 3 | Số liệu hiệu quả ("Thắng", "đạt chuẩn"), nhãn kết quả ✓ và thiếu cảnh báo ở màn hình đầu bị coi là gây hiểu nhầm | Cao | Từ chối hoặc cảnh báo vi phạm Metadata / Deceptive behavior |
| 4 | Khai báo Financial features / Data safety không khớp hành vi thật | Cao | Từ chối ngay khi duyệt hoặc gỡ sau |
| 5 | Bán Pro: hiển thị giá, dùng thử, huỷ; paywall khiến reviewer không vào được; thanh toán ngoài Play | Cao khi có Pro | Từ chối / gỡ |
| 6 | Dùng tên "Binance", ngụ ý liên kết | Vừa | Cảnh báo giả mạo / metadata |
| 7 | Chính sách quyền riêng tư và điều khoản còn chỗ trống, `assetlinks.json` chưa điền | Cao nhưng dễ sửa | Từ chối kỹ thuật/hồ sơ |
| 8 | TWA chỉ là "vỏ web" bị coi là chức năng tối thiểu | Vừa | Từ chối hiếm gặp |
| 9 | Hạng nội dung, độ tuổi 18+ không khớp | Thấp | Yêu cầu làm lại bảng câu hỏi |
| 10 | Tài khoản cá nhân mới: bắt buộc thử nghiệm kín trước khi phát hành | Quy trình | Chậm 14+ ngày |
| 11 | Khung pháp lý ở quốc gia phát hành | Vừa | Rủi ro ngoài Play |

---

## R0. Thương hiệu — ĐÃ XỬ LÝ
Bản Play chạy giao diện SOLPHA độc lập (brand.js, solpha-theme.css, manifest-solpha, icons/solpha). Bản thương mại đóng gói riêng, có bước kiểm tra rò rỉ tự động. Chỉ cần xác nhận lại bằng ảnh chụp trước khi gửi duyệt.

## R1. Chỉ dẫn giao dịch cụ thể bị coi là tư vấn tài chính

- **Điều khoản Google liên quan:**
  - Financial Services policy: định nghĩa sản phẩm/dịch vụ tài chính gồm quản lý hay đầu tư tiền và tiền mã hoá, **kể cả tư vấn cá nhân hoá** [Một phần]. Chính sách cấm giao dịch quyền chọn nhị phân và đào tiền mã hoá trên thiết bị [Xác nhận].
  - Khai báo Financial features: khai báo phải khớp hành vi app; có báo cáo trên diễn đàn Play về bị từ chối vì khai báo "không chính xác" [Một phần].
  - Deceptive Behavior / Metadata: không mô tả sai chức năng [Một phần].
- **Dấu hiệu trong app có thể bị bắt:**
  - Tính toán theo vốn và % rủi ro của chính người dùng: `app.js:266-277` ("Khối lượng ... mỗi phần ..."), `app.js:580-603` ("Khối lượng ... ≈ $", "Vào ngay ..."). Đây là cá nhân hoá theo tài chính của người dùng.
  - Nhãn mệnh lệnh: `index.html` "▲ LONG · mua khi 1D/4H/1H cùng tăng", "▼ SHORT · bán khi khung lớn giảm"; `app.js:593-600` các thẻ "ĐANG GIỮ", "ĐÃ CHẠM TP1 ... dời SL về giá vào, giữ phần còn lại tới TP2", "không vào mới, đã vào thì giữ theo kế hoạch"; badge "▲ LONG/▼ SHORT" ở hero (`app.js:598`).
  - Thông báo đẩy "tín hiệu bỏ lỡ" (`app.js:821`), "nến tín hiệu" (`app.js:525`).
  - Tiêu đề trường "Ưu tiên" và `biasText` "WAIT" ở thẻ phân tích.
- **Cách xử lý:**
  1. **Đổi từ ngữ theo hướng mô tả điều kiện, không ra lệnh.** Gợi ý cách diễn đạt:

     | Hiện tại | Đề xuất |
     |---|---|
     | "mua khi 1D/4H/1H cùng tăng" | "Điều kiện thuận xu hướng tăng: 1D/4H/1H cùng tăng" |
     | "bán khi khung lớn giảm" | "Điều kiện thuận xu hướng giảm: khung lớn giảm" |
     | "Vào 3 phần" | "Vùng vào tham khảo (chia 3 mức)" |
     | "Stop loss" / "SL" | "Mức dừng lỗ tham khảo (SL)" |
     | "TP1 / TP2" | "Mục tiêu tham khảo 1 / 2" |
     | "Khối lượng" | "Khối lượng gợi ý theo vốn và % rủi ro bạn nhập" |
     | "Vào ngay ..." | "Nếu giá hiện tại làm điểm vào, R:R là ..." |
     | "ĐANG GIỮ ... giữ phần còn lại" | "Kế hoạch còn hiệu lực ... (theo quy tắc)" |
     | "tín hiệu" | "tín hiệu kỹ thuật" / "điều kiện kỹ thuật" |
     | "Lệnh tham khảo" | Giữ nguyên, nhưng đổi thành "Kế hoạch tham khảo theo quy tắc kỹ thuật" |
  2. **Luôn kèm dòng trạng thái** ngay trong khối kế hoạch: "Tính theo quy tắc kỹ thuật đã công bố. Không phải khuyến nghị đầu tư, không phải lệnh sàn." (`index.html` đã có pill "Không phải lệnh sàn": giữ và làm nổi hơn).
  3. **Người dùng tự nhập vốn và % rủi ro** là điểm có lợi: ghi rõ "Giá trị do bạn nhập; app không biết hoàn cảnh tài chính của bạn."
  4. **Khai báo Financial features đúng bản chất** (xem `POLICY-ANSWERS.md` mục 2); dán đoạn ghi chú tiếng Anh cho reviewer.
  5. Không có kênh/chat/nhóm "VIP" nhận tư vấn riêng trong app hay trong listing: biến app thành dịch vụ tư vấn cá nhân.
  6. **"Chữ SL/TP/khối lượng có bị coi là khuyến nghị đầu tư không?"** Bản thân thuật ngữ SL/TP/khối lượng là từ chuyên môn trung lập và rất phổ biến trong app biểu đồ; điều làm nó thành "khuyến nghị" là (a) lời lệnh ("hãy vào", "giữ", "nên"), (b) cá nhân hoá không rõ nguồn, (c) kèm cam kết kết quả. Giữ thuật ngữ nhưng bỏ (a) và (c), làm rõ (b) bằng câu "quy tắc công khai, đầu vào do bạn nhập". Chưa tìm được hướng dẫn của Google nói riêng về từ "SL/TP" [Chưa xác nhận].

---

## R2. Reviewer ở khu vực Binance chặn: app trống, bị coi là lỗi

- **Điều khoản Google liên quan:** app phải hoạt động đúng mô tả với reviewer (nhóm điều khoản "chức năng hỏng", "App access" yêu cầu reviewer phải vào được toàn bộ chức năng) [Xác nhận phần App access; phần "chức năng hỏng": Chưa xác nhận bằng tìm kiếm nhưng là lý do từ chối thường gặp được nhiều nguồn thứ ba nhắc].
- **Dấu hiệu:** toàn bộ dữ liệu đến từ `fapi.binance.com`, `fstream.binance.com`, `api.binance.com` (`app.js:8`, `app.js:707`). Binance hạn chế truy cập từ một số quốc gia (kể cả IP Mỹ, nơi nhiều reviewer thường ở). Khi bị chặn, app hiện lỗi mạng chung (`app.js:495`, `st.tickerError`) và màn hình chỉ có "—". [Chưa xác nhận bằng nguồn trong phiên này việc IP nào bị chặn; cần tự kiểm tra bằng VPN.]
- **Cách xử lý:**
  1. Tự kiểm tra bằng thiết bị/VPN ở Mỹ, EU, Singapore, Việt Nam: ghi lại app hiển thị gì ở từng nơi.
  2. Làm trạng thái lỗi rõ ràng: "Không tải được dữ liệu thị trường từ nguồn ở khu vực này", kèm nút thử lại và giải thích, thay vì ô trống. Cân nhắc nguồn dữ liệu công khai dự phòng thuần đọc, hoặc dữ liệu minh hoạ gắn nhãn "Dữ liệu mẫu" (không bao giờ trộn với dữ liệu thật). [Chưa xác nhận] việc một endpoint công khai khác của Binance có truy cập được ở khu vực bị chặn.
  3. Ghi vào **App access** link video quay toàn bộ luồng ở khu vực có dữ liệu (xem mẫu ghi chú trong `POLICY-ANSWERS.md` mục 6), và email phản hồi nhanh.
  4. Chọn có chủ đích danh sách quốc gia phân phối; không phát hành ở nơi dữ liệu Binance không truy cập được hoặc việc dùng dịch vụ này không phù hợp.
  5. Đừng dùng "dữ liệu giả cho reviewer" ẩn (cloaking): vi phạm chính sách; dữ liệu mẫu chỉ hợp lệ khi gắn nhãn rõ cho mọi người dùng.

---

## R3. Số liệu hiệu quả, nhãn kết quả, và cảnh báo rủi ro không nằm ở màn hình đầu

- **Điều khoản Google liên quan:** Metadata policy cấm metadata gây hiểu nhầm trong mô tả, tên, icon, ảnh chụp và ảnh quảng bá; cấm lời chứng thực ẩn danh trong mô tả [Xác nhận]. Chính sách cũng cấm chữ/hình trong tên, icon, tên nhà phát triển ám chỉ xếp hạng, giá, khuyến mãi [Xác nhận]. Nhóm "Deceptive Behavior" nói chung cấm tuyên bố sai về chức năng/kết quả [Chưa xác nhận bằng tìm kiếm].
- **Dấu hiệu:**
  - Bảng kết quả hiển thị cột "Thắng" và phần trăm (`app.js:985-986`, `app.js:1086-1088`), ngưỡng "đạt chuẩn ... thắng ≥ x%", nhãn "GIỮ"/"TẮT".
  - Nhãn kết quả lệnh "chạm TP2 ✓✓", "chạm TP1, chốt hết ✓" (`app.js:610`).
  - Điểm hạng A/B/C/D của nhật ký (`index.html`, mục "Trọng số ... Hạng A ≥ 85"): dễ bị chụp ảnh và cắt ghép thành "điểm cao = kết quả tốt".
  - Cảnh báo rủi ro hiện chỉ nằm ở footer (`index.html:257`) và trang `terms.html`: **không có ở màn hình đầu tiên**.
- **Cách xử lý:**
  1. **Màn hình chào lần đầu (hoặc banner cố định ở tab đầu):** "SOLPHA là công cụ phân tích kỹ thuật, không phải tư vấn đầu tư. Giao dịch futures có đòn bẩy có thể làm mất toàn bộ vốn. Kết quả quá khứ không bảo đảm kết quả tương lai." + nút "Tôi hiểu" + link Điều khoản. Lưu cờ đã xác nhận vào `localStorage` (cùng cách như `solpha_seen`).
  2. Bảng backtest/tối ưu: đổi "Thắng" thành "Lệnh có lãi (trên dữ liệu quá khứ)"; thêm dòng đầu bảng: "Số liệu mô phỏng trên dữ liệu quá khứ, chưa phản ánh đầy đủ trượt giá, thanh khoản, lỗi kết nối. Không bảo đảm kết quả tương lai."
  3. Giữ nhãn ✓ ở mức trung tính ("đã chạm mục tiêu 1"), không đánh giá thắng/thua bằng màu sắc ăn mừng.
  4. **Ảnh chụp màn hình và listing không bao giờ chứa số lãi/lỗ, tỷ lệ thắng, điểm hạng** (xem `SCREENSHOT-PLAN.md`).
  5. Listing đã được soạn không dùng các từ cấm (`LISTING.md` mục 4). Rà lại mỗi lần sửa mô tả.

---

## R4. Khai báo không khớp hành vi (Financial features, Data safety, Target audience)

- **Điều khoản liên quan:** mọi nhà phát triển có app trên Play phải điền Financial features declaration, kể cả không có tính năng tài chính [Xác nhận]. Data safety do Google xem xét trong lúc duyệt; nhà phát triển chịu trách nhiệm về độ chính xác [Xác nhận]. Khai sai Target audience có thể dẫn tới gỡ hoặc đình chỉ [Xác nhận].
- **Dấu hiệu:** `privacy.html` mục 2 liệt kê gọi tới Binance và Google Fonts, trong khi Data safety (bản 1.0.0) có thể khai "không thu thập"; khi bật Pro thì có backend nhưng nhãn chưa cập nhật; app khai "Không có tính năng tài chính" trong khi tạo kế hoạch tham khảo.
- **Cách xử lý:**
  1. Dùng đúng bảng ở `POLICY-ANSWERS.md` mục 1 và 2.
  2. Thống nhất ba nơi: Data safety, `privacy.html`, hành vi app. Chính sách quyền riêng tư phải nêu mọi truy cập và chia sẻ dữ liệu, không giới hạn ở những gì hiện trong nhãn [Xác nhận].
  3. Cân nhắc tự host phông chữ để loại bỏ câu hỏi về Google Fonts.
  4. Trước mỗi bản phát hành có thay đổi về thu thập dữ liệu (Pro, analytics, đăng nhập), cập nhật nhãn và chính sách **trước** khi gửi duyệt.
  5. Không thêm SDK Firebase/Crashlytics/Analytics/quảng cáo mà không cập nhật toàn bộ hồ sơ.

---

## R5. Bán SOLPHA Pro: giá, dùng thử, huỷ, paywall, thanh toán ngoài Play

- **Điều khoản liên quan:** Subscriptions: ứng dụng phải nêu rõ thời hạn dùng thử, giá sau dùng thử, khi nào chuyển sang trả phí, cách huỷ; nêu rõ cách quản lý/huỷ đăng ký, có cách huỷ trực tuyến dễ dùng; nếu đăng ký không bắt buộc, người dùng phải dễ dàng bỏ qua lời mời đăng ký [Xác nhận (kết quả tìm kiếm từ trang chính sách và bài blog Android Developers 2020)]. Hàng hoá số bán trong app phải dùng Google Play Billing [Một phần: chưa thấy nguyên văn trang Payments]. Quy định thanh toán 2026 đang đổi (lựa chọn thanh toán khác ở Mỹ/Anh/EEA từ 30/06/2026; điều kiện và phí nguồn tin mâu thuẫn) [Chưa xác nhận].
- **Dấu hiệu:**
  - `twa-manifest.json`: `playBilling.enabled=false`, `alphaDependencies.enabled=false`. Nếu listing ghi Pro mà app chưa có thanh toán là mô tả sai tính năng.
  - Màn hình mua chỉ hiện giá cố định "đ/tháng" không theo giá Play, thiếu dòng "tự gia hạn", hoặc nút huỷ nằm ẩn.
  - Dùng thử 7 ngày nhưng không ghi sau 7 ngày bị tính phí bao nhiêu.
  - Dẫn người dùng ra ngoài (website, Telegram, chuyển khoản) để mua tính năng trong app.
  - Gói Pro quảng cáo kiểu "mở khoá tín hiệu mạnh hơn", "tăng tỷ lệ thắng".
- **Cách xử lý:**
  1. Chỉ đưa Pro vào listing khi bản trên Play thật sự bật billing (Bản B trong `LISTING.md`).
  2. Màn hình mua lấy **giá và chu kỳ từ Play** (Digital Goods API trong TWA), hiển thị: giá, chu kỳ, "dùng thử 7 ngày, sau đó [GIÁ]/tháng", "tự gia hạn", đường dẫn "Quản lý đăng ký" tới trang đăng ký của Google Play, nút "Để sau" rõ ràng.
  3. Tả Pro là tính năng phần mềm (ví dụ số cặp, lượt tối ưu, xuất báo cáo), **không** là "tín hiệu tốt hơn" hay kết quả.
  4. Không có link mua ngoài Play trong app hay trong listing.
  5. Chuẩn bị đường vào Pro cho reviewer (license tester, promo code, video): xem `POLICY-ANSWERS.md` mục 6.
  6. Worker kiểm chứng purchase token qua Google Play Developer API trước khi mở khoá; không tin trạng thái từ client.

---

## R6. Dùng tên "Binance", ngụ ý liên kết

- **Điều khoản liên quan:** Impersonation / Metadata: tên, icon, tên nhà phát triển, mô tả không được mạo danh hoặc ngụ ý liên kết với thương hiệu khác; metadata không được gây hiểu nhầm [Một phần: nhóm Metadata xác nhận; điều khoản Impersonation nguyên văn: Chưa xác nhận].
- **Dấu hiệu:** mô tả nêu nguồn dữ liệu Binance; `index.html` footer "dữ liệu Binance public API"; nếu ảnh chụp có logo sàn hoặc chữ "Binance" nổi bật.
- **Cách xử lý:** chỉ nhắc Binance như **nguồn dữ liệu** (đã làm trong `LISTING.md`), kèm câu "không liên kết với Binance". Tên app, icon, ảnh quảng bá, tên nhà phát triển không có chữ/logo Binance. Không dùng màu và kiểu chữ giống Binance. Không dùng link giới thiệu (affiliate/referral) Binance trong app: sẽ thành quảng cáo/khuyến khích mở tài khoản sàn và kéo theo khai báo quảng cáo, Financial features.

---

## R7. Hồ sơ còn chỗ trống

- **Điều khoản liên quan:** mọi app phải có link chính sách quyền riêng tư trong Play Console và trong app [Xác nhận]. Tên miền kiểm chứng TWA qua Digital Asset Links.
- **Dấu hiệu:**
  - `privacy.html`, `terms.html` còn `[TÊN PHÁP NHÂN / CÁ NHÂN PHÁT HÀNH]`, `[EMAIL]`, `[WEBSITE]`.
  - `.well-known/assetlinks.json`: `THAY_BANG_SHA256_CUA_KHOA_KY_TU_PLAY_CONSOLE`. Thiếu khớp thì app mở với thanh địa chỉ Chrome, và tính năng gắn với TWA (Play Billing, uỷ quyền thông báo) không chạy [Một phần: tài liệu Chrome nêu Digital Asset Links là điều kiện của TWA].
  - Email liên hệ `[EMAIL]` trong listing.
- **Cách xử lý:** điền đủ, thử mở `https://solpha.pages.dev/.well-known/assetlinks.json` thấy đúng chuỗi, cài thử bản **từ Play (internal testing)** để chắc chắn thanh địa chỉ biến mất. Thêm cả vân tay khoá Play App Signing.

---

## R8. TWA chỉ là vỏ bọc web (chức năng tối thiểu)

- **Điều khoản liên quan:** nhóm "Minimum Functionality" / "Spam" chống app chỉ là trang web đóng gói thiếu giá trị [Chưa xác nhận bằng tìm kiếm trong phiên này].
- **Dấu hiệu:** `twa-manifest.json` mở thẳng `https://solpha.pages.dev/`; chức năng chủ yếu là web.
- **Cách xử lý:** SOLPHA có chức năng riêng rõ ràng (chỉ báo, backtest cục bộ, nhật ký, thông báo, chạy offline qua `sw.js`). Nhấn mạnh trong mô tả và ảnh chụp các tính năng chỉ có khi dùng app (nhật ký, backtest, thông báo), không giống một trang web thông tin. Đảm bảo app mở đúng ngay lần đầu khi mất mạng ở mức hợp lý (`sw.js` cache `index.html` và tài nguyên).

---

## R9. Hạng nội dung, độ tuổi 18+

- **Điều khoản liên quan:** Target audience và Content rating (xem `POLICY-ANSWERS.md` mục 3 và 4); trả lời phải đúng thực tế, cập nhật khi nội dung đổi [Xác nhận].
- **Dấu hiệu:** hạng nội dung rất thấp nhưng độ tuổi mục tiêu 18+; giao dịch đòn bẩy; icon/ảnh có hoạt hình hấp dẫn trẻ em.
- **Cách xử lý:** hai khai báo độc lập, giữ nhất quán: audience 18+; giao diện nghiêm túc; câu "Dành cho người từ 18 tuổi trở lên" trong mô tả và điều khoản.

---

## R10. Tài khoản cá nhân mới

- **Quy định:** tài khoản cá nhân tạo sau 13/11/2023 phải chạy kiểm thử kín với tối thiểu 12 tester đã tham gia liên tục ít nhất 14 ngày trước khi xin quyền phát hành chính thức; tài khoản tổ chức (có D-U-N-S) được miễn [Xác nhận từ trang trợ giúp Play]. Sau 14 ngày vẫn phải nộp bảng xin quyền truy cập bản chính thức. Có nguồn thứ ba nói Google đã siết kiểm tra mức độ tham gia của tester trong 2026: [Chưa xác nhận].
- **Cách xử lý:** chốt loại tài khoản trước (xem `docs/GOOGLE-PLAY-GUIDE.md` mục 0); lập danh sách 12+ tester thật, hướng dẫn họ cài từ link opt-in và mở app trong 14 ngày (không dùng dịch vụ "mua tester").

---

## R11. Khung pháp lý nơi phát hành

- **Điều khoản liên quan:** chính sách Play về sàn/ví có yêu cầu giấy phép theo khu vực pháp lý (SOLPHA không thuộc phạm vi vì không phải sàn/ví, nhưng phải khai đúng) [Một phần]; ngoài ra là luật địa phương về tài sản mã hoá, tư vấn đầu tư, quảng cáo.
- **Cách xử lý:** chọn danh sách quốc gia phân phối có chủ đích; hỏi luật sư địa phương về việc công cụ phân tích tài sản mã hoá thu phí thuê bao có cần giấy phép tư vấn đầu tư hay không. Khung pháp lý Việt Nam và các nước khác [Chưa xác nhận: không tra trong đợt này].

---

## Checklist trước khi bấm "Gửi duyệt"

Đánh dấu từng mục; mục nào chưa xong thì chưa gửi.

**Thương hiệu và nội dung app**
- [ ] Không còn logo/chữ thương hiệu khác trong app đã triển khai, icon, ảnh, listing (`grep -ri etek` rỗng ở thư mục build; kiểm cả `sw.js` cache)
- [ ] Màn hình đầu có cảnh báo rủi ro rõ, không chỉ ở footer
- [ ] Từ ngữ mệnh lệnh ("mua khi", "bán khi", "vào ngay", "giữ") đã đổi sang mô tả điều kiện; có chữ "tham khảo" ở mọi khối kế hoạch
- [ ] Cột "Thắng", ngưỡng "đạt chuẩn" đã đổi nhãn kèm lời nhắc dữ liệu quá khứ
- [ ] Trạng thái lỗi dữ liệu rõ ràng khi Binance bị chặn
- [ ] Không có link affiliate/giới thiệu Binance, không logo Binance
- [ ] Phông chữ cân nhắc tự host; không có SDK bên thứ ba nào

**Hồ sơ và khai báo**
- [ ] `privacy.html`, `terms.html` đã điền pháp nhân, email, website; mở được công khai không cần đăng nhập
- [ ] Data safety khớp bản đang gửi (bản 1.0.0: không thu thập; bản Pro: Purchase history ± Device IDs)
- [ ] Financial features declaration đã đọc kỹ danh sách tuỳ chọn hiện hành và khớp hành vi app; dán ghi chú cho reviewer
- [ ] Content rating (IARC) trả lời đúng; Target audience 18+; Ads: Không; News/Government: Không; Health: không có tính năng sức khoẻ
- [ ] App access đã điền (bản có Pro: kèm hướng dẫn tiếng Anh, license tester, video)
- [ ] Quyền trong AAB kiểm bằng `bundletool dump manifest` chỉ gồm INTERNET, POST_NOTIFICATIONS (và những gì đã giải thích)
- [ ] `assetlinks.json` đã điền SHA-256 khoá Play App Signing; bản cài từ Play không hiện thanh địa chỉ

**Listing**
- [ ] Tên ≤ 30 ký tự, không từ khoá nhồi nhét, không biểu tượng
- [ ] Mô tả không có từ cấm (`LISTING.md` mục 4), có mục "Cảnh báo rủi ro"; không lời chứng thực ẩn danh
- [ ] Bản A hoặc B đúng với bản phát hành (có/không Pro)
- [ ] Ảnh chụp 8 ảnh theo `SCREENSHOT-PLAN.md`, không số lãi/lỗ, không nhãn thắng %, không thương hiệu khác, không Binance logo
- [ ] Icon 512×512 và feature graphic 1024×500 từ `play-assets/` (SOLPHA, sạch thương hiệu khác)
- [ ] Email liên hệ trả lời được; website mở được

**Bản Pro (khi có)**
- [ ] Play Billing bật (`twa-manifest.json`), sản phẩm đăng ký tạo xong trong Play Console, giá hiển thị lấy từ Play
- [ ] Hiển thị: giá, chu kỳ, dùng thử 7 ngày rồi tính phí, tự gia hạn, cách huỷ, nút bỏ qua
- [ ] Worker xác minh purchase token; có cách xoá dữ liệu theo yêu cầu; chính sách cập nhật
- [ ] Đã thử đủ vòng đời đăng ký bằng license tester

**Quy trình**
- [ ] Loại tài khoản đã rõ; nếu cá nhân: đã đủ 12 tester × 14 ngày và đã nộp xin quyền phát hành chính thức
- [ ] Hồ sơ này và ảnh chụp đã được người thứ hai đọc lại một lượt
- [ ] Đã lưu ảnh chụp màn hình các khai báo App content (để kháng nghị nếu cần)

## Nếu bị từ chối

1. Đọc đúng mã vi phạm và email; không sửa đại trà.
2. Sửa đúng điểm bị nêu, ghi trong ô kháng nghị bằng tiếng Anh, ngắn: app là công cụ phân tích chỉ đọc, không sàn/ví, kế hoạch tham khảo theo quy tắc, và đã sửa điểm X.
3. Không nộp lại nguyên bản cũ nhiều lần liên tiếp (dễ bị hạn chế tài khoản) [Chưa xác nhận]. Cân nhắc kháng nghị trước khi gửi bản mới nếu bạn tin quyết định sai.

## Nguồn đã tra (13/11/2026)

- Financial Services policy: https://support.google.com/googleplay/android-developer/answer/9876821
- Cryptocurrency Exchanges and Software Wallets: https://support.google.com/googleplay/android-developer/answer/16329703
- Financial features declaration: https://support.google.com/googleplay/android-developer/answer/13607354 và https://support.google.com/googleplay/android-developer/answer/13849271
- Diễn đàn Play, trường hợp bị từ chối vì khai báo tài chính không chính xác: https://support.google.com/googleplay/android-developer/thread/322937464/financial-features-declaration-you-have-provided-for-your-app-is-inaccurate
- Metadata policy: https://support.google.com/googleplay/android-developer/answer/9898842
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- User Data / privacy policy: https://support.google.com/googleplay/android-developer/answer/13327111
- Content rating: https://support.google.com/googleplay/android-developer/answer/9859655
- Target audience: https://support.google.com/googleplay/android-developer/answer/9285070
- App content và App access: https://support.google.com/googleplay/android-developer/answer/9859455
- Subscriptions (blog): https://android-developers.googleblog.com/2020/04/building-user-trust-through-more.html
- Yêu cầu thử nghiệm kín (tài khoản cá nhân): https://support.google.com/googleplay/android-developer/answer/14151465
- Play Billing trong TWA: https://developer.chrome.com/docs/android/trusted-web-activity/play-billing
- Thay đổi thanh toán Play 2026: https://www.androidheadlines.com/2026/06/google-play-store-external-billing-fee-changes.html

**Chưa xác nhận được:** nguyên văn hiện hành của các trang trên; điều khoản Impersonation, Deceptive Behavior, Minimum Functionality; việc IP Mỹ/khu vực nào bị Binance chặn; mức độ từ chối thực tế của các app phân tích crypto có kế hoạch SL/TP; khung pháp lý Việt Nam.
