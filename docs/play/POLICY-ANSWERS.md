# SOLPHA · Futures Desk — Câu trả lời cho các mục form Play Console

Cập nhật 14/11/2026 (sửa theo `docs/audit/COMPLIANCE-AUDIT.md` và `docs/audit/BRAND-AUDIT.md`) · Áp dụng cho `app.solpha.desk` v1.0.0 (TWA, `solpha.pages.dev`).

Trạng thái giả định khi dùng tài liệu này (đã chốt với các thay đổi mã song song): phông Roboto tự lưu cùng app (thư mục `fonts/`, không gọi Google Fonts); thông báo đẩy trung tính (không chứa giá vào/SL/TP); nhãn kết quả trong app dùng cách diễn đạt trung tính; khi Binance bị chặn app hiện thông báo thân thiện có nút thử lại và tự ngắt vòng thử lại; **bản 1.0.0 trên Play KHÔNG có gói Pro**. Nếu một trong các điều trên chưa đúng ở bản build gửi duyệt thì phải kiểm lại các mục tương ứng. Số dòng mã đã được thay bằng tên hàm/hằng vì số dòng đổi liên tục.

Cách đọc: mỗi bảng có 3 cột "Câu hỏi → Trả lời → Lý do / dòng code liên quan". Cột cuối ghi **mức xác nhận chính sách**:

- **[Xác nhận]** thấy trong kết quả tìm kiếm trích từ trang chính sách của Google ngày 13/11/2026.
- **[Một phần]** có dấu hiệu trong kết quả tìm kiếm nhưng chưa thấy nguyên văn hiện hành.
- **[Chưa xác nhận]** là hiểu biết chung hoặc suy luận, phải đối chiếu trên Play Console lúc điền.

Hạn chế khi soạn: WebFetch không mở được `support.google.com` trong môi trường này, nên không đọc được nguyên văn trang gốc; toàn bộ dẫn chứng đến từ WebSearch (mode standard). Các tên ô, nhãn tuỳ chọn trong form có thể đã đổi; khi form khác với bảng dưới thì chọn phương án trung thực nhất theo nguyên tắc ghi ở từng mục.

## 0. Hai trạng thái của app, hai bộ câu trả lời

| | Bản 1.0.0 gửi duyệt (không có Pro) | Bản có SOLPHA Pro (CHƯA tồn tại trong repo) |
|---|---|---|
| Thanh toán | Không. `twa-manifest.json`: `features.playBilling.enabled = false`; `billing.js` không được nạp trong `index.html` | Google Play Billing (đăng ký tháng/năm, dùng thử 7 ngày): cần thêm màn hình mua gói, nạp `billing.js`, đặt `API_BASE` thật |
| Máy chủ của nhà phát triển | Không | Cloudflare Worker (`worker/`, chưa triển khai) lưu: `deviceId` (UUID ngẫu nhiên do app sinh), mã băm SHA-256 và bản mã hoá AES-GCM của purchase token, SKU, trạng thái, ngày hết hạn |
| Data safety | "Không thu thập" (kèm phương án dự phòng ở 1A) | Khai **Purchase history** và **Device or other IDs** (xem 1B) |
| Listing | Bản A trong `LISTING.md` (không nhắc Pro) | Bản B trong `LISTING.md`, chỉ khi UI Pro có thật |
| App access | Không cần tài khoản | Không tài khoản, nhưng có tính năng sau paywall: phải kèm hướng dẫn mô tả ĐÚNG giao diện mua gói thực tế |

**Với bản 1.0.0 chỉ dùng cột giữa.** Mọi nội dung "Bản có Pro" dưới đây là kế hoạch cho phiên bản sau, không dán vào form cho 1.0.0.

Nguyên tắc: **form phải khớp đúng bản đang phát hành**. Khi bật Pro, cập nhật Data safety, chính sách quyền riêng tư và listing **trước hoặc cùng lúc** với bản phát hành đó; đừng khai trước cho thứ chưa có (khai sai theo cả hai chiều đều là vi phạm). Chính sách Play nói người phát triển chịu trách nhiệm về độ chính xác và cập nhật nhãn Data safety [Xác nhận].

---

## 1. Data safety

Nền tảng: Google yêu cầu **mọi app** (kể cả app không thu thập gì) điền form và đặt link chính sách quyền riêng tư; Google xem xét câu trả lời trong quá trình duyệt app [Xác nhận]. Dữ liệu chỉ xử lý cục bộ trên thiết bị, không gửi ra ngoài, thì không cần khai là "thu thập" [Xác nhận]. Dữ liệu xử lý tạm thời trong bộ nhớ chỉ để phục vụ yêu cầu thời gian thực có thể không hiển thị công khai nhưng vẫn phải có trong câu trả lời form [Xác nhận].

### 1A. Bản 1.0.0 (không Pro, không backend của nhà phát triển)

