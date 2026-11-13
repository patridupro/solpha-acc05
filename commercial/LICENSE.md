# SOLPHA Futures Desk — Giấy phép thương mại / Commercial License

> **MẪU — CẦN LUẬT SƯ SOÁT TRƯỚC KHI DÙNG.** Đây là bản mẫu để người bán chỉnh sửa. Nó không phải tư vấn pháp lý và có thể chưa phù hợp với luật nơi bạn hoạt động. Thay mọi chỗ `{{...}}`, chọn mức phí/điều kiện thực tế và nhờ luật sư soát (hợp đồng, sở hữu trí tuệ, bảo vệ người tiêu dùng, thuế, giới hạn trách nhiệm).
>
> **TEMPLATE — HAVE A LAWYER REVIEW IT BEFORE USE.** This is a sample for the seller to edit. It is not legal advice and may not fit the law where you operate. Replace every `{{...}}`, set real prices/terms, and have a qualified lawyer review it (contract, intellectual property, consumer protection, tax, limitation of liability).

Phiên bản giấy phép / License version: 1.0 · Áp dụng cho SOLPHA Futures Desk v1.0.0

---

## Phần 1 — Tiếng Việt

### 1. Các bên và đối tượng
- **Bên bán / Người cấp phép:** {{COMPANY_NAME}} ("Bên bán"), liên hệ {{CONTACT_EMAIL}}, website {{WEBSITE}}.
- **Người mua / Người được cấp phép:** cá nhân hoặc tổ chức đã thanh toán và nhận gói này ("Người mua").
- **Sản phẩm:** toàn bộ mã nguồn, tài nguyên đồ hoạ và tài liệu trong gói "SOLPHA Futures Desk" ("Sản phẩm").

Bên bán giữ toàn bộ quyền sở hữu trí tuệ đối với Sản phẩm. Giấy phép này **cấp quyền sử dụng**, không chuyển nhượng quyền sở hữu.

### 2. Hai mức giấy phép
Người mua chọn và thanh toán một trong hai mức. Mức áp dụng được ghi trên hoá đơn/đơn hàng.

| | **Single (Đơn)** | **Extended (Mở rộng)** |
|---|---|---|
| Số sản phẩm/dự án cuối | **1** sản phẩm, **1** tên miền chính (cộng tên miền phụ/staging của chính sản phẩm đó) | Không giới hạn số dự án **của Người mua hoặc khách hàng của Người mua**, mỗi dự án một bản triển khai riêng |
| Đóng gói Android (Google Play) | 1 ứng dụng (1 package ID) | Nhiều ứng dụng/package ID |
| Sửa đổi, đổi thương hiệu | Được | Được |
| Dùng cho khách hàng của Người mua | Chỉ khi chính sản phẩm đó là sản phẩm duy nhất đã đăng ký | Được: làm và bàn giao bản triển khai cho khách hàng, miễn khách hàng không nhận mã nguồn thô để tự phát tán |
| Cập nhật miễn phí | {{SỐ THÁNG}} tháng kể từ ngày mua | {{SỐ THÁNG}} tháng kể từ ngày mua |
| Hỗ trợ | Theo `docs/SUPPORT.md` | Theo `docs/SUPPORT.md` (ưu tiên nếu Bên bán quy định) |
| Phí | {{GIÁ SINGLE}} | {{GIÁ EXTENDED}} |

### 3. Người mua ĐƯỢC PHÉP
1. Cài đặt, chạy, triển khai Sản phẩm trên máy chủ/dịch vụ tĩnh của mình.
2. **Sửa đổi** mã nguồn, giao diện, ngôn ngữ, thông số tín hiệu, danh sách cặp; thay tên, màu, logo, icon.
3. Thu phí người dùng cuối của sản phẩm do Người mua tạo ra từ Sản phẩm (đăng ký, bán lẻ, mua một lần) theo phạm vi mức giấy phép.
4. Giữ một bản sao lưu cho mục đích lưu trữ nội bộ.
5. Đóng gói bản web thành ứng dụng Android/PWA trong phạm vi mức giấy phép.

