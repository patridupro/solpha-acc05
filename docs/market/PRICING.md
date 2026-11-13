# SOLPHA Futures Desk — Đề xuất giá, phí nền tảng, kịch bản doanh thu thận trọng

Ngày: **13/11/2026** (đơn vị USD trừ khi ghi khác). Tất cả là **đề xuất để thử thị trường**, không phải dự báo. Nguồn giá và phí nằm ở `PLATFORMS.md` (mục 6) và cuối file này. Con số phí chưa đọc từ trang gốc được đánh dấu "chưa xác nhận".

---

## 1. Căn cứ: giá các sản phẩm tương tự (tra 13/11/2026, qua tìm kiếm)

| Nhóm | Ví dụ tra được | Giá |
|---|---|---|
| Mã nguồn bot/dashboard crypto trên Gumroad | Bot tín hiệu Python (gói Standard, 3 tháng hỗ trợ, 1 người dùng) | niêm yết 248, hiện 19 (hiển thị 248 → 19, có khuyến mãi sâu) |
| | Bot giao dịch có dashboard thời gian thực (Python + Next.js), "bán xong không hoàn" | £249 |
| | Bot copy-trading Polymarket, mã nguồn đầy đủ | 79–99 |
| | Bot Telegram dựa trên Freqtrade | 79 |
| | Gói Pine Script, không hoàn tiền | 97 |
| Template dashboard crypto tĩnh (HTML) | BitCrypto 77 trang (Dashboardpack): Personal / Developer | 69 / 149 |
| | Nova (HTML/CSS/JS thuần, WrapMarket) | 14 (đang khuyến mãi) |
| | Cryptoin (ThemeForest) | 12 |
| CodeCanyon, ứng dụng giao dịch có backend | "Mobile trading platform" (một item) | 39 |
| | Script sàn crypto (Laravel) | 250 (410 lượt bán) / 890 (16 lượt bán) |
| Tham chiếu tỷ lệ Extended/Regular | Dashboardpack Personal→Developer ≈ 2,2 lần; ví dụ Sngine 199→299 ≈ 1,5 lần; Envato: bài diễn đàn nêu nhiều hạng mục 5–7 lần (tuỳ item) | — |

Nhận xét: giá thấp (12–49) là template giao diện thuần; giá trung (69–149) là kit có logic; giá cao (250+) là hệ thống có backend, có khách. SOLPHA ở giữa: có logic tín hiệu và backtest, có Worker xác minh thanh toán, **nhưng chưa có chứng minh hiệu quả, chưa có khách, tài liệu tiếng Việt, giao diện tiếng Việt**. Do đó giá nên nằm ở vùng 69–149 cho Single và ~2–3 lần cho Extended; **không** định giá theo "nó giúp bạn kiếm bao nhiêu".

---

## 2. Bảng giá đề xuất

| Gói | Bao gồm | Không hỗ trợ | + Hỗ trợ 6 tháng |
|---|---|---|---|
| **Single — Chỉ app** | Mã nguồn PWA, test, tài liệu triển khai web. 1 sản phẩm cuối (1 thương hiệu, 1 tên miền). | **79** | **119** |
| **Single — App + bộ Android & Billing** | Như trên + cấu hình TWA, ảnh/bản nháp Google Play, **Cloudflare Worker xác minh Play Billing** + `billing.js` + tài liệu. 1 app Play. | **129** | **169** |
| **Extended — Trọn bộ** | Mọi thứ ở trên; nhiều sản phẩm/thương hiệu; làm cho khách hàng (agency), bàn giao bản đã triển khai. **Không** được bán lại mã nguồn. | **299** | **399** |