| Câu hỏi | Trả lời | Lý do / nơi trong mã |
|---|---|---|
| App có thu thập hoặc chia sẻ loại dữ liệu người dùng bắt buộc khai nào không? | **Không thu thập** (phương án mặc định). **CHƯA XÁC NHẬN** việc IP gửi tới Binance và nhà cung cấp hosting có bị Google coi là "chia sẻ" hay không: xem phương án dự phòng ngay dưới bảng. | Không có máy chủ riêng, không tài khoản, không SDK bên thứ ba, không quảng cáo, không POST, không cookie, không IndexedDB (đã đo ngày 14/11/2026). Cài đặt, vốn, % rủi ro, nhật ký chỉ ở `localStorage` (hàm `store` đầu `app.js`, các khoá `solpha_*`; `journal.js` khoá `solpha_journal`). [Một phần] |
| Yêu cầu gửi tới Binance (`fapi`, `fapi1`, `api`, `fstream`) có tính là thu thập/chia sẻ không? | **Không khai**, nhưng chính sách quyền riêng tư phải nói rõ (đã làm ở `privacy.html` mục 2). Request chỉ chứa mã cặp và khung thời gian của dữ liệu thị trường công khai. | Hằng `ENDPOINTS` (có `fapi.binance.com`, `fapi1.binance.com`, `api.binance.com`), `fetchJSON`, `WS_HOSTS` (`fstream.binance.com`) trong `app.js`. Binance thấy IP, trình duyệt, Referer như mọi website. Binance là nguồn dữ liệu công khai, không xử lý "thay mặt" nhà phát triển. **CHƯA XÁC NHẬN** cách Google coi IP gửi tới bên thứ ba (kết quả tìm kiếm cho thấy dữ liệu chuyển cho bên thứ ba thường tính là "chia sẻ", ngoại lệ cho nhà cung cấp xử lý theo chỉ dẫn của nhà phát triển; nguyên văn hiện hành chưa đọc được). |
| Nhà cung cấp hosting (Cloudflare Pages) thấy IP khi tải app | **Không khai riêng**; ghi trong `privacy.html` mục 2. | Mọi tệp tải từ `solpha.pages.dev`. Chủ app phải **tự kiểm** Cloudflare Pages: không bật Web Analytics, không bật Logpush/xuất nhật ký ra nơi khác trước khi giữ câu "không dùng nhật ký để nhận diện cá nhân" (chưa kiểm trong phiên này). |
| Phông chữ có phải khai không? | **Không áp dụng nếu Roboto đã tự host**: app không còn gọi Google Fonts, `privacy.html` mục 2 ghi "phông lưu cùng app". | Thư mục `fonts/` (woff2) do service worker lưu trong Cache Storage. **Phải kiểm bản build thực: mở DevTools > Network, không còn request tới `fonts.googleapis.com` / `fonts.gstatic.com`.** Nếu còn thì quay lại câu trả lời cũ: khai thêm Google Fonts ở phương án dự phòng. |
| Dữ liệu có được mã hoá khi truyền không? | **Có** (nếu form hỏi) | Mọi địa chỉ đều `https://` hoặc `wss://`. Nếu không khai thu thập gì thì câu hỏi này thường không hiện. |
| Người dùng có thể yêu cầu xoá dữ liệu không? | **Không áp dụng** vì nhà phát triển không giữ dữ liệu nào. Chính sách đã ghi cách tự xoá: Cài đặt > Ứng dụng > SOLPHA > Bộ nhớ > Xoá dữ liệu. | `privacy.html` mục 6 (neo `#xoa-du-lieu`) |
| App có cho tạo tài khoản không (mục xoá tài khoản)? | **Không** | Không có đăng ký/đăng nhập trong `index.html` / `app.js` |
| Link chính sách quyền riêng tư | `https://solpha.pages.dev/privacy.html` | Phải điền `[TÊN PHÁP NHÂN]`, `[EMAIL]`, `[WEBSITE]` trong file (CHƯA điền); có link trong app (footer `index.html`). Trang pháp lý tự dùng giao diện SOLPHA, không cần kèm `?source=play` (xem `brand.js`). |

**Phương án dự phòng nếu Play yêu cầu sửa hoặc nếu muốn khai thận trọng ngay từ đầu:** chọn "Có thu thập", loại **Device or other IDs** (chỉ vì địa chỉ IP gửi tới bên thứ ba), mục đích **App functionality**, đánh dấu **có chia sẻ với bên thứ ba** (Binance; nhà cung cấp hosting; thêm Google Fonts nếu build chưa tự host phông), dữ liệu **không** tuỳ chọn tắt được. Nhược điểm: nhãn này làm app trông "thu thập" hơn thực tế. Quyết định giữa hai phương án là của chủ app (**CHƯA XÁC NHẬN** phương án nào Google chấp nhận; khai thừa an toàn hơn bị từ chối vì khai thiếu).

**Việc kỹ thuật làm câu trả lời "Không" vững hơn:** (1) đã/đang tự host Roboto (loại Google khỏi danh sách bên nhận IP); (2) cân nhắc bỏ `fapi1.binance.com` khỏi `ENDPOINTS` nếu không cần host dự phòng (nếu bỏ thì sửa lại `privacy.html` mục 2 và bảng này); (3) giữ nguyên "không SDK bên thứ ba": nếu thêm Firebase/Analytics/Crashlytics thì bảng này sai ngay.

### 1B. Bản có SOLPHA Pro + Cloudflare Worker (CHƯA tồn tại: chỉ dùng sau khi UI mua gói được nối và Worker được triển khai)

Dữ liệu dưới đây lấy từ `worker/src/index.js` và `worker/README.md`. Trước khi khai, rà lại mã Worker và cấu hình Cloudflare (logs, Logpush, KV) để chắc chắn đúng.

