# SOLPHA · Futures Desk — Câu trả lời cho các mục form Play Console

Cập nhật 13/11/2026 · Áp dụng cho `app.solpha.desk` v1.0.0 (TWA, `solpha.pages.dev`).

Cách đọc: mỗi bảng có 3 cột "Câu hỏi → Trả lời → Lý do / dòng code liên quan". Cột cuối ghi **mức xác nhận chính sách**:

- **[Xác nhận]** thấy trong kết quả tìm kiếm trích từ trang chính sách của Google ngày 13/11/2026.
- **[Một phần]** có dấu hiệu trong kết quả tìm kiếm nhưng chưa thấy nguyên văn hiện hành.
- **[Chưa xác nhận]** là hiểu biết chung hoặc suy luận, phải đối chiếu trên Play Console lúc điền.

Hạn chế khi soạn: WebFetch không mở được `support.google.com` trong môi trường này, nên không đọc được nguyên văn trang gốc; toàn bộ dẫn chứng đến từ WebSearch (mode standard). Các tên ô, nhãn tuỳ chọn trong form có thể đã đổi; khi form khác với bảng dưới thì chọn phương án trung thực nhất theo nguyên tắc ghi ở từng mục.

## 0. Hai trạng thái của app, hai bộ câu trả lời

| | Bản 1.0.0 gửi duyệt (không có Pro) | Bản có SOLPHA Pro |
|---|---|---|
| Thanh toán | Không. `twa-manifest.json`: `features.playBilling.enabled = false` | Google Play Billing (đăng ký tháng/năm, dùng thử 7 ngày) |
| Máy chủ của nhà phát triển | Không | Cloudflare Worker lưu mã giao dịch (purchase token) + trạng thái gói |
| Data safety | Không thu thập, không chia sẻ | Khai "Purchase history" (và "Device or other IDs" nếu thật sự có) |
| Listing | Bản A trong `LISTING.md` | Bản B trong `LISTING.md` |
| App access | Không cần tài khoản | Không tài khoản, nhưng có tính năng sau paywall: phải kèm hướng dẫn |

Nguyên tắc: **form phải khớp đúng bản đang phát hành**. Khi bật Pro, cập nhật Data safety, chính sách quyền riêng tư và listing **trước hoặc cùng lúc** với bản phát hành đó; đừng khai trước cho thứ chưa có (khai sai theo cả hai chiều đều là vi phạm). Chính sách Play nói người phát triển chịu trách nhiệm về độ chính xác và cập nhật nhãn Data safety [Xác nhận].

---

## 1. Data safety

Nền tảng: Google yêu cầu **mọi app** (kể cả app không thu thập gì) điền form và đặt link chính sách quyền riêng tư; Google xem xét câu trả lời trong quá trình duyệt app [Xác nhận]. Dữ liệu chỉ xử lý cục bộ trên thiết bị, không gửi ra ngoài, thì không cần khai là "thu thập" [Xác nhận]. Dữ liệu xử lý tạm thời trong bộ nhớ chỉ để phục vụ yêu cầu thời gian thực có thể không hiển thị công khai nhưng vẫn phải có trong câu trả lời form [Xác nhận].

### 1A. Bản 1.0.0 (không Pro, không backend)

