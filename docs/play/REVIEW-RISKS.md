# SOLPHA · Futures Desk — Rủi ro bị từ chối hoặc gỡ khi duyệt, và cách giảm

Cập nhật 14/11/2026 (sau kiểm toán `docs/audit/COMPLIANCE-AUDIT.md` và `docs/audit/BRAND-AUDIT.md`) · Áp dụng cho v1.0.0 (TWA, `solpha.pages.dev`, **không có gói Pro**) và bản có Pro sau này.

Cách đọc: mỗi rủi ro có 3 phần: **Điều khoản Google liên quan** / **Dấu hiệu trong app, listing có thể bị bắt** (tên hàm hoặc tệp; số dòng không còn dùng vì đổi liên tục) / **Cách xử lý**. Mức độ: **Cao** = nhiều khả năng bị từ chối hoặc gỡ; **Vừa** = có thể bị hỏi; **Thấp** = nên làm cho chắc. Nhãn xác nhận chính sách như ở `POLICY-ANSWERS.md`: **[Xác nhận]** thấy trong kết quả tìm kiếm, **[Một phần]**, **[Chưa xác nhận]**.

Hạn chế: không mở được nguyên văn trang `support.google.com` từ môi trường soạn (WebFetch bị chặn), mọi dẫn chứng lấy từ kết quả WebSearch. Không có số liệu nội bộ của Google về tỷ lệ từ chối; "mức độ" là đánh giá của người soạn. Kiểm toán không truy cập được Binance (sandbox bị chặn, nên giá thật, WebSocket và phản hồi chặn thật đều **CHƯA XÁC NHẬN**); số liệu giá trong ảnh kiểm toán là dữ liệu giả lập, chỉ dùng để xem bố cục.

**Giả định về trạng thái mã khi dùng tài liệu này** (các thay đổi mã đang thực hiện song song, kiểm lại trên bản build gửi duyệt): đổi chuỗi giao diện sang cách diễn đạt trung tính; thông báo đẩy không chứa giá vào/SL/TP; Roboto tự host; thông báo thân thiện + nút thử lại + ngắt mạch khi Binance bị chặn; không nạp `billing.js` trong 1.0.0.

---

## Tóm tắt xếp hạng (xếp lại sau kiểm toán)

| # | Rủi ro | Mức | Loại hậu quả | Trạng thái |
|---|---|---|---|---|
| 2 | Reviewer ở khu vực Binance chặn dữ liệu: app trống/lỗi (**rủi ro số 1**, có bằng chứng đo) | Cao | Từ chối "chức năng hỏng" | Đã xử lý trong mã (thông báo + thử lại + ngắt mạch); còn việc tự làm: thử IP Mỹ/EU/VN, chọn quốc gia, quay video |
| 1 | App ra chỉ dẫn giao dịch cụ thể (SL, TP, khối lượng, "vào", "giữ") có thể bị coi là tư vấn tài chính / tư vấn cá nhân hoá | Cao | Từ chối bản, kháng nghị | Giảm mạnh nhờ đổi chuỗi; không loại bỏ hẳn nên phải khai Financial features trung thực |
| 4 | Hồ sơ khai không khớp (Financial features chưa quyết, `privacy.html` trống pháp nhân/email, `assetlinks.json`, quyền AAB chưa kiểm) | Cao nhưng dễ sửa | Từ chối kỹ thuật/hồ sơ | Tài liệu đã sửa; chủ app phải điền/quyết định |
| 3 | Số liệu hiệu quả ("Thắng", "đạt chuẩn", "GIỮ/TẮT", ✓/✗) trong app và ảnh | Vừa | Từ chối hoặc cảnh báo Metadata / Deceptive behavior | Đã đổi cách diễn đạt; cảnh báo ở màn hình đầu đã có (R3.1 xong) |
| 5 | Bán Pro: giá, dùng thử, huỷ; paywall; thanh toán ngoài Play | Cao khi có Pro | Từ chối / gỡ | **Không áp dụng cho 1.0.0** (không có Pro) |
| 0 | Dấu vết thương hiệu khác trong bản Play | Vừa (đã giảm) | Phải sửa trước khi chụp ảnh | P1-P4 đã sửa; còn P5 (chưa tách build Play) |
| 6 | Dùng tên "Binance", ngụ ý liên kết | Vừa | Cảnh báo giả mạo / metadata | |
| 7 | Chính sách quyền riêng tư và điều khoản còn chỗ trống, `assetlinks.json` chưa điền | Cao nhưng dễ sửa | Từ chối kỹ thuật/hồ sơ | Chủ app phải điền |
| 8 | TWA chỉ là "vỏ web" bị coi là chức năng tối thiểu | Vừa | Từ chối hiếm gặp | |
| 9 | Hạng nội dung, độ tuổi 18+ không khớp | Thấp | Yêu cầu làm lại bảng câu hỏi | |
| 10 | Tài khoản cá nhân mới: bắt buộc thử nghiệm kín trước khi phát hành | Quy trình | Chậm 14+ ngày | |
| 11 | Khung pháp lý ở quốc gia phát hành | Vừa | Rủi ro ngoài Play | |