| Câu hỏi | Trả lời | Lý do / nơi trong mã |
|---|---|---|
| App có thu thập dữ liệu người dùng không? | **Có** | Worker nhận và lưu dữ liệu để mở tính năng Pro. |
| Loại dữ liệu: Financial info > **Purchase history** | **Khai: thu thập**. Mục đích: **App functionality** (mở khoá Pro) và **Fraud prevention, security, and compliance** (xác minh giao dịch với Google Play Developer API). Chọn "Người dùng có thể chọn có/không thu thập" (chỉ phát sinh khi họ chủ động đăng ký). | Dữ liệu: băm SHA-256 và bản mã hoá AES-GCM của purchase token, SKU, trạng thái (active, trial, cancelled, expired), ngày hết hạn. Không lưu số thẻ. (BILLING-AUDIT: không lưu IP, email, tên; nhưng `deviceId` đi trong query của `GET /api/entitlement` nên có thể nằm trong nhật ký Cloudflare.) [Một phần] về việc Purchase history thuộc nhóm Financial info; đối chiếu nhãn trên form. |
| Loại dữ liệu: **Device or other IDs** | **CÓ khai.** Mã ngẫu nhiên (UUID) do app sinh (`solpha_device` trong `billing.js`) và gửi lên Worker (`/api/verify`) để gắn quyền lợi. Mục đích: **App functionality**; **Fraud prevention, security, and compliance**. Không chia sẻ cho bên thứ ba. | Đây là sửa so với bản cũ của tài liệu (từng ghi "không tạo ID riêng"; thực tế `billing.js` có sinh và Worker có lưu `deviceId`). |
| IP trong nhật ký Cloudflare | Worker dùng IP để giới hạn tốc độ trong bộ nhớ, không lưu. `worker/wrangler.toml` không bật `[observability]`; **CHƯA XÁC NHẬN** mặc định Workers Logs/Logpush của tài khoản Cloudflare: kiểm trên dashboard, tắt nếu không cần. Nếu bật thì ghi vào chính sách và cân nhắc khai IP. | [Chưa xác nhận] cách Google coi IP trong log máy chủ |
| Có chia sẻ dữ liệu với bên thứ ba không? | **Không** (Cloudflare là nhà cung cấp dịch vụ xử lý thay cho nhà phát triển; Google Play là bên cung cấp thanh toán). | Chuyển dữ liệu cho nhà cung cấp dịch vụ xử lý thay mặt nhà phát triển thường không tính là "chia sẻ" [Chưa xác nhận nguyên văn hiện hành; đối chiếu định nghĩa "share" trên form]. |
| Mã hoá khi truyền? | **Có** | Worker chỉ nhận qua HTTPS (Cloudflare mặc định). |
| Cách xoá dữ liệu | **Có**: email `[EMAIL]` hoặc `https://solpha.pages.dev/privacy.html#xoa-du-lieu` (neo này đã có). **Lưu ý (theo `docs/audit/BILLING-AUDIT.md` F10, kiểm lại nếu Worker đã được vá): Worker KHÔNG có API/lệnh xoá**, không đặt hạn (TTL) cho khoá KV. Trước khi khai "có thể yêu cầu xoá", phải có quy trình thật (ví dụ xoá thủ công khoá `ENT` theo `deviceId` hoặc băm token) và điền `[SỐ NGÀY]` giữ dữ liệu trong `privacy.html` mục 4. | Khai "có" mà không làm được là khai sai. Dữ liệu giao dịch có thể phải giữ theo luật thuế/kế toán: ghi rõ thời hạn. |
| Dữ liệu cá nhân khác (email, tên, vị trí, danh bạ) | **Không** | Tiếp tục đúng như `privacy.html` mục 3. |

`privacy.html` mục 4 đã viết sẵn theo danh sách trường ở trên, ghi rõ "chỉ áp dụng khi gói Pro được bật". Khi bật Pro: điền `[SỐ NGÀY]`, đối chiếu lại từng dòng với mã Worker thật, và phát hành bản cập nhật chính sách **trước hoặc cùng lúc** với bản app.

---

## 2. Financial features declaration (Khai báo tính năng tài chính)

Nền tảng chính sách: mọi nhà phát triển có app trên Play (kể cả bản thử nghiệm) phải điền khai báo này, kể cả khi app không có tính năng tài chính nào thì phải xác nhận là không có [Xác nhận]. Chính sách về **sàn tiền mã hoá và ví phần mềm** yêu cầu khai báo ở App content > Financial features declaration; ví không giữ khoá của người dùng (non-custodial) nằm ngoài phạm vi chính sách đó; yêu cầu giấy phép chỉ áp dụng cho sàn/ví tại các khu vực pháp lý nêu trong chính sách (kết quả tìm kiếm ghi giấy phép quốc gia chỉ còn hiệu lực đến 30/06/2026 và từ đó chỉ chấp nhận MiCA; danh sách khu vực chính xác: [Chưa xác nhận]) [Một phần]. Chính sách cũng cấm app cho giao dịch quyền chọn nhị phân (binary options) và cấm đào tiền mã hoá trên thiết bị [Xác nhận]. Định nghĩa "sản phẩm và dịch vụ tài chính" của chính sách nhắc tới quản lý/đầu tư tiền và tiền mã hoá, **kể cả tư vấn cá nhân hoá** [Một phần].

Danh sách tuỳ chọn trong form (thay đổi theo thời điểm; các bản được tìm thấy không thống nhất): nhóm "Giao dịch và quỹ" có Ví tiền mã hoá, Sàn tiền mã hoá, Bán/giao dịch tài sản mã hoá dạng token (NFT), Giao dịch chứng khoán và quản lý danh mục; nhóm dịch vụ hỗ trợ có Tư vấn tài chính, Giám sát tín dụng, Bảo hiểm, Khác; luôn có "App của tôi không cung cấp tính năng tài chính nào" [Một phần]. **Danh sách hiện hành chưa xác nhận được.**

| Câu hỏi | Trả lời | Lý do / dòng code liên quan |
|---|---|---|
| App có là sàn giao dịch tiền mã hoá không? | **Không** | Không đặt lệnh, không khớp lệnh, không kết nối tài khoản sàn, không nhận API key. `terms.html` mục 2; dòng "Tự quản size/leverage" ở thẻ Rule cố định và pill "Không phải lệnh sàn" trong `index.html`. |
| App có là ví / giữ khoá / giữ tiền của người dùng không? | **Không** | Không có private key, không chứa tài sản. |
| Bán/giao dịch NFT hoặc token? | **Không** | |
| Giao dịch chứng khoán / quản lý danh mục? | **Không** | App không quản lý danh mục thật của người dùng. Nhật ký `journal.js` là ghi chú cá nhân tự nhập. |
| Cho vay, thanh toán, chuyển tiền, bảo hiểm? | **Không** | |
| Có tính năng "tư vấn tài chính"? | **QUYẾT ĐỊNH CỦA CHỦ APP, CHƯA XÁC NHẬN danh sách tuỳ chọn hiện hành.** Xem hai phương án ngay dưới bảng. | App tạo "kế hoạch tham khảo" (vùng vào, mức dừng lỗ, mục tiêu, khối lượng) tính từ vốn và % rủi ro do chính người dùng nhập (các hàm `planText`, `renderAction` trong `app.js`). Phép tính theo công thức công khai, nhưng có yếu tố "theo số liệu của người dùng" nên không thể nói app hoàn toàn không có yếu tố tài chính. Một phản hồi trên diễn đàn Play ghi nhận trường hợp bị từ chối vì khai báo "không chính xác": Google đối chiếu khai báo với hành vi app [Một phần]. |
| Ghi chú cho đội duyệt (nếu có ô ghi chú / khi kháng nghị) | Dán đoạn tiếng Anh dưới đây. | |