| Câu hỏi | Trả lời | Lý do / dòng code liên quan |
|---|---|---|
| App có thu thập hoặc chia sẻ loại dữ liệu người dùng bắt buộc khai nào không? | **Không** | Không có máy chủ riêng, không tài khoản, không SDK bên thứ ba, không quảng cáo. Cài đặt, vốn, % rủi ro, nhật ký chỉ ở `localStorage` (`app.js:10-11`, khoá `solpha_*`; `journal.js:4` khoá `solpha_journal`). Không gửi đi đâu. [Một phần] |
| Yêu cầu gửi tới Binance (`fapi`, `fstream`, `api`) có tính là thu thập/chia sẻ không? | **Không khai.** Các request chỉ chứa mã cặp và khung thời gian của dữ liệu thị trường công khai, không có dữ liệu cá nhân. | `app.js:8` (`ENDPOINTS`), `app.js:123` (`fetch`), `app.js:707` (`WS_HOSTS`). Binance thấy IP như mọi website; IP không nằm trong danh sách loại dữ liệu để chọn. [Chưa xác nhận] việc Google có coi IP gửi tới bên thứ ba là "Device or other IDs" hay không (xem phương án dự phòng bên dưới) |
| Tải phông Roboto từ Google Fonts có phải khai không? | **Không khai** | `index.html:7-9`. Chỉ là tải tài nguyên tĩnh; Google thấy IP. Nên cân nhắc tự host phông (xem khuyến nghị cuối mục) để bỏ hẳn câu hỏi này. [Chưa xác nhận] |
| Dữ liệu có được mã hoá khi truyền không? | **Có** (nếu form hỏi) | Mọi địa chỉ đều `https://` hoặc `wss://` (`app.js:8`, `app.js:707`, `index.html:9`). Nếu không khai thu thập gì thì câu hỏi này thường không hiện. |
| Người dùng có thể yêu cầu xoá dữ liệu không? | **Không áp dụng** vì nhà phát triển không giữ dữ liệu nào. Trong chính sách quyền riêng tư đã ghi cách tự xoá: Cài đặt → Ứng dụng → SOLPHA → Bộ nhớ → Xoá dữ liệu. | `privacy.html` mục 6 |
| App có cho tạo tài khoản không (mục xoá tài khoản)? | **Không** | Không có đăng ký/đăng nhập trong `index.html` / `app.js` |
| Link chính sách quyền riêng tư | `https://solpha.pages.dev/privacy.html` | Phải điền xong `[TÊN PHÁP NHÂN]`, `[EMAIL]`, `[WEBSITE]` trong file; có link trong app (footer `index.html:257`), đúng yêu cầu "link trong app và trong Play Console" [Xác nhận] |

**Phương án dự phòng nếu Play yêu cầu sửa** (khai thận trọng hơn): chọn "Có thu thập", loại **Device or other IDs** (chỉ vì địa chỉ IP gửi tới bên thứ ba), mục đích **App functionality**, đánh dấu **có chia sẻ với bên thứ ba** (Binance; Google Fonts), dữ liệu **không** tuỳ chọn tắt được. Chỉ dùng khi bị yêu cầu, vì nhãn này làm app trông "thu thập" hơn thực tế.

**Khuyến nghị kỹ thuật để câu trả lời "Không" vững hơn** (không sửa trong đợt này, chỉ ghi nhận): tự host phông Roboto thay vì tải từ Google Fonts; giữ nguyên chính sách "không SDK bên thứ ba" (nếu thêm Firebase/Analytics/Crashlytics thì bảng này sai ngay).

### 1B. Bản có SOLPHA Pro + Cloudflare Worker

Chỉ áp dụng nếu Worker **thật sự** lưu các trường dưới đây. Trước khi khai, rà lại mã Worker và cấu hình Cloudflare (logs, Logpush, KV/D1) để biết chính xác lưu gì.