### 4. Người mua KHÔNG ĐƯỢC
1. **Bán lại, cho thuê, cho mượn, tặng, chia sẻ công khai hoặc phát tán** mã nguồn thô của Sản phẩm (kể cả bản đã sửa nhưng còn phần lớn mã gốc), dưới bất kỳ hình thức nào: tệp nén, kho mã công khai (public repo), diễn đàn, chợ mã nguồn, torrent.
2. **Đóng gói lại thành sản phẩm cạnh tranh giống hệt**: bán mã nguồn hoặc "template" về cơ bản trùng chức năng với Sản phẩm cho những người khác tự triển khai.
3. Vượt quá phạm vi mức giấy phép (ví dụ dùng mức Single cho nhiều dự án/tên miền).
4. Gỡ hoặc sửa thông báo bản quyền và giấy phép trong tệp `LICENSE.md` của gói khi chia sẻ nội bộ.
5. Dùng Sản phẩm vào mục đích vi phạm pháp luật, gian lận, thao túng thị trường, hoặc đánh lừa người dùng về rủi ro/lợi nhuận.
6. Tuyên bố hoặc ngụ ý rằng Bên bán bảo trợ, cấp phép hay liên kết với sản phẩm của Người mua nếu không có thoả thuận bằng văn bản.

### 5. Thành phần bên thứ ba
Sản phẩm gọi API dữ liệu công khai của Binance và (tuỳ chọn) tải phông chữ từ Google Fonts; việc đóng gói Android phụ thuộc Google Play, Bubblewrap/PWABuilder. Các dịch vụ này có điều khoản riêng; không thuộc giấy phép này. Tên và nhãn hiệu của bên thứ ba thuộc chủ sở hữu tương ứng; Sản phẩm không liên kết với họ.

### 6. Miễn trừ rủi ro tài chính — KHÔNG phải tư vấn
Sản phẩm là **công cụ phân tích kỹ thuật tham khảo**. Nó không phải tư vấn đầu tư, tư vấn tài chính, môi giới hay khuyến nghị mua/bán. Giao dịch futures/đòn bẩy có thể mất toàn bộ vốn. Kết quả backtest không đảm bảo kết quả tương lai. Người mua và người dùng cuối tự chịu mọi quyết định giao dịch.

### 7. Trách nhiệm pháp lý và tuân thủ của Người mua
Người mua tự chịu trách nhiệm: (a) xin mọi giấy phép/đăng ký cần thiết tại nơi hoạt động (dịch vụ liên quan chứng khoán, tài sản số, quảng cáo tài chính, bảo vệ dữ liệu, thuế); (b) tuân thủ Điều khoản dịch vụ của Google Play và của Binance, kể cả quy định về nội dung tài chính/tiền mã hoá và dữ liệu thị trường; (c) cung cấp chính sách quyền riêng tư, điều khoản và cảnh báo rủi ro phù hợp cho người dùng cuối (có mẫu trong gói, **cần luật sư soát**); (d) mọi khiếu nại của người dùng cuối đối với sản phẩm do Người mua phát hành.

### 8. Không bảo hành
Sản phẩm được cung cấp **"NGUYÊN TRẠNG" ("AS IS")**, không có bảo hành dưới bất kỳ hình thức nào, rõ ràng hay ngụ ý, gồm nhưng không giới hạn tính thương mại, phù hợp mục đích cụ thể, không vi phạm, độ chính xác của tín hiệu, tính sẵn có của dữ liệu bên thứ ba. Bên bán không bảo đảm Sản phẩm không có lỗi hoặc sẽ luôn tương thích với thay đổi của Binance, trình duyệt hay Google Play.