**Hai phương án khai (chủ app chọn sau khi đọc danh sách tuỳ chọn hiện hành trên Play Console):**

| | Phương án A: "công cụ phân tích, không có tính năng tài chính" | Phương án B: khai loại hỗ trợ/tư vấn tài chính ("Financial advice" hoặc "Other" nếu form có) |
|---|---|---|
| Khi nào hợp | Form chỉ có các mục sàn / ví / NFT / chứng khoán / vay / thanh toán và không có mục nào gần với phân tích đầu tư | Form có mục "Financial advice", "Other" hoặc mục tương đương (tìm kiếm ngày 14/11/2026 cho thấy nhóm "Credit monitoring and reporting, Financial advice, Insurance, Other"; **CHƯA XÁC NHẬN nguyên văn**) |
| Lập luận | App chỉ đọc dữ liệu công khai, không đặt lệnh, không giữ tiền, không kết nối tài khoản; kế hoạch là phép tính từ quy tắc kỹ thuật công khai | App tính khối lượng/SL/TP theo vốn người dùng nhập nên có thể bị xem là dịch vụ phân tích/tư vấn tài chính; khai đúng bản chất |
| Rủi ro | Bị từ chối vì khai "không chính xác" nếu Google xếp app vào nhóm tư vấn | Có thể kéo thêm yêu cầu xét duyệt hoặc câu hỏi bổ sung; nhãn trông "tài chính" hơn |
| **Khuyến nghị thận trọng** | Chỉ dùng khi form **không** có mục phù hợp hơn | **Nên ưu tiên khi form có mục phù hợp**: khai thừa an toàn hơn khai thiếu. Kèm đoạn ghi chú tiếng Anh dưới đây |

Cả hai phương án đều **phải đi cùng** các thay đổi giao diện trung tính hoá (không "mua khi/bán khi", không "Vào ngay", không "giữ", không thông báo đẩy chứa mức giá, nhãn "Lệnh có lãi (mô phỏng)" thay cho "Thắng", "Đủ ngưỡng" thay cho "đạt chuẩn/GIỮ/TẮT"); nếu chưa làm đủ thì rủi ro tăng ở cả hai phương án (xem `REVIEW-RISKS.md` R1, R3).

Đoạn ghi chú cho đội duyệt (tiếng Anh):

```
SOLPHA is a read-only technical analysis and journaling tool for crypto futures. It displays public Binance market data and calculates indicators on the user's device. It is not an exchange, broker, wallet or trading venue. It has no account system, does not connect to any exchange account or API key, does not place or route orders, does not hold, transfer or convert funds, and has no custody of assets. "Reference plans" (entry zone, stop level, targets, suggested position size) are arithmetic outputs of published technical rules and the capital / risk % that the user types in; they are labelled as reference only, not advice and not exchange orders. The app is for users 18+. Version 1.0.0 has no in-app purchases and no paid features.
```

Điều kiện kích hoạt khai báo lại (nếu sau này có): kết nối API key sàn, đặt lệnh hộ, copy-trading, giữ tiền, ví, tín hiệu cá nhân hoá do con người đưa ra, bán "tín hiệu" qua kênh khác. Mỗi cái làm thay đổi toàn bộ hồ sơ này và có thể kéo theo yêu cầu giấy phép.

---

## 3. Content rating (IARC)

Nền tảng: xếp hạng qua bảng câu hỏi IARC; trả lời sai hoặc cập nhật nội dung mà không làm lại thì có thể bị Google/cơ quan xếp hạng đổi hạng hoặc yêu cầu làm lại [Xác nhận]. Nội dung "mô phỏng cờ bạc" và "cờ bạc thật" được phân biệt trong bảng câu hỏi; app tiền thật chỉ được phép khi có giấy phép và được Google duyệt [Một phần]. **Chưa tìm thấy** hướng dẫn riêng của Google/IARC về việc giao dịch futures tiền mã hoá có được tính là "cờ bạc" hay không. Vì SOLPHA không cho đặt cược, không có vòng quay, không có thưởng ngẫu nhiên, câu trả lời ở bảng này là "Không" cho mọi mục cờ bạc.