| Câu hỏi | Trả lời | Lý do / dòng code liên quan |
|---|---|---|
| App có thu thập dữ liệu người dùng không? | **Có** | Worker nhận và lưu mã giao dịch (purchase token) + trạng thái gói để mở tính năng Pro. |
| Loại dữ liệu: Financial info > **Purchase history** | **Khai: thu thập**. Mục đích: **App functionality** (mở khoá Pro) và **Fraud prevention, security, and compliance** (xác minh giao dịch với Google Play Developer API). Chọn "Người dùng có thể chọn có/không thu thập" (chỉ phát sinh khi họ chủ động đăng ký). | Dữ liệu: purchase token, product ID, thời điểm mua/hết hạn, trạng thái (active, trial, cancelled, expired). Không lưu số thẻ: Google Play xử lý thanh toán. [Một phần] về việc Purchase history thuộc nhóm Financial info; đối chiếu nhãn trên form |
| Loại dữ liệu: **Device or other IDs** | Chỉ khai nếu app sinh ra mã cài đặt/UUID/ID thiết bị và gửi lên Worker. Nếu chỉ dùng purchase token thì **không khai thêm**. | Thiết kế khuyến nghị: không tạo ID riêng, dùng purchase token làm khoá. Nếu có thêm ID thì khai và ghi vào chính sách quyền riêng tư. |
| IP trong nhật ký Cloudflare | Tắt ghi nhật ký IP của Worker nếu không cần. Nếu phải bật (Workers Logs, Logpush) thì ghi rõ vào chính sách và cân nhắc khai "Device or other IDs". | [Chưa xác nhận] cách Google coi IP trong log máy chủ |
| Có chia sẻ dữ liệu với bên thứ ba không? | **Không** (Cloudflare chỉ là nhà cung cấp dịch vụ xử lý thay cho nhà phát triển; Google Play là bên cung cấp thanh toán). | Chuyển dữ liệu cho nhà cung cấp dịch vụ xử lý thay mặt nhà phát triển thường không tính là "chia sẻ" [Chưa xác nhận nguyên văn hiện hành; đối chiếu định nghĩa "share" trên form] |
| Mã hoá khi truyền? | **Có** | Worker chỉ nhận qua HTTPS (Cloudflare mặc định). |
| Cách xoá dữ liệu | **Có**: email `[EMAIL]` hoặc trang `https://solpha.pages.dev/privacy.html#xoa-du-lieu` (cần thêm mục này). Worker phải có thao tác xoá theo purchase token thực sự dùng được. | Nếu khai "có" mà không làm được là khai sai. Dữ liệu giao dịch có thể phải giữ theo luật thuế/kế toán: ghi rõ thời hạn giữ trong chính sách. |
| Dữ liệu cá nhân khác (email, tên, vị trí, danh bạ) | **Không** | Tiếp tục đúng như `privacy.html` mục 3. |

Việc phải làm trong `privacy.html` khi bật Pro (ghi nhận, chưa sửa trong đợt này): mục 4 hiện chỉ nói "mã xác nhận mua hàng". Cần thay bằng danh sách trường Worker lưu, mục đích, nhà xử lý (Cloudflare), thời hạn giữ, cách yêu cầu xoá, và nói rõ app vẫn không thu thập dữ liệu cá nhân khác.

---

## 2. Financial features declaration (Khai báo tính năng tài chính)

Nền tảng chính sách: mọi nhà phát triển có app trên Play (kể cả bản thử nghiệm) phải điền khai báo này, kể cả khi app không có tính năng tài chính nào thì phải xác nhận là không có [Xác nhận]. Chính sách về **sàn tiền mã hoá và ví phần mềm** yêu cầu khai báo ở App content > Financial features declaration; ví không giữ khoá của người dùng (non-custodial) nằm ngoài phạm vi chính sách đó; yêu cầu giấy phép chỉ áp dụng cho sàn/ví tại các khu vực pháp lý nêu trong chính sách (kết quả tìm kiếm ghi giấy phép quốc gia chỉ còn hiệu lực đến 30/06/2026 và từ đó chỉ chấp nhận MiCA; danh sách khu vực chính xác: [Chưa xác nhận]) [Một phần]. Chính sách cũng cấm app cho giao dịch quyền chọn nhị phân (binary options) và cấm đào tiền mã hoá trên thiết bị [Xác nhận]. Định nghĩa "sản phẩm và dịch vụ tài chính" của chính sách nhắc tới quản lý/đầu tư tiền và tiền mã hoá, **kể cả tư vấn cá nhân hoá** [Một phần].

Danh sách tuỳ chọn trong form (thay đổi theo thời điểm; các bản được tìm thấy không thống nhất): nhóm "Giao dịch và quỹ" có Ví tiền mã hoá, Sàn tiền mã hoá, Bán/giao dịch tài sản mã hoá dạng token (NFT), Giao dịch chứng khoán và quản lý danh mục; nhóm dịch vụ hỗ trợ có Tư vấn tài chính, Giám sát tín dụng, Bảo hiểm, Khác; luôn có "App của tôi không cung cấp tính năng tài chính nào" [Một phần]. **Danh sách hiện hành chưa xác nhận được.**