- **Hỗ trợ 6 tháng** = email trả lời trong 2 ngày làm việc cho câu hỏi cài đặt và lỗi trong mã đã bán, kèm các bản vá 1.0.x. **Không** gồm tư vấn giao dịch, tinh chỉnh chiến lược, hay triển khai hộ. Cập nhật lớn (2.x) tính riêng hoặc giảm giá cho khách cũ.
- **Triển khai hộ (dịch vụ riêng, tuỳ chọn):** 99–149 cho một buổi cài đặt từ xa (2 giờ: hosting, tên miền, Worker, TWA). Đây là dịch vụ, không phải một phần của mã nguồn; cần báo trước nếu đăng trên nền tảng có quy định riêng về dịch vụ.
- **Giá ra mắt:** giảm 25% trong 30 ngày đầu (Single app 59, Single+kit 97, Extended 224), hiển thị công khai ngày kết thúc; sau đó trở lại giá niêm yết. Đừng niêm yết giá "gốc" ảo cao hơn thực tế.
- **Trên CodeCanyon (nếu được nhận):** Regular **59** (hỗ trợ 6 tháng là mặc định của Envato; mức hiện hành chưa xác nhận), Extended **249**, vì Envato giữ 50%.
- **Lý do tách "kit Android & Billing":** người chỉ cần web không phải trả cho phần Worker; người làm app Play thấy rõ phần giá trị thêm. Không tách thì phải chọn một mức giá chung và sẽ bị mua rẻ hoặc bị chê đắt.
- **Không bán đăng ký (SaaS) cho chính mã nguồn này** như một dịch vụ do bạn vận hành cùng lúc: sẽ trở thành "dịch vụ phân tích/tín hiệu", gặp chính các chính sách cấm ở nền tảng thanh toán (xem `PLATFORMS.md`). Nếu muốn, tách riêng thành sản phẩm khác sau khi có tư vấn pháp lý.

### Điều khoản giấy phép nên có trong file `LICENSE` (luật sư rà trước khi dùng)

1. **Single:** một người/pháp nhân mua, một sản phẩm cuối. Được chỉnh sửa; được cho người dùng của sản phẩm đó trả phí. Cấm: chia sẻ, bán lại, cho thuê, đăng lên kho mã công khai, hoặc dùng mã/mẫu để làm sản phẩm thứ hai.
2. **Extended:** nhiều sản phẩm của người mua và sản phẩm làm cho khách; được bàn giao bản đã triển khai (không bàn giao kho mã nguồn gốc dưới dạng chợ code). Vẫn cấm bán lại mã như một sản phẩm mã nguồn/ template.
3. **Mọi gói:** không có bảo hành về lợi nhuận hay phù hợp mục đích; "nguyên trạng"; người mua tự chịu trách nhiệm tuân thủ pháp luật, điều khoản Binance/Google và thuế; người bán không chịu trách nhiệm về thiệt hại giao dịch.
4. **Nhãn hiệu:** quyền dùng tên và logo SOLPHA chỉ cho sản phẩm cuối; không có quyền dùng nhãn hiệu của bên thứ ba có trong mã.
5. Giấy phép gắn với người mua, không chuyển nhượng nếu không được người bán đồng ý bằng văn bản.

---

## 3. Phí nền tảng và phí nhận tiền: mỗi 100 USD thực nhận bao nhiêu

Giả định minh hoạ (có thể sai, hãy thay bằng số thật):
- **Gumroad:** 10% + 0,50 USD/đơn (bán qua link của bạn) [BT3]; chi trả qua PayPal tốn thêm ~2% [BT3]; chưa tính khả năng Gumroad tính riêng phí xử lý thẻ (nguồn không thống nhất).
- **Payhip Free:** 5%; thanh toán PayPal vào tài khoản PayPal tại VN ~4,40% + phí cố định (giả định 0,30 USD; con số cố định **chưa xác nhận**) [BT3].
- **CodeCanyon:** 50% phí tác giả cố định từ 1/7/2026 [BT3]; nếu 35% đơn là của người mua Mỹ và VN không có hiệp ước thuế, khấu trừ tới 30% phần thu nhập của các đơn đó, tức khoảng 10,5% thu nhập trung bình (**chưa xác nhận hiệp ước Việt Nam–Mỹ và tỷ lệ hiện hành**) [CT, tài liệu cũ].
- **Rút về VND:** mỗi lần rút phí cố định 60.000 đ (~2,35 USD theo 25.500 đ/USD) + chênh lệch tỷ giá ~3,5% (PayPal VN theo [BT3]); Payoneer có thể rẻ hơn hoặc đắt hơn tuỳ thời điểm, **chưa xác nhận**.
- Chưa trừ: hoàn tiền, chargeback, thuế thu nhập/GTGT ở VN.