| Câu hỏi (gần đúng với bảng IARC) | Trả lời gợi ý | Lý do |
|---|---|---|
| Loại app | **Tiện ích, năng suất, giao tiếp hoặc khác** (Utility, Productivity, Communication, or Other). Nếu form cho chọn "Tham khảo, tin tức hoặc giáo dục" thì cũng chấp nhận được; chọn loại mô tả đúng chức năng chính là công cụ. | [Chưa xác nhận] tên loại hiện hành |
| Bạo lực (kể cả hư cấu, máu, bạo lực với người/động vật) | **Không** | Không có đồ hoạ hay nội dung đó |
| Nội dung tình dục, khoả thân | **Không** | |
| Ngôn ngữ thô tục | **Không** | Ghi chú nhật ký do người dùng tự nhập, lưu cục bộ, không chia sẻ (xem dòng "Tương tác người dùng") |
| Chất kích thích (ma tuý, rượu, thuốc lá) | **Không** | |
| Cờ bạc mô phỏng | **Không** | Không có trò chơi may rủi |
| Cờ bạc / cá cược / cuộc thi bằng tiền thật | **Không** | App không nhận cược, không nhận tiền. Backtest và "soi lại" là mô phỏng số liệu quá khứ, không có trò chơi |
| Nội dung gây sợ hãi | **Không** | |
| Nội dung liên quan tới tài chính, tiền mã hoá | Nếu bảng có câu hỏi riêng về tiền mã hoá/giao dịch: trả lời đúng sự thật: **hiển thị dữ liệu và công cụ phân tích; không cho giao dịch, không giữ tiền**. | [Chưa xác nhận] bảng IARC hiện hành có câu này hay không |
| Có tương tác giữa người dùng / nội dung do người dùng tạo? | **Không** | Nhật ký chỉ nằm trên máy người dùng, không tải lên, không chia sẻ. |
| Có chia sẻ vị trí người dùng? | **Không** | `_headers`: `Permissions-Policy: geolocation=()`. Không có mã định vị. |
| Cho phép mua hàng kỹ thuật số? | Bản 1.0.0: **Không**. Bản có Pro: **Có** (mua trong app). | Play Billing khi bật |
| Truy cập Internet không giới hạn / trình duyệt? | **Không** | App không phải trình duyệt; chỉ gọi các tên miền cố định của Binance (hằng `ENDPOINTS`, `WS_HOSTS` trong `app.js`). Có liên kết ra ngoài trong `terms.html`/`privacy.html` (Google Support, Binance, Cloudflare, Google privacy) là liên kết thông tin. |
| Kết quả dự kiến | Mức thấp (khoảng 3+ / Everyone / PEGI 3 / USK 0 tuỳ cơ quan); mua trong app sẽ hiện nhãn "In-app purchases" khi có Pro. | [Chưa xác nhận] Hạng cuối cùng do IARC quyết định |

Điều chỉnh độc lập: **Target audience đặt 18+ dù hạng nội dung thấp** (xem mục 4). Hạng nội dung và độ tuổi mục tiêu là hai khai báo riêng.

---

## 4. Target audience and content (Đối tượng mục tiêu)

Nền tảng: phải khai độ tuổi mục tiêu trước khi phát hành app mới hoặc cập nhật; trước đó cần khai quảng cáo, hướng dẫn truy cập app và có chính sách quyền riêng tư; nếu trẻ em nằm trong đối tượng mục tiêu thì phải tuân thủ Families Policy; khai sai phần này có thể dẫn tới gỡ hoặc đình chỉ app [Xác nhận].

| Câu hỏi | Trả lời | Lý do / dòng code liên quan |
|---|---|---|
| Nhóm tuổi mục tiêu | Chỉ chọn **18 tuổi trở lên** (không chọn bất kỳ nhóm dưới 18) | `terms.html` mục 3 và `privacy.html` mục 5 đã ghi 18+. Giao dịch đòn bẩy trên crypto không phù hợp trẻ vị thành niên. |
| App có thu hút trẻ em không? | **Không** | Giao diện tối, thuật ngữ tài chính, không hoạt hình, không nhân vật. Ảnh chụp và icon cũng phải giữ như vậy. |
| App có chương trình Families / thiết kế cho trẻ em không? | **Không** | |
| Có thể thêm hạn chế ở phạm vi phân phối | Cân nhắc: chọn quốc gia phát hành theo mục "Quốc gia/khu vực" có chủ đích (xem `REVIEW-RISKS.md`: rủi ro theo khu vực) | |

---

## 5. Ads (Quảng cáo)

| Câu hỏi | Trả lời | Lý do |
|---|---|---|
| App có chứa quảng cáo không? | **Không** | Không có SDK quảng cáo; `index.html`, `app.js` không nạp script ngoài nào ngoài file cùng nguồn (đã đo: không host quảng cáo/phân tích). Lưu ý: nhãn "chứa quảng cáo" không bao gồm lời mời mua gói Pro [Xác nhận] nên bán Pro vẫn là "Không quảng cáo". |
| Advertising ID | **Không dùng** | Kiểm tra trên file `.aab` thật bằng `bundletool`/`aapt2 dump permissions`: nếu có quyền `com.google.android.gms.permission.AD_ID` do thư viện kéo vào thì phải khai "có dùng" hoặc gỡ quyền. [Chưa xác nhận] cho bản build thực |

---

## 6. App access (Hướng dẫn truy cập app)

Nền tảng: nếu toàn bộ hoặc một phần app bị khoá bởi đăng nhập, thành viên, vị trí... thì phải cung cấp đủ thông tin cho reviewer; thông tin đăng nhập phải luôn dùng được, tái sử dụng được, hợp lệ từ mọi nơi, và **viết bằng tiếng Anh**; nếu app không đăng nhập nhưng có chức năng sau paywall thì phải kèm hướng dẫn bổ sung để reviewer vào được toàn bộ [Xác nhận]. Trong console hiện có thể tên mục là "Sign-in details" thay vì "App access" [Một phần].

| Câu hỏi | Trả lời | Lý do |
|---|---|---|
| Bản 1.0.0 (không Pro): chọn gì? | **"Tất cả chức năng đều khả dụng mà không cần quyền truy cập đặc biệt."** Không cần tài khoản test. Vẫn nên dán ghi chú dưới đây vào ô hướng dẫn nếu form cho phép. | Không có đăng nhập. |
| Bản có Pro: chọn gì? (chưa áp dụng cho 1.0.0) | Chọn nhóm **có hạn chế**, nhập hướng dẫn ở khung "bản có Pro" (tiếng Anh), mô tả đúng giao diện thật. | Có chức năng sau paywall. |

Ghi chú cho reviewer, bản 1.0.0 (tiếng Anh, dán nguyên; mô tả đúng những gì reviewer sẽ thấy ở bản build gửi duyệt, kiểm lại từng câu trên máy thật trước khi dán):