| Câu hỏi | Trả lời | Lý do / dòng code liên quan |
|---|---|---|
| App có là sàn giao dịch tiền mã hoá không? | **Không** | Không đặt lệnh, không khớp lệnh, không kết nối tài khoản sàn, không nhận API key. `terms.html` mục 2; `index.html:250` ("Tự quản size/leverage"). Đặt tên mục "Lệnh tham khảo — Không phải lệnh sàn" (`index.html`, thẻ `order-card`). |
| App có là ví / giữ khoá / giữ tiền của người dùng không? | **Không** | Không có private key, không chứa tài sản. |
| Bán/giao dịch NFT hoặc token? | **Không** | |
| Giao dịch chứng khoán / quản lý danh mục? | **Không** | App không quản lý danh mục thật của người dùng. Nhật ký `journal.js` là ghi chú cá nhân tự nhập. |
| Cho vay, thanh toán, chuyển tiền, bảo hiểm? | **Không** | |
| Có tính năng "tư vấn tài chính"? | **Hướng dẫn chọn:** nếu form có mục tư vấn/phân tích đầu tư (loại hỗ trợ) thì **cân nhắc chọn đúng mục đó thay vì "không có tính năng tài chính"**, vì app tạo "kế hoạch tham khảo" gồm SL/TP/khối lượng tính từ vốn và % rủi ro của chính người dùng (`app.js:266-277`, `app.js:580-603`). Khai đúng bản chất an toàn hơn khai thiếu; tờ khai không khớp hành vi app có thể bị từ chối. Nếu form chỉ có các tuỳ chọn sàn/ví/NFT/chứng khoán/vay thì chọn "Không có tính năng tài chính" kèm ghi chú gửi duyệt (xem dưới). | [Chưa xác nhận] tuỳ chọn nào có trong form hiện hành. Một phản hồi trong diễn đàn Play ghi nhận trường hợp bị từ chối vì khai báo "không chính xác": ghi nhận cho thấy Google đối chiếu khai báo với hành vi app [Một phần] |
| Ghi chú cho đội duyệt (nếu có ô ghi chú / khi kháng nghị) | Dán đoạn tiếng Anh dưới đây. | |

Đoạn ghi chú cho đội duyệt (tiếng Anh):

```
SOLPHA is a read-only technical analysis and journaling tool for crypto futures. It displays public Binance market data and calculates indicators on the user's device. It is not an exchange, broker, wallet or trading venue. It has no account system, does not connect to any exchange account or API key, does not place or route orders, does not hold, transfer or convert funds, and has no custody of assets. "Reference plans" (entry zone, stop level, targets, position size) are arithmetic outputs of published technical rules and the capital/risk % the user types in; they are labelled as not advice and not exchange orders. The app is for users 18+. Paid plan (when enabled): digital software features sold only through Google Play Billing.
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
| Truy cập Internet không giới hạn / trình duyệt? | **Không** | App không phải trình duyệt; chỉ gọi các tên miền cố định ở `app.js:8`, `app.js:707`, `index.html:9`. Có liên kết ra ngoài trong `terms.html`/`privacy.html` (Google Support, Binance privacy) là liên kết thông tin. |
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
| App có chứa quảng cáo không? | **Không** | Không có SDK quảng cáo; `index.html`, `app.js` không nạp script ngoài nào ngoài file cùng nguồn. Lưu ý: nhãn "chứa quảng cáo" không bao gồm lời mời mua gói Pro [Xác nhận] nên bán Pro vẫn là "Không quảng cáo". |
| Advertising ID | **Không dùng** | Kiểm tra trên file `.aab` thật bằng `bundletool`/`aapt2 dump permissions`: nếu có quyền `com.google.android.gms.permission.AD_ID` do thư viện kéo vào thì phải khai "có dùng" hoặc gỡ quyền. [Chưa xác nhận] cho bản build thực |

---

## 6. App access (Hướng dẫn truy cập app)

Nền tảng: nếu toàn bộ hoặc một phần app bị khoá bởi đăng nhập, thành viên, vị trí... thì phải cung cấp đủ thông tin cho reviewer; thông tin đăng nhập phải luôn dùng được, tái sử dụng được, hợp lệ từ mọi nơi, và **viết bằng tiếng Anh**; nếu app không đăng nhập nhưng có chức năng sau paywall thì phải kèm hướng dẫn bổ sung để reviewer vào được toàn bộ [Xác nhận]. Trong console hiện có thể tên mục là "Sign-in details" thay vì "App access" [Một phần].

| Câu hỏi | Trả lời | Lý do |
|---|---|---|
| Bản 1.0.0 (không Pro): chọn gì? | **"Tất cả chức năng đều khả dụng mà không cần quyền truy cập đặc biệt."** Không cần tài khoản test. Vẫn nên dán ghi chú dưới đây vào ô hướng dẫn nếu form cho phép. | Không có đăng nhập. |
| Bản có Pro: chọn gì? | Chọn nhóm **có hạn chế**, nhập hướng dẫn bên dưới (tiếng Anh). | Có chức năng sau paywall. |

Ghi chú cho reviewer, bản 1.0.0 (tiếng Anh, dán nguyên):

```
No sign-in is required. All features are available on first launch.