Thực nhận trên từng gói (trước phí rút về VND và trước thuế VN):

| Gói | Giá | Gumroad (thực nhận / %) | Payhip Free qua PayPal VN (thực nhận / %) | CodeCanyon (giá riêng) |
|---|---|---|---|---|
| Single — Chỉ app | 79 | 69,2 / 87,6% | 71,3 / 90,2% | Regular 59 → 29,5 (26,4 nếu bị khấu trừ Mỹ) |
| Single — Chỉ app + hỗ trợ | 119 | 104,5 / 87,8% | 107,5 / 90,3% | — |
| Single + kit | 129 | 113,3 / 87,8% | 116,6 / 90,4% | — |
| Single + kit + hỗ trợ | 169 | 148,6 / 87,9% | 152,8 / 90,4% | — |
| Extended | 299 | 263,2 / 88,0% | 270,6 / 90,5% | Extended 249 → 124,5 (111,4 nếu khấu trừ) |
| Extended + hỗ trợ | 399 | 351,4 / 88,1% | 361,2 / 90,5% | — |

Payhip trông rẻ hơn nhưng **không phải MoR**: bạn chịu chargeback và thuế bán hàng ngoài phạm vi Payhip xử lý. Gumroad đắt hơn ~2,5 điểm nhưng gánh phần đó. Với số lượng đơn thấp, chênh lệch tuyệt đối nhỏ (vài chục USD); chọn theo rủi ro bị đóng tài khoản chứ không phải theo phần trăm.

---

## 4. Kịch bản doanh thu thận trọng (6 tháng đầu)

Giả định chung:
- Người bán mới, **chưa có tệp khán giả**, sản phẩm ngách (giao diện tiếng Việt, mã nguồn crypto, bị hạn chế quảng cáo ở nhiều kênh). Không dựa vào "viral".
- Tỷ lệ gói bán ra: 55% Single app, 25% Single + kit, 20% Extended; 35% mua thêm hỗ trợ. Giá trung bình mỗi đơn **~153,7 USD** (theo bảng giá ở mục 2, giá niêm yết, không tính khuyến mãi ra mắt).
- Kênh chính Gumroad; số liệu Payhip gần tương đương nên chỉ ghi một cột. CodeCanyon tính riêng với giá Regular 59 / Extended 249, 85%/15%, giá trung bình ~87,5.
- Hoàn tiền/chargeback **chưa trừ**; dự phòng 5% cho khoản này là hợp lý nhưng là giả định.
- Rút tiền 1 lần/tháng. Thuế VN **chưa trừ** (xem `SELLER-CHECKLIST.md`).

| Kịch bản | Số đơn trong 6 tháng | Doanh thu gộp | Thực nhận sau phí nền tảng + rút về VND (Gumroad) | Thực nhận (CodeCanyon, giả định được nhận) |
|---|---|---|---|---|
| **Bi quan** | 4 | ~615 | ~507 | ~137 |
| **Cơ sở** | 15 | ~2.305 | ~1.941 | ~553 |
| **Khả quan** | 40 | ~6.148 | ~5.200 | ~1.497 |