```
No sign-in is required. All features are available on first launch.

First launch: a "Before you use" dialog (in Vietnamese) shows a risk warning and an 18+ confirmation. Tap the button "Tôi đã hiểu và đồng ý" ("I understand and agree") to continue. It is shown once.

How to see real-time prices: the first screen (the "Tín hiệu" / Signal tab) shows the live price for SOLUSDT within a few seconds. A timestamp with a lightning icon next to the price means the WebSocket stream is live (the "REALTIME" pill is on the Analysis tab). The pair bar at the top switches between SOL, BTC, ETH and DOGE, or adds a custom USDT pair (up to 8 pairs). Tabs at the bottom: Signal, Analysis (multi-timeframe indicators), Tools (about 5-day backtest, 30-day optimisation, replay), Journal, Settings. The interface language is Vietnamese only.

Data source: public Binance Futures market-data endpoints (fapi.binance.com, fapi1.binance.com, api.binance.com, and the WebSocket host fstream.binance.com). They are read-only and need no API key. The app does not connect to any exchange account and does not place orders.

Region note: Binance blocks public market data in some countries (for example the United States). If your test device is in such a region the app cannot load prices: it shows a message saying that market data from Binance is not reachable on this network or region, with a Retry button, and it stops retrying automatically after a few attempts. A screen recording of the full flow from a supported region is at [VIDEO_URL] (unlisted). Please contact [EMAIL] and we will respond within one business day.

To see the reference plan: open the Settings tab and enter Capital (e.g. 1000) and Risk per trade (e.g. 1%); apart from these two inputs, Settings only has on/off switches for the technical conditions and display options. Return to the Signal tab: when a technical condition is met the app shows a reference entry zone, stop level, targets and suggested size; otherwise it shows "waiting" (for about 3 hours after a plan it may also show a line with the latest reference plan). These are reference calculations, not orders or advice.
```

Khuyến nghị: quay video màn hình (không có âm thanh cũng được) từ khu vực Binance truy cập được, gồm: mở lần đầu (hộp "Trước khi dùng"), giá realtime, 5 tab, nhập vốn/rủi ro ở Cài đặt, thêm một cặp, chạy Backtest, bật thông báo thử, và (nếu quay được) màn hình khi Binance không truy cập được cùng nút thử lại. Đăng lên liên kết không liệt kê (unlisted) và dán vào `[VIDEO_URL]`.

Ghi chú bổ sung cho reviewer, **chỉ cho bản có Pro và chỉ khi giao diện mua gói đã tồn tại** (khung dưới là mẫu, điền theo giao diện THẬT; app hiện KHÔNG có nhãn "Pro" và KHÔNG có nút "Restore purchase"/"Khôi phục giao dịch", nên bản cũ của đoạn này đã bị bỏ):

```
Paid plan (SOLPHA Pro): Google Play subscriptions ([MONTHLY/YEARLY], [TRIAL LENGTH] for eligible users). Where to find it in the app: [EXACT SCREEN AND BUTTON NAME]. Features it unlocks: [EXACT LIST]. To test the purchase flow: the reviewer account [REVIEWER_GMAIL] has been added under Play Console > Settings > License testing, so purchases made with it are test purchases (no charge) and renew on an accelerated schedule. If you use a different account, please use promo code [PROMO_CODE] or contact [EMAIL] and we will add the account within one business day. Manage or cancel: Google Play > Payments and subscriptions > Subscriptions.
```

Cách thử gói Pro bằng license tester (để đội kiểm thử nội bộ làm sau khi UI mua gói và Worker đã có; không áp dụng cho 1.0.0):

1. Play Console > Settings > License testing: thêm các địa chỉ Gmail của người thử, đặt "License response" là RESPOND_NORMALLY.
2. Tải bản có Pro lên track **Internal testing** (hoặc Closed), thêm cùng Gmail vào danh sách tester, mở link opt-in và cài từ Google Play (không cài file APK ngoài vì Billing cần cài từ Play).
3. Đăng ký thử: Play hiện hộp thoại thanh toán nhãn "test card", không trừ tiền. Gói thử có thời gian gia hạn rút ngắn: theo bài đăng của Android Developers (2018), gói 1 tháng gia hạn sau khoảng 5 phút, gói 1 năm khoảng 30 phút, dùng thử khoảng 3 phút, tối đa 6 lần gia hạn rồi tự huỷ [Một phần: nguồn 2018, nên đối chiếu số hiện hành].
4. Thử đủ: mua → trial → chuyển thành trả phí → huỷ → hết hạn → mua lại (hoặc khôi phục, nếu đã thêm nút khôi phục vào giao diện); xem Worker ghi đúng trạng thái.
5. Chrome/TWA: Digital Goods API chỉ chạy khi PWA chạy trong TWA, qua HTTPS, và cần Chrome 101+; Bubblewrap bật `features.playBilling` (có tài liệu ghi cần thêm `alphaDependencies.enabled` khi build) rồi build lại AAB [Một phần: từ trang tài liệu Chrome]. Hiện cả hai cờ đang là `false` trong `twa-manifest.json`, `billing.js` chưa được nạp trong `index.html` và Worker chưa triển khai, nghĩa là **bản 1.0.0 trong repo chưa thể bán Pro**.
6. Reviewer của Google thường dùng tài khoản của họ, không phải tài khoản bạn thêm vào License testing. Do đó nên có phương án dự phòng: mã khuyến mãi (promo code) cho gói đăng ký [Chưa xác nhận hạn mức và điều kiện], hoặc một video quay toàn bộ luồng Pro, hoặc để người dùng mới được dùng thử 7 ngày ngay trong luồng mua thật (reviewer huỷ ngay vẫn xem được).

---

## 7. News / Government / Health