(Số thứ tự # giữ nguyên để các tài liệu khác còn trỏ đúng; bảng xếp theo mức ưu tiên hiện tại.)

---

## R0. Thương hiệu: ĐÃ XỬ LÝ MỘT PHẦN (cập nhật sau BRAND-AUDIT)

Bản Play chạy giao diện SOLPHA độc lập (`brand.js`, `solpha-theme.css`, `manifest-solpha.webmanifest`, `icons/solpha/`). Gói thương mại đóng gói riêng, kiểm toán BRAND-AUDIT kết luận **ĐẠT** (0 rò rỉ).

Với bản Play, BRAND-AUDIT liệt kê P1-P4; các mục sau **đã sửa**:
- **P1** (service worker nạp sẵn tệp bản web thường vào Cache Storage): `sw.js` chỉ còn precache tệp trung tính + tệp SOLPHA. **Cần chạy lại phép đo**: mở `/?source=play`, chờ `serviceWorker.ready`, xác nhận Cache Storage không chứa `icon.svg`, `manifest.webmanifest`, `icons/icon-*.png`, `maskable-*`, `apple-touch-icon`, `favicon-32` của bản web thường.
- **P2** (mở lại từ thông báo/shortcut làm mất `source=play`): `sw.js` mở `./?source=play` khi bản Play, shortcut `twa-manifest.json` đã kèm `source=play`.
- **P3** (URL pháp lý không có `?source=play`): `brand.js` ép giao diện SOLPHA cho `privacy.html`/`terms.html`, nên URL dán vào Play Console **không cần** kèm tham số.
- **P4** (hướng dẫn `GOOGLE-PLAY-GUIDE.md` bảo nhập `#189848`): đã sửa.

**Còn lại (chưa xử lý):**
- **P5**: **chưa tách build Play riêng**. Mã nguồn tĩnh phục vụ cho bản Play vẫn chứa chuỗi/tệp của bản web thường (logo qua `data-src`, màu trong `styles.css`, nhánh trong `brand.js`, tệp `icons/*.png` gốc truy cập được cùng origin). Không hiển thị trong app, nhưng người cố tình xem nguồn sẽ thấy. Cách dứt điểm: dựng bản Play riêng (như `tools/build-commercial.js`) hoặc dùng origin riêng.
- **P7**: chưa thử trên Android thật: nhánh `document.referrer = android-app://...` của `brand.js` và hành vi `fallbackType: customtabs` khi `assetlinks.json` chưa điền.
- Shortcut "Quét ngay" (`/?scan=1&source=play`): tham số `scan` không được `app.js` đọc (vô nghĩa nhưng không ảnh hưởng duyệt); có thể bỏ shortcut.
- Chạy lại `grep -ri etek` trên **thư mục build thực sự dùng cho Play** và quan sát Cache Storage trên máy thật trước khi gửi.

## R1. Chỉ dẫn giao dịch cụ thể bị coi là tư vấn tài chính

- **Điều khoản Google liên quan:**
  - Financial Services policy: định nghĩa sản phẩm/dịch vụ tài chính gồm quản lý hay đầu tư tiền và tiền mã hoá, **kể cả tư vấn cá nhân hoá** [Một phần]. Chính sách cấm giao dịch quyền chọn nhị phân và đào tiền mã hoá trên thiết bị [Xác nhận].
  - Khai báo Financial features: khai báo phải khớp hành vi app; có báo cáo trên diễn đàn Play về bị từ chối vì khai báo "không chính xác" [Một phần].
  - Deceptive Behavior / Metadata: không mô tả sai chức năng [Một phần].
- **Dấu hiệu trong app có thể bị bắt (theo COMPLIANCE-AUDIT mục 3, trước khi đổi chuỗi):**
  - Tính toán theo vốn và % rủi ro của chính người dùng: các hàm `planText` và `renderAction` trong `app.js` ("Khối lượng ... ≈ $ ... rủi ro $", "Vào ngay ..."). Đây là cá nhân hoá theo số do người dùng nhập.
  - Nhãn mệnh lệnh: "▲ LONG · mua khi 1D/4H/1H cùng tăng", "▼ SHORT · bán khi khung lớn giảm" (`index.html`, bảng Backtest/Tối ưu); các thẻ "ĐANG GIỮ", "ĐÃ CHẠM TP1 ... giữ phần còn lại", "không vào mới, đã vào thì giữ theo kế hoạch" trong `renderAction`.
  - Thông báo đẩy chứa giá vào/SL/TP và thông báo "tín hiệu bỏ lỡ"; thẻ "Ưu tiên"/"XEM LONG"/"KHÔNG CHASE"; nhật ký coi "chỉ vào khi app đủ điều kiện" là tiêu chí kỷ luật (`journal.js`).
  - **Trạng thái sau đợt sửa song song:** các chuỗi trên được đổi sang cách mô tả điều kiện ("Điều kiện thuận xu hướng tăng", "Nếu dùng giá hiện tại làm điểm vào...", "Kế hoạch còn hiệu lực"), thông báo đẩy không còn mức giá. **Phải kiểm lại trên bản build gửi duyệt** (chạy qua mọi tab và các trạng thái chờ/có kế hoạch/đã chạm mục tiêu); phần còn lại không loại bỏ hẳn được rủi ro này.
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
  4. **Khai báo Financial features đúng bản chất** (xem `POLICY-ANSWERS.md` mục 2, hai phương án A/B; khuyến nghị thận trọng: khai thừa an toàn hơn khai thiếu); dán đoạn ghi chú tiếng Anh cho reviewer.
  5. Không có kênh/chat/nhóm "VIP" nhận tư vấn riêng trong app hay trong listing: biến app thành dịch vụ tư vấn cá nhân.
  6. **"Chữ SL/TP/khối lượng có bị coi là khuyến nghị đầu tư không?"** Bản thân thuật ngữ SL/TP/khối lượng là từ chuyên môn trung lập và rất phổ biến trong app biểu đồ; điều làm nó thành "khuyến nghị" là (a) lời lệnh ("hãy vào", "giữ", "nên"), (b) cá nhân hoá không rõ nguồn, (c) kèm cam kết kết quả. Giữ thuật ngữ nhưng bỏ (a) và (c), làm rõ (b) bằng câu "quy tắc công khai, đầu vào do bạn nhập". Chưa tìm được hướng dẫn của Google nói riêng về từ "SL/TP" [Chưa xác nhận].

---

## R2. Reviewer ở khu vực Binance chặn: app trống, bị coi là lỗi (rủi ro số 1)

- **Điều khoản Google liên quan:** app phải hoạt động đúng mô tả với reviewer (nhóm điều khoản "chức năng hỏng"; "App access" yêu cầu reviewer vào được toàn bộ chức năng) [Xác nhận phần App access; phần "chức năng hỏng": Chưa xác nhận bằng tìm kiếm nhưng là lý do từ chối thường gặp được nhiều nguồn thứ ba nhắc].
- **Bằng chứng kiểm toán (14/11/2026):** khi mọi host Binance không truy cập được, bản trước đây hiện "Mất kết nối dữ liệu · mạng chậm..." cùng dòng lỗi thô "Failed to fetch | Failed to fetch | Failed to fetch", thanh cặp toàn "…", mọi tab trống, và app gửi khoảng 252 request/25 giây (240 lỗi) do vòng thử lại 15/30/45/60 giây. Thông báo riêng cho khu vực bị chặn chỉ hiện khi lỗi chứa mã `451`/`403`, mà phản hồi chặn địa lý thường không kèm CORS nên trình duyệt chỉ báo `Failed to fetch`: thông báo đó nhiều khả năng không hiện. **Phản hồi chặn thật của Binance: CHƯA XÁC NHẬN** (sandbox kiểm toán không truy cập được Binance; Binance hạn chế một số quốc gia, kể cả Mỹ, theo tài liệu app, nhưng danh sách chính xác và việc IP nào bị chặn chưa xác nhận).
- **Đã xử lý trong mã (đợt sửa song song; kiểm lại trên bản build):** phân biệt "không kết nối được mọi host Binance" với "mất mạng thông thường"; hiện thông báo thân thiện nói đúng nguyên nhân khả dĩ (Binance không truy cập được từ mạng/khu vực này), ẩn lỗi thô, có nút **thử lại**; ngắt mạch (giãn nhịp và dừng thử lại tự động sau một số lần, nhất là khi app ở nền) để không "dội" request.
- **Việc cần TỰ làm (không thể xử lý bằng tài liệu):**
  1. Thử bằng thiết bị/VPN hợp pháp ở **Mỹ, EU, Việt Nam** (và nơi định phân phối): ghi lại app hiển thị gì ở từng nơi, chụp màn hình. Kiểm chứng rằng khi bị chặn, thông báo thật sự hiện, nút thử lại hoạt động và request không dội. **CHƯA XÁC NHẬN** cho tới khi làm.
  2. **Chọn quốc gia phân phối** có chủ đích; không phát hành ở nơi dữ liệu Binance không truy cập được hoặc nơi việc dùng dịch vụ này không phù hợp.
  3. **Quay video màn hình** toàn bộ luồng ở khu vực có dữ liệu (mở lần đầu, giá realtime, 5 tab, Cài đặt, một lượt Backtest, thông báo thử, và nếu được cả màn hình khi bị chặn), đăng liên kết không liệt kê và dán vào ghi chú App access (mẫu ở `POLICY-ANSWERS.md` mục 6), kèm email phản hồi nhanh.
  4. Kiểm tra WebSocket (`fstream.binance.com`) mở được ở vùng Binance cho phép (kiểm toán chưa xác nhận được).
  5. Nếu cân nhắc dữ liệu mẫu để app không trống: chỉ hợp lệ khi gắn nhãn "Dữ liệu mẫu" rõ cho mọi người dùng và không trộn dữ liệu thật; **tuyệt đối không** hiện dữ liệu giả riêng cho reviewer (cloaking, vi phạm chính sách). [Chưa xác nhận] việc endpoint công khai khác của Binance có truy cập được ở khu vực bị chặn.

---

## R3. Số liệu hiệu quả, nhãn kết quả (cảnh báo màn hình đầu: ĐÃ XỬ LÝ)

- **R3.1 Cảnh báo rủi ro ở màn hình đầu: ĐÃ XỬ LÝ.** Lần mở đầu hiện hộp "Trước khi dùng" (cảnh báo rủi ro + xác nhận 18+) bắt buộc bấm "Tôi đã hiểu và đồng ý"; cờ lưu trong `localStorage` (`solpha_risk_ack`). Đã đo ngày 14/11/2026 và có ảnh bằng chứng. Nhận định cũ "cảnh báo chỉ ở footer, không có ở màn hình đầu" là **lỗi thời**; footer và `terms.html` vẫn giữ. Việc còn lại: chụp một ảnh hộp này cho hồ sơ (và dùng làm ảnh 8 nếu phù hợp).
- **R3.2 Số liệu hiệu quả / nhãn kết quả: đã đổi cách diễn đạt, cần kiểm lại.**
- **Điều khoản Google liên quan:** Metadata policy cấm metadata gây hiểu nhầm trong mô tả, tên, icon, ảnh chụp và ảnh quảng bá; ảnh chụp phải phản ánh trải nghiệm thật; cấm lời chứng thực ẩn danh trong mô tả [Xác nhận]. Cấm chữ/hình trong tên, icon, tên nhà phát triển ám chỉ xếp hạng, giá, khuyến mãi [Xác nhận]. Nhóm "Deceptive Behavior" nói chung cấm tuyên bố sai về chức năng/kết quả [Chưa xác nhận bằng tìm kiếm].
- **Dấu hiệu trước khi sửa:** cột "Thắng" và phần trăm ở bảng Backtest và Tối ưu; ngưỡng "đạt chuẩn ... thắng ≥ x%"; nhãn "GIỮ"/"TẮT"; dòng "Kế hoạch gần nhất ... chạm TP2 ✓✓ / chạm SL ✗"; nhãn "BỎ LỠ"; điểm hạng A/B/C/D của nhật ký; ảnh đo được dòng `3 lệnh | 100%` (mẫu quá nhỏ trình bày như một thống kê); backtest nói "chưa tính phí" trong khi thực tế đã trừ 0,08%/lệnh; tiêu đề "Công cụ kiểm chứng" hàm ý đã xác thực.
- **Trạng thái sau đợt sửa:** "Thắng" → "Lệnh có lãi (mô phỏng)"; "đạt chuẩn"/GIỮ/TẮT → "đủ ngưỡng thống kê tối thiểu của app" / "Đủ ngưỡng"/"Chưa đủ ngưỡng"; ✓/✗ → mô tả trung tính ("giá đã chạm mục tiêu 1/2", "giá đã chạm mức dừng lỗ"); "BỎ LỠ" → "CHƯA XEM"; "Ưu tiên" → "Trạng thái điều kiện"; có dòng cảnh báo ngay trên bảng mô phỏng ("kết quả quá khứ không bảo đảm kết quả tương lai"); backtest ghi đúng "đã trừ phí và trượt giá ước tính 0,08%/lệnh". **Kiểm lại trên bản build** (chạy Backtest và Tối ưu, xem từng chuỗi).
- **Cách xử lý còn lại:**
  1. **Ảnh chụp màn hình và listing không bao giờ chứa số lãi/lỗ, tỷ lệ "lệnh có lãi", điểm hạng, bảng kết quả Backtest/Tối ưu** (xem `SCREENSHOT-PLAN.md`; mẫu quá nhỏ như `3 lệnh | 100%` càng không được chụp).
  2. Nhãn điểm kỷ luật của nhật ký chỉ nằm trong app, không vào ảnh; ghi rõ "tự đánh giá của bạn".
  3. Listing đã soạn không dùng từ cấm (`LISTING.md` mục 4); rà lại mỗi lần sửa mô tả.

---

## R4. Khai báo không khớp hành vi (Financial features, Data safety, Target audience)

- **Điều khoản liên quan:** mọi nhà phát triển có app trên Play phải điền Financial features declaration, kể cả không có tính năng tài chính [Xác nhận]. Data safety do Google xem xét trong lúc duyệt; nhà phát triển chịu trách nhiệm về độ chính xác [Xác nhận]. Khai sai Target audience có thể dẫn tới gỡ hoặc đình chỉ [Xác nhận].
- **Dấu hiệu (theo kiểm toán):** bản `privacy.html` cũ thiếu `fapi1.binance.com`, thiếu việc hosting và Binance thấy IP, thiếu Cache Storage/sessionStorage, còn câu "không thu thập... bất kỳ dữ liệu nào" không chú thích IP, và mục thanh toán cũ sai thực tế Worker (Worker lưu `deviceId` UUID, băm và mã hoá purchase token, SKU, trạng thái, hạn). Data safety (1.0.0) khai "không thu thập" mà IP vẫn đi tới bên thứ ba (**CHƯA XÁC NHẬN** cách Google tính). Financial features chưa quyết (công cụ phân tích hay tư vấn).
- **Đã sửa:** `privacy.html` (body) và `POLICY-ANSWERS.md` đã cập nhật theo các điểm trên; mục thanh toán của chính sách ghi rõ "chỉ áp dụng khi gói Pro được bật".
- **Cách xử lý:**
  1. Dùng đúng bảng ở `POLICY-ANSWERS.md` mục 1 và 2.
  2. Thống nhất ba nơi: Data safety, `privacy.html`, hành vi app. Chính sách quyền riêng tư phải nêu mọi truy cập và chia sẻ dữ liệu, không giới hạn ở những gì hiện trong nhãn [Xác nhận].
  3. Roboto tự host (thư mục `fonts/`) loại bỏ câu hỏi về Google Fonts; phải xác nhận bản build thực không còn gọi `fonts.googleapis.com`/`fonts.gstatic.com`.
  4. Trước mỗi bản phát hành có thay đổi về thu thập dữ liệu (Pro, analytics, đăng nhập), cập nhật nhãn và chính sách **trước** khi gửi duyệt.
  5. Không thêm SDK Firebase/Crashlytics/Analytics/quảng cáo mà không cập nhật toàn bộ hồ sơ.

---

## R5. Bán SOLPHA Pro: giá, dùng thử, huỷ, paywall, thanh toán ngoài Play (KHÔNG áp dụng cho 1.0.0)

**Trạng thái:** bản 1.0.0 trên Play không có Pro: `billing.js` chưa được nạp trong `index.html`, giao diện không có màn hình mua gói, nhãn "Pro" hay nút khôi phục giao dịch, Worker chưa triển khai (`API_BASE` còn placeholder), `playBilling.enabled=false`. Vì vậy **không dùng Bản B của `LISTING.md`, không dán ghi chú Pro cho reviewer, không khai Purchase history/Device IDs cho 1.0.0**. Mục này chỉ để chuẩn bị cho phiên bản sau.

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
  7. Khi bật Pro: khai thêm Purchase history **và Device or other IDs** (Worker lưu `deviceId` UUID), điền `[SỐ NGÀY]` giữ dữ liệu ở `privacy.html` mục 4, làm quy trình xoá dữ liệu (Worker hiện chưa có lệnh xoá), cập nhật chính sách trước/cùng lúc phát hành.

---

## R6. Dùng tên "Binance", ngụ ý liên kết

- **Điều khoản liên quan:** Impersonation / Metadata: tên, icon, tên nhà phát triển, mô tả không được mạo danh hoặc ngụ ý liên kết với thương hiệu khác; metadata không được gây hiểu nhầm [Một phần: nhóm Metadata xác nhận; điều khoản Impersonation nguyên văn: Chưa xác nhận].
- **Dấu hiệu:** mô tả nêu nguồn dữ liệu Binance; `index.html` footer "dữ liệu Binance public API"; nếu ảnh chụp có logo sàn hoặc chữ "Binance" nổi bật.
- **Cách xử lý:** chỉ nhắc Binance như **nguồn dữ liệu** (đã làm trong `LISTING.md`), kèm câu "không liên kết với Binance". Tên app, icon, ảnh quảng bá, tên nhà phát triển không có chữ/logo Binance. Không dùng màu và kiểu chữ giống Binance. Không dùng link giới thiệu (affiliate/referral) Binance trong app: sẽ thành quảng cáo/khuyến khích mở tài khoản sàn và kéo theo khai báo quảng cáo, Financial features.

---

## R7. Hồ sơ còn chỗ trống

- **Điều khoản liên quan:** mọi app phải có link chính sách quyền riêng tư trong Play Console và trong app [Xác nhận]. Tên miền kiểm chứng TWA qua Digital Asset Links.
- **Dấu hiệu:**
  - `privacy.html`, `terms.html` còn `[TÊN PHÁP NHÂN / CÁ NHÂN PHÁT HÀNH]`, `[EMAIL]`, `[WEBSITE]` (chủ app tự điền; tài liệu không tự điền hộ).
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

## Checklist trước khi bấm "Gửi duyệt" (bản cập nhật 14/11/2026, bản 1.0.0 không Pro)

Đánh dấu từng mục; mục nào chưa xong thì chưa gửi. Mục có "[ĐÃ CÓ]" là điều kiểm toán xác nhận đã đúng; vẫn nên kiểm lại trên bản build cuối.

**Thương hiệu và nội dung app**
- [ ] Thư mục build thực dùng cho Play: `grep -ri etek` không còn tệp/chuỗi hiện ra trong app; Cache Storage trên máy Play không chứa tệp bản web thường (R0, P1) [P1-P3 đã sửa trong mã; P5 chưa tách build Play]
- [ ] Màn hình đầu có cảnh báo rủi ro + 18+ bắt buộc bấm đồng ý [ĐÃ CÓ: hộp "Trước khi dùng"]
- [ ] Không còn chuỗi mệnh lệnh ("mua khi", "bán khi", "Vào ngay", "giữ", "không vào mới") và có chữ "tham khảo" ở mọi khối kế hoạch; thông báo đẩy không chứa giá vào/SL/TP
- [ ] Không còn cột "Thắng", "đạt chuẩn", GIỮ/TẮT, ✓/✗, "BỎ LỠ", "Ưu tiên"; bảng Backtest/Tối ưu có dòng cảnh báo "kết quả quá khứ không bảo đảm"; backtest ghi đúng việc đã trừ phí
- [ ] Binance bị chặn: thông báo thân thiện + nút thử lại + không dội request, **đã thử bằng IP Mỹ/EU/VN** (R2)
- [ ] Không có link affiliate/giới thiệu Binance, không logo Binance
- [ ] Roboto tự host; DevTools > Network không có request tới Google Fonts; không có SDK bên thứ ba nào

**Hồ sơ và khai báo**
- [ ] `privacy.html`, `terms.html` đã điền pháp nhân, email, website (hiện CHƯA điền); mở được công khai không cần đăng nhập; URL dán vào Play Console không cần `?source=play` (trang tự dùng giao diện SOLPHA)
- [ ] Chủ app đã kiểm cấu hình Cloudflare Pages: không bật Web Analytics/Logpush ngoài ý muốn (câu trong `privacy.html` mục 2 phụ thuộc điều này)
- [ ] Data safety khớp bản đang gửi: bản 1.0.0 "Không thu thập" (đã cân nhắc phương án dự phòng ở `POLICY-ANSWERS.md` 1A); **không** khai Purchase history/Device IDs vì không có Pro
- [ ] Financial features declaration đã chọn phương án A hay B (`POLICY-ANSWERS.md` mục 2) sau khi đọc danh sách tuỳ chọn hiện hành; dán ghi chú cho reviewer
- [ ] Content rating (IARC) trả lời đúng; Target audience 18+; Ads: Không; News/Government: Không; Health: không có tính năng sức khoẻ
- [ ] App access đã điền (1.0.0: tất cả chức năng khả dụng + ghi chú tiếng Anh + liên kết video); ghi chú mô tả đúng những gì reviewer thấy (hộp cảnh báo lần đầu, giá realtime, cách xử lý khi Binance bị chặn), **không** nhắc nhãn "Pro", nút "Restore purchase" hay "badge LIVE ở màn đầu"
- [ ] Quyền trong AAB kiểm bằng `bundletool dump manifest`: INTERNET, POST_NOTIFICATIONS và những gì đã giải thích; kiểm `AD_ID`, `WAKE_LOCK` (CHƯA XÁC NHẬN cho tới khi có AAB)
- [ ] `assetlinks.json` đã điền SHA-256 khoá Play App Signing (hiện còn `THAY_BANG_SHA256_...`); bản cài từ Play không hiện thanh địa chỉ
- [ ] Đã quay và đăng video luồng đầy đủ (liên kết không liệt kê) cho `[VIDEO_URL]`

**Listing**
- [ ] Tên ≤ 30 ký tự, không từ khoá nhồi nhét, không biểu tượng
- [ ] Mô tả không có từ cấm (`LISTING.md` mục 4), có mục "Cảnh báo rủi ro", nói rõ giao diện tiếng Việt (bản en), nói app cần truy cập được Binance; backtest 5 ngày / tối ưu 30 ngày; Settings chỉ có công tắc bật/tắt (không nói "chỉnh ngưỡng"); không lời chứng thực ẩn danh
- [ ] Dùng **Bản A** (không Pro); không dán Bản B
- [ ] Ảnh chụp 8 ảnh theo `SCREENSHOT-PLAN.md` (đã sửa theo kiểm toán), chụp **sau khi** đổi chuỗi giao diện; không số lãi/lỗ, không nhãn thắng %, không thương hiệu khác, không logo Binance
- [ ] Icon 512×512 và feature graphic 1024×500 từ `play-assets/` (SOLPHA)
- [ ] Email liên hệ trả lời được; website mở được

**Bản Pro (sau 1.0.0, khi có)**
- [ ] Giao diện mua gói đã nối, `billing.js` đã nạp, Worker đã triển khai (`API_BASE` thật), Play Billing bật (`twa-manifest.json`), sản phẩm đăng ký tạo xong, giá hiển thị lấy từ Play
- [ ] Hiển thị: giá, chu kỳ, dùng thử 7 ngày rồi tính phí, tự gia hạn, cách huỷ, nút bỏ qua; có nút khôi phục giao dịch nếu ghi chú reviewer nhắc tới
- [ ] Worker xác minh purchase token; **có quy trình xoá dữ liệu thật** (Worker chưa có lệnh xoá) và `[SỐ NGÀY]` đã điền; chính sách cập nhật; Data safety khai Purchase history **và Device or other IDs**
- [ ] Đã thử đủ vòng đời đăng ký bằng license tester; ghi chú reviewer mô tả đúng giao diện thật

**Quy trình**
- [ ] Loại tài khoản đã rõ; nếu cá nhân: đã đủ 12 tester × 14 ngày và đã nộp xin quyền phát hành chính thức
- [ ] Hồ sơ này và ảnh chụp đã được người thứ hai đọc lại một lượt; chạy `node --test worker/test` nếu tài liệu bán nhắc "39 test" (kiểm toán chưa chạy lại)
- [ ] Đã lưu ảnh chụp màn hình các khai báo App content (để kháng nghị nếu cần)

## Nếu bị từ chối

1. Đọc đúng mã vi phạm và email; không sửa đại trà.
2. Sửa đúng điểm bị nêu, ghi trong ô kháng nghị bằng tiếng Anh, ngắn: app là công cụ phân tích chỉ đọc, không sàn/ví, kế hoạch tham khảo theo quy tắc, và đã sửa điểm X.
3. Không nộp lại nguyên bản cũ nhiều lần liên tiếp (dễ bị hạn chế tài khoản) [Chưa xác nhận]. Cân nhắc kháng nghị trước khi gửi bản mới nếu bạn tin quyết định sai.

## Nguồn đã tra (13/11/2026; kiểm toán 14/11/2026 tra bổ sung)

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

**Chưa xác nhận được:** nguyên văn hiện hành của các trang trên; danh sách tuỳ chọn hiện hành của Financial features declaration; WebSocket và phản hồi chặn thật của Binance; quyền thực trong AAB; điều khoản Impersonation, Deceptive Behavior, Minimum Functionality; việc IP Mỹ/khu vực nào bị Binance chặn; mức độ từ chối thực tế của các app phân tích crypto có kế hoạch SL/TP; khung pháp lý Việt Nam.