How to see real-time prices: open the app. The first screen ("Tín hiệu"/Signal tab) shows the live price for SOLUSDT with a LIVE indicator within a few seconds. Tabs at the bottom: Signal, Analysis (multi-timeframe indicators), Tools (backtest / 30-day optimisation / replay), Journal, Settings. Use the pair bar at the top to switch between SOL, BTC, ETH, DOGE or add a custom pair.

Data source: public Binance Futures market-data endpoints (fapi.binance.com, fstream.binance.com, api.binance.com). They are read-only and need no API key. The app does not connect to any exchange account and does not place orders.

Region note: if your test device is in a region where Binance blocks public market data (for example the United States), prices may not load. A screen recording of the full flow from a supported region is at [VIDEO_URL] (unlisted). Please contact [EMAIL] and we will respond within one business day.

To see the reference plan: Settings tab, enter Capital (e.g. 1000) and Risk per trade (e.g. 1%), then return to the Signal tab. When a technical condition is met the app shows an entry zone, stop level, targets and suggested size; otherwise it shows "waiting". These are reference calculations, not orders or advice.
```

Ghi chú bổ sung cho reviewer, bản có Pro (tiếng Anh, nối thêm vào đoạn trên):

```
Paid plan (SOLPHA Pro): Google Play subscriptions (monthly and yearly, 7-day free trial for eligible users). Pro features are marked with a "Pro" label inside the app. To test the purchase flow: the reviewer account [REVIEWER_GMAIL] has been added under Play Console > Settings > License testing, so purchases made with it are test purchases (no charge) and renew on an accelerated schedule. If you use a different account, please use promo code [PROMO_CODE] or contact [EMAIL] and we will add the account within one business day. Restore: Settings > "Restore purchase".
```

Cách thử gói Pro bằng license tester (để đội kiểm thử nội bộ làm trước khi gửi duyệt):

1. Play Console > Settings > License testing: thêm các địa chỉ Gmail của người thử, đặt "License response" là RESPOND_NORMALLY.
2. Tải bản có Pro lên track **Internal testing** (hoặc Closed), thêm cùng Gmail vào danh sách tester, mở link opt-in và cài từ Google Play (không cài file APK ngoài vì Billing cần cài từ Play).
3. Đăng ký thử: Play hiện hộp thoại thanh toán nhãn "test card", không trừ tiền. Gói thử có thời gian gia hạn rút ngắn: theo bài đăng của Android Developers (2018), gói 1 tháng gia hạn sau khoảng 5 phút, gói 1 năm khoảng 30 phút, dùng thử khoảng 3 phút, tối đa 6 lần gia hạn rồi tự huỷ [Một phần: nguồn 2018, nên đối chiếu số hiện hành].
4. Thử đủ: mua → trial → chuyển thành trả phí → huỷ → hết hạn → khôi phục; xem Worker ghi đúng trạng thái.
5. Chrome/TWA: Digital Goods API chỉ chạy khi PWA chạy trong TWA, qua HTTPS, và cần Chrome 101+; Bubblewrap bật `features.playBilling` (có tài liệu ghi cần thêm `alphaDependencies.enabled` khi build) rồi build lại AAB [Một phần: từ trang tài liệu Chrome]. Hiện cả hai cờ đang là `false` trong `twa-manifest.json`, nghĩa là **bản 1.0.0 trong repo chưa thể bán Pro**.
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
| `android.permission.INTERNET` | Quyền thường, không cần giải trình | Gọi Binance/Google Fonts |
| `android.permission.POST_NOTIFICATIONS` (Android 13+) | Quyền runtime. Chỉ xin khi người dùng bấm "Bật báo" hoặc "Gửi thông báo thử" (`app.js:863-864`, `app.js:1115`). Không xin ngay khi mở app (`app.js:872` chỉ đọc trạng thái hiện có). Mục đích: thông báo ngay trên máy khi app mở và có điều kiện kỹ thuật do người dùng bật. Muốn ứng dụng có hộp thoại quyền gốc của Android, app phải nhắm API 33+ [Xác nhận]. | `twa-manifest.json`: `enableNotifications: true` (cơ chế uỷ quyền thông báo của TWA). Không có kết nối push (FCM): thông báo tạo cục bộ qua service worker (`app.js:473-476`, `sw.js` `notificationclick`). |
| `android.permission.WAKE_LOCK` | Thường **không** nằm trong manifest của TWA. Tính năng "Giữ màn hình sáng" (`app.js:831`, `navigator.wakeLock`) do Chrome xử lý, bật bởi người dùng trong Cài đặt. | [Chưa xác nhận] cho bản build thực |
| Vị trí, camera, micro, danh bạ, SMS, bộ nhớ, lịch... | **Không xin** | `_headers`: `Permissions-Policy: camera=(), microphone=(), geolocation=()` |
| Quyền nhạy cảm cần form khai báo riêng (SMS/Call log, all files access, ...) | **Không có** | |
| Foreground service, background location, `SCHEDULE_EXACT_ALARM` | **Không có** | Thông báo chỉ khi app mở; không chạy nền chính thức (`terms.html` mục 1 ghi rõ Android có thể tạm dừng app) |

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

1. Điền hết `[TÊN PHÁP NHÂN]`, `[EMAIL]`, `[WEBSITE]` trong `privacy.html`, `terms.html`; trong `LISTING.md` điền `[EMAIL]`, `[WEBSITE]`.
2. `.well-known/assetlinks.json` còn `THAY_BANG_SHA256_CUA_KHOA_KY_TU_PLAY_CONSOLE`: điền đủ dấu vân tay của khoá app signing của Play (và khoá upload nếu cần) rồi mới thử bản cài từ Play.
3. Màn hình đầu tiên của app hiện còn **logo ETEK Power** ở header (`index.html:37`), nằm trong cache (`sw.js:5`) và `icon.svg` có `aria-label` nhắc ETEK. Hồ sơ này yêu cầu SOLPHA độc lập: phải gỡ trước khi chụp ảnh và trước khi gửi duyệt (ngoài phạm vi thư mục `docs/play/`, chưa sửa).
4. Chạy `bundletool` kiểm quyền (mục 8).
5. Với bản Pro: cập nhật mục 1B, `privacy.html`, listing Bản B, bật `playBilling`.

## 11. Nguồn đã tra (13/11/2026)

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

**Điểm chưa xác nhận được tổng hợp:** nguyên văn hiện hành của mọi trang trên (chỉ đọc qua kết quả tìm kiếm); danh sách tuỳ chọn hiện hành của Financial features declaration và có mục nào hợp với "công cụ phân tích" không; danh sách khu vực pháp lý của chính sách sàn/ví; IP gửi tới bên thứ ba có phải khai trong Data safety không; Cloudflare = "nhà cung cấp dịch vụ" có miễn khai "chia sẻ" không; câu hỏi IARC về tiền mã hoá; vị trí khai báo cờ bạc; quyền thực tế trong AAB; mức phí và điều kiện thanh toán thay thế 2026; hạn mức promo code cho gói đăng ký.