| Khai báo | Trả lời | Lý do |
|---|---|---|
| Ứng dụng tin tức (News app)? | **Không** | App hiển thị giá và chỉ báo, không đăng bài viết/tin tức. Nhật ký là ghi chú cá nhân. [Xác nhận] có mục khai báo riêng cho app tin tức |
| Ứng dụng chính phủ (Government)? | **Không** | Không do cơ quan nhà nước phát hành hay uỷ quyền. [Xác nhận] |
| Ứng dụng sức khoẻ (Health)? | **Chọn "app không có tính năng sức khoẻ"** | Không có tính năng y tế/thể chất. "Điểm kỷ luật" trong nhật ký là điểm tuân thủ checklist giao dịch, không phải sức khoẻ tinh thần. [Xác nhận] về lựa chọn "không có tính năng sức khoẻ" |
| Khai báo khác nếu console hiện thêm (ví dụ ứng dụng y tế, mục tiêu hiệu năng, an toàn trẻ em/CSAE, quyền đặc biệt) | Trả lời "Không áp dụng", trừ khi form có câu hỏi khác điều đã nêu | |

---

## 8. Permissions (Quyền)

App là TWA: vỏ Android rất mỏng, chạy bằng Chrome. Cần xác minh danh sách quyền thực tế bằng lệnh sau lên tệp `.aab` đã build (không dùng suy đoán):

```
bundletool dump manifest --bundle=app-release.aab | grep uses-permission
```

| Quyền | Khai trong form / giải thích | Lý do / dòng code liên quan |
|---|---|---|
| `android.permission.INTERNET` | Quyền thường, không cần giải trình | Gọi Binance (và tải app từ hosting) |
| `android.permission.POST_NOTIFICATIONS` (Android 13+) | Quyền runtime. Chỉ xin khi người dùng bấm "Bật báo" hoặc "Gửi thông báo thử" (xử lý nút trong `app.js`; đã đo ngày 14/11/2026: 0 lần gọi `Notification.requestPermission()` khi mở app). Khi mở app chỉ đọc trạng thái quyền hiện có. Mục đích: thông báo ngay trên máy khi app đang chạy và có điều kiện kỹ thuật do người dùng bật (nội dung trung tính, không chứa mức giá vào/SL/TP). Muốn ứng dụng có hộp thoại quyền gốc của Android, app phải nhắm API 33+ [Xác nhận]. | `twa-manifest.json`: `enableNotifications: true` (cơ chế uỷ quyền thông báo của TWA). Không có kết nối push (FCM): thông báo tạo cục bộ qua service worker (hàm `notify` trong `app.js`, `notificationclick` trong `sw.js`). **CHƯA XÁC NHẬN** việc `POST_NOTIFICATIONS` có thật sự nằm trong AAB (cần `bundletool dump manifest`). |
| `android.permission.WAKE_LOCK` | Thường **không** nằm trong manifest của TWA. Tính năng "Giữ màn hình sáng" (`navigator.wakeLock` trong `app.js`) do Chrome xử lý, chỉ chạy khi người dùng bật trong Cài đặt (đã đo). | [Chưa xác nhận] cho bản build thực |
| Vị trí, camera, micro, danh bạ, SMS, bộ nhớ, lịch... | **Không xin** | `_headers`: `Permissions-Policy: camera=(), microphone=(), geolocation=()` |
| Quyền nhạy cảm cần form khai báo riêng (SMS/Call log, all files access, ...) | **Không có** | |
| Foreground service, background location, `SCHEDULE_EXACT_ALARM` | **Không có** | Thông báo chỉ khi app đang chạy (kể cả vừa chuyển nền, tuỳ Android cho phép); không có dịch vụ chạy nền riêng (`terms.html` mục 1 ghi rõ Android có thể tạm dừng app) |

Quyền thật trong AAB: **CHƯA XÁC NHẬN** (repo không có AAB). `twa-manifest.json` đặt `enableNotifications: true` nên Bubblewrap có thể thêm uỷ quyền thông báo; `WAKE_LOCK` và `AD_ID` cũng chưa kiểm. Dán kết quả `bundletool` vào hồ sơ nội bộ.

Nếu `bundletool` hiện thêm quyền nằm ngoài danh sách trên (ví dụ `AD_ID`, `FOREGROUND_SERVICE`, `REQUEST_INSTALL_PACKAGES`), dừng lại và xử lý trước khi gửi duyệt.

---

## 9. Các khai báo liên quan "cờ bạc / crypto"

| Hạng mục | Trả lời | Lý do |
|---|---|---|
| Gambling policy / khai báo ứng dụng cờ bạc | **Không áp dụng.** Nếu console hiện câu "app có chứa cờ bạc, cá cược, xổ số, fantasy sports bằng tiền thật?" thì chọn **Không**. | App không nhận cược, không có cược/thưởng giữa người dùng. [Chưa xác nhận] vị trí và nhãn của khai báo này trong console; [Chưa xác nhận] việc Google có bao giờ coi giao dịch phái sinh đòn bẩy là cờ bạc |
| Quyền chọn nhị phân (binary options) | **Không có** | Chính sách cấm hoàn toàn [Xác nhận]. Tránh mọi cách nói dẫn tới "dự đoán lên/xuống trong X phút". Ở app dùng chữ "kế hoạch tham khảo" và "điều kiện kỹ thuật". |
| Sàn / ví tiền mã hoá | **Không phải** (xem mục 2) | |
| Đào tiền mã hoá trên thiết bị | **Không** | Cấm theo chính sách [Xác nhận]; app không chạy mã đào. |
| Token hoá tài sản / NFT | **Không** | |
| Phát hành token, ICO, airdrop, thưởng bằng token | **Không** | Không quảng bá |
| Bán "tín hiệu" qua ngoài Google Play | Không có trong app. Nếu sau này dẫn người dùng ra ngoài để trả phí (website, Telegram, VIP) thì vi phạm Payments policy với hàng hoá số trong app. Mọi khoản thu cho tính năng trong app phải qua Google Play Billing. | Quy định thanh toán đang thay đổi: theo thông tin báo chí tìm được, Google đã mở thêm lựa chọn thanh toán thay thế tại Mỹ, Anh, EEA từ 30/06/2026; phí và điều kiện mâu thuẫn giữa các nguồn nên **chưa xác nhận**. Ở Việt Nam: dùng Play Billing như mặc định. |
| Mức phí dịch vụ Google (ghi nhận, không phải khai báo) | Chưa xác nhận con số hiện hành. Các nguồn tìm được khác nhau (đăng ký 10% hoặc 15%). | Đọc bảng phí chính thức khi tạo sản phẩm. |
| Tuân thủ pháp luật nơi người dùng sống | `terms.html` mục 2 đã nêu trách nhiệm người dùng. Việc phát hành ở Việt Nam hay quốc gia khác: **cần tư vấn pháp lý riêng** (khung pháp lý tài sản mã hoá thay đổi). | [Chưa xác nhận] không tra khung pháp lý Việt Nam trong đợt này |