### 9. Giới hạn trách nhiệm
Trong phạm vi luật cho phép, Bên bán không chịu trách nhiệm đối với thiệt hại gián tiếp, ngẫu nhiên, hệ quả, mất lợi nhuận, mất vốn giao dịch, mất dữ liệu. Tổng trách nhiệm tối đa của Bên bán không vượt quá số tiền Người mua đã trả cho giấy phép. {{LUẬT SƯ: điều chỉnh theo luật áp dụng; một số nơi không cho phép loại trừ/giới hạn này.}}

### 10. Hoàn tiền
Hoàn tiền theo **chính sách của nền tảng bán hàng** nơi Người mua mua gói (ví dụ {{TÊN NỀN TẢNG BÁN}}) và theo quy định bắt buộc của luật bảo vệ người tiêu dùng. Với hàng hoá số đã tải về/đã mở, Bên bán {{CÓ / KHÔNG}} hoàn tiền ngoài các trường hợp luật bắt buộc hoặc lỗi nghiêm trọng không khắc phục được trong thời gian hỗ trợ. Yêu cầu hoàn tiền gửi tới {{CONTACT_EMAIL}} trong {{SỐ NGÀY}} ngày kể từ ngày mua.

### 11. Chấm dứt
Giấy phép chấm dứt tự động nếu Người mua vi phạm mục 4. Khi chấm dứt, Người mua phải ngừng sử dụng và xoá các bản sao mã nguồn chưa triển khai; các bản đã triển khai cho người dùng cuối phải được gỡ trong {{SỐ NGÀY}} ngày. Mục 5–9, 12 vẫn có hiệu lực sau chấm dứt.

### 12. Luật áp dụng và giải quyết tranh chấp
Giấy phép chịu sự điều chỉnh của pháp luật {{QUỐC GIA / VÙNG}}. Tranh chấp được giải quyết tại {{TOÀ ÁN / TRỌNG TÀI}} sau khi các bên thương lượng thiện chí.

### 13. Toàn bộ thoả thuận
Giấy phép này là toàn bộ thoả thuận về Sản phẩm giữa các bên; bản tiếng Việt và tiếng Anh có giá trị như nhau, nếu khác nhau thì ưu tiên bản {{TIẾNG VIỆT / TIẾNG ANH}}.

---

## Part 2 — English

### 1. Parties and subject matter
- **Seller / Licensor:** {{COMPANY_NAME}} ("Seller"), contact {{CONTACT_EMAIL}}, website {{WEBSITE}}.
- **Buyer / Licensee:** the person or entity that has paid for and received this package ("Buyer").
- **Product:** all source code, graphic assets and documentation in the "SOLPHA Futures Desk" package ("Product").

The Seller retains all intellectual property rights in the Product. This license **grants a right to use**; it does not transfer ownership.

### 2. Two license tiers
The Buyer chooses and pays for one tier. The applicable tier is stated on the order or invoice.

| | **Single** | **Extended** |
|---|---|---|
| End products / projects | **1** end product on **1** primary domain (plus sub/staging domains of that same product) | Unlimited projects **of the Buyer or the Buyer's clients**, each a separate deployment |
| Android packaging (Google Play) | 1 app (1 package ID) | Multiple apps / package IDs |
| Modification, rebranding | Allowed | Allowed |
| Use for the Buyer's clients | Only if that client product is the one registered product | Allowed: build and hand over deployments, provided clients do not receive raw source to redistribute |
| Free updates | {{NUMBER OF MONTHS}} months from purchase | {{NUMBER OF MONTHS}} months from purchase |
| Support | Per `docs/SUPPORT.md` | Per `docs/SUPPORT.md` (priority if the Seller specifies) |
| Price | {{SINGLE PRICE}} | {{EXTENDED PRICE}} |