Cách đọc: **kịch bản cơ sở là khoảng 2.000 USD gộp trong nửa năm, tức khoảng 320 USD/tháng**, và đó đã là giả định lạc quan hơn nhiều người bán đầu tiên. Kịch bản bi quan (dưới một đơn/tháng) hoàn toàn có thể xảy ra nếu không tạo được nhu cầu. Chi phí cần so: thời gian hỗ trợ (ước 1–3 giờ/đơn đầu), tên miền demo, thuế, và công làm nội dung. Không dùng các con số này để tạo kỳ vọng với ai khác và đừng đưa lên trang bán.

Điểm hoà vốn (rất thô): nếu mất 40 giờ chuẩn bị và tính công 10 USD/giờ, cần ~3 đơn trung bình để bù 400 USD công; nếu thêm 50 USD chi phí demo/domain cho 6 tháng, cần ~4 đơn.

Các biến số nhạy nhất: (1) bị nền tảng từ chối/khoá (loại bỏ toàn bộ doanh thu kênh đó); (2) tỷ lệ hoàn tiền vì "không có lãi" hoặc vì tài liệu tiếng Việt; (3) thay đổi endpoint Binance làm app hỏng và tăng hỗ trợ; (4) thuế.

---

## 5. Quy tắc cập nhật giá

- Sau 30 ngày nếu **0 đơn** và có ≥ 200 lượt xem trang: kiểm tra trang bán (ảnh, video, tiêu đề) trước, giảm giá sau cùng; thử giá Single app 59.
- Nếu đơn đến đều và hỏi nhiều về Android: nâng giá "Single + kit" lên 149 hoặc bán kit riêng.
- Mỗi lần có bản lớn (cấu trúc mới, giao diện đa ngôn ngữ), cho khách cũ giảm 40–50% để nâng cấp, không bắt mua lại.
- Giữ giá giống nhau trên mọi kênh (chênh phí nền tảng không phải lý do để bán rẻ hơn ở kênh khác).
- Không bán giá "lifetime + mọi bản cập nhật vĩnh viễn" trừ khi sẵn sàng bảo trì lâu dài: Binance đã đổi endpoint một lần trong 2026.

---

## 6. Nguồn tham chiếu giá (tra 13/11/2026)

- Gumroad bot/dashboard: [Raidex](https://thegurucoder.gumroad.com/l/raidex) · [bot tín hiệu Python](https://6477198978723.gumroad.com/l/crypto-bot-python) · [Polymarket bot](https://mustafaramx.gumroad.com/l/PolymarketCopyTradingSmartBot) · [Telegram/Freqtrade](https://neobot.gumroad.com/l/dwkhpo)
- Template dashboard: [BitCrypto – Dashboardpack](https://dashboardpack.com/theme-details/cryptocurrency-dashboard/) · [Nova – WrapMarket](https://wrapmarket.com/item/nova-fintech-crypto-admin-dashboard-template-W5G8MT5L6)
- CodeCanyon: [tìm "mobile trading platform"](https://codecanyon.net/search/mobile%20trading%20platform) · [tìm "crypto exchange"](https://codecanyon.net/search/crypto%20exchange) · [Vinance Digital Trading Platform](https://codecanyon.net/item/vinance-digital-trading-platform/48035306) · [License FAQ](https://codecanyon.net/licenses/faq)
- Tỷ lệ Extended/Regular: [Sngine đổi giá](https://blog.sngine.com/envato-changes-sngine-price) · [diễn đàn Envato](https://forums.envato.com/t/regular-or-extended-which-makes-more-sense-for-me/445712)
- Phí: xem `PLATFORMS.md` mục 6 (Gumroad, Payhip, Envato, PayPal Việt Nam, Payoneer).

Lưu ý: giá Gumroad "248 → 19" của bot tín hiệu cho thấy nhiều người bán đang đặt giá niêm yết cao rồi giảm mạnh. Đừng sao chép: hiển thị giá gốc giả có thể bị coi là quảng cáo gây hiểu nhầm.