---

## 10. Việc kèm theo trước khi bấm gửi (liên quan trực tiếp tới các câu trả lời trên)

1. Điền hết `[TÊN PHÁP NHÂN]`, `[EMAIL]`, `[WEBSITE]` trong `privacy.html`, `terms.html` (hiện còn trống); trong `LISTING.md` điền `[EMAIL]`, `[WEBSITE]`. Play từ chối chính sách thiếu liên hệ.
2. `.well-known/assetlinks.json` còn `THAY_BANG_SHA256_CUA_KHOA_KY_TU_PLAY_CONSOLE`: điền SHA-256 của khoá app signing của Play (và khoá upload nếu cần) rồi mới thử bản cài từ Play.
3. Thương hiệu (theo `BRAND-AUDIT.md`): đã sửa precache `sw.js` (không nạp tệp bản web thường), mở lại từ thông báo/shortcut giữ `source=play`, trang pháp lý luôn dùng giao diện SOLPHA. **Còn lại:** chưa tách build Play riêng nên mã nguồn tĩnh phục vụ cho Play vẫn chứa chuỗi/tệp của bản web thường; chưa thử trên Android thật (nhánh `android-app://`). Chi tiết ở `REVIEW-RISKS.md` R0.
4. Chạy `bundletool` kiểm quyền (mục 8), kể cả `AD_ID`.
5. Kiểm bản build thực: không còn request tới `fonts.googleapis.com`/`fonts.gstatic.com`; thử bằng IP Mỹ/EU/VN để xem thông báo khi Binance bị chặn.
6. Quyết định Financial features declaration (mục 2: phương án A hay B) sau khi đọc danh sách tuỳ chọn hiện hành.
7. Với bản Pro (sau 1.0.0): nối giao diện mua gói, nạp `billing.js`, triển khai Worker + quy trình xoá dữ liệu, điền `[SỐ NGÀY]` trong `privacy.html`, cập nhật mục 1B, listing Bản B, bật `playBilling`.

## 11. Nguồn đã tra (13/11/2026; kiểm toán 14/11/2026 tra bổ sung bằng WebSearch)

Chính sách chung và khai báo:
- Financial Services policy: https://support.google.com/googleplay/android-developer/answer/9876821
- Cryptocurrency Exchanges and Software Wallets policy: https://support.google.com/googleplay/android-developer/answer/16329703
- Financial features declaration: https://support.google.com/googleplay/android-developer/answer/13607354 và https://support.google.com/googleplay/android-developer/answer/13849271
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Data safety (định nghĩa xử lý tạm thời, dữ liệu trên thiết bị): https://support.google.com/googleplay/answer/11416267
- User Data policy / privacy policy: tổng hợp từ trang Data safety và https://support.google.com/googleplay/android-developer/answer/13327111
- Content rating: https://support.google.com/googleplay/android-developer/answer/9859655 và https://support.google.com/googleplay/android-developer/answer/188189
- Target audience and app content: https://support.google.com/googleplay/android-developer/answer/9285070
- App content (Ads, News, Government, Health, Financial, Target audience): https://support.google.com/googleplay/android-developer/answer/9859455
- App access / sign-in details: https://support.google.com/googleplay/android-developer/answer/9859455 (mục hướng dẫn truy cập)
- Subscriptions (dùng thử, giá, huỷ): https://android-developers.googleblog.com/2020/04/building-user-trust-through-more.html
- Test subscriptions / license testers: https://android-developers.googleblog.com/2018/01/faster-renewals-for-test-subscriptions.html
- Metadata policy: https://support.google.com/googleplay/android-developer/answer/9898842
- Play Billing trong TWA: https://developer.chrome.com/docs/android/trusted-web-activity/play-billing và https://developer.chrome.com/docs/android/trusted-web-activity/receive-payments-play-billing
- Quyền thông báo Android 13: https://developer.android.com/about/versions/13/changes/notification-permission
- Thay đổi thanh toán Play 2026 (thông tin báo chí, mâu thuẫn giữa nguồn): https://www.androidheadlines.com/2026/06/google-play-store-external-billing-fee-changes.html

**Điểm chưa xác nhận được tổng hợp:** nguyên văn hiện hành của mọi trang trên (chỉ đọc qua kết quả tìm kiếm); danh sách tuỳ chọn hiện hành của Financial features declaration và có mục nào hợp với "công cụ phân tích" không (**CHƯA XÁC NHẬN**, chủ app quyết định ở mục 2); WebSocket tới `fstream.binance.com` có mở được ở vùng Binance cho phép không (sandbox kiểm toán bị chặn) và phản hồi chặn thật của Binance (451/403 hay lỗi mạng thô); danh sách khu vực pháp lý của chính sách sàn/ví; IP gửi tới bên thứ ba có phải khai trong Data safety không; Cloudflare = "nhà cung cấp dịch vụ" có miễn khai "chia sẻ" không; câu hỏi IARC về tiền mã hoá; vị trí khai báo cờ bạc; quyền thực tế trong AAB; mức phí và điều kiện thanh toán thay thế 2026; hạn mức promo code cho gói đăng ký.