### 3. The Buyer MAY
1. Install, run and deploy the Product on its own servers or static hosting.
2. **Modify** the code, UI, language, signal parameters and pair list; change the name, colours, logo and icons.
3. Charge end users of the product the Buyer builds from the Product (subscriptions, retail sales, one-time purchases) within the scope of the tier.
4. Keep a backup copy for internal archival.
5. Package the web app as an Android app/PWA within the scope of the tier.

### 4. The Buyer MAY NOT
1. **Resell, rent, lend, give away, publicly share or redistribute** the raw source code of the Product (including modified versions that still consist mostly of the original code) in any form: archive files, public repositories, forums, code marketplaces, torrents.
2. **Repackage it as a substantially identical competing product**: selling the source code or a "template" that is essentially the same as the Product for others to deploy themselves.
3. Exceed the scope of the tier (for example, use a Single license for multiple projects or domains).
4. Remove or alter the copyright and license notices in the package's `LICENSE.md` when sharing internally.
5. Use the Product for unlawful purposes, fraud, market manipulation, or to mislead users about risk or returns.
6. State or imply that the Seller endorses, licenses or is affiliated with the Buyer's product without written agreement.

### 5. Third-party components
The Product calls Binance's public market-data API and (optionally) loads fonts from Google Fonts; Android packaging depends on Google Play and Bubblewrap/PWABuilder. Those services have their own terms and are outside this license. Third-party names and trademarks belong to their owners; the Product is not affiliated with them.

### 6. Financial-risk disclaimer — NOT advice
The Product is a **reference technical-analysis tool**. It is not investment advice, financial advice, brokerage or a recommendation to buy or sell. Futures/leveraged trading can lose your entire capital. Backtest results do not guarantee future results. The Buyer and end users alone are responsible for every trading decision.

### 7. Buyer's legal responsibility and compliance
The Buyer is solely responsible for: (a) obtaining all licenses/registrations required where it operates (securities-related services, digital assets, financial promotion, data protection, tax); (b) complying with the Google Play and Binance terms of service, including rules on financial/crypto content and market data; (c) providing suitable privacy policy, terms and risk warnings to end users (templates are included, **have them reviewed by a lawyer**); (d) all claims by end users regarding products the Buyer publishes.

### 8. No warranty
The Product is provided **"AS IS"**, without warranty of any kind, express or implied, including merchantability, fitness for a particular purpose, non-infringement, accuracy of signals, or availability of third-party data. The Seller does not warrant that the Product is error-free or will always remain compatible with changes by Binance, browsers or Google Play.

### 9. Limitation of liability
To the extent permitted by law, the Seller is not liable for indirect, incidental or consequential damages, lost profits, trading losses or data loss. The Seller's total liability is capped at the amount the Buyer paid for the license. {{LAWYER: adjust to governing law; some jurisdictions do not allow these exclusions or limits.}}

### 10. Refunds
Refunds follow the **policy of the sales platform** where the Buyer purchased the package (for example {{SALES PLATFORM}}) and mandatory consumer-protection law. For digital goods already downloaded or opened, the Seller {{DOES / DOES NOT}} refund except where required by law or for a serious defect that cannot be fixed within the support period. Send refund requests to {{CONTACT_EMAIL}} within {{NUMBER OF DAYS}} days of purchase.

### 11. Termination
The license terminates automatically if the Buyer breaches section 4. On termination the Buyer must stop using the Product and delete undeployed copies of the source; deployments serving end users must be taken down within {{NUMBER OF DAYS}} days. Sections 5–9 and 12 survive termination.

### 12. Governing law and disputes
This license is governed by the law of {{COUNTRY / REGION}}. Disputes are resolved before {{COURT / ARBITRATION}} after good-faith negotiation.

### 13. Entire agreement
This license is the entire agreement about the Product between the parties. The Vietnamese and English versions are equally valid; if they differ, the {{VIETNAMESE / ENGLISH}} version prevails.

---

© {{COMPANY_NAME}}. All rights reserved.
