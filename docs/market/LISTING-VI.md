# SOLPHA Futures Desk — Nội dung listing (tiếng Việt, sẵn dán)

Phiên bản 1.0.0 · soạn 13/11/2026 · sửa 14/11/2026 sau kiểm toán tuân thủ (backtest = khoảng 5 ngày, tối ưu = 30 ngày; Cài đặt chỉ có công tắc bật/tắt; câu chữ về Android và billing). Dùng cho trang bán ở Việt Nam (website riêng, nhóm cộng đồng nhà phát triển, Payhip/Gumroad bản tiếng Việt). Thay mọi `[PLACEHOLDER]` trước khi đăng. **Không xoá các cảnh báo** để "tăng chuyển đổi". Trước khi đăng: chạy lại test Worker (`node --test worker/test`) và sửa con số "39 test" nếu khác (kiểm toán chưa chạy lại).

Nguyên tắc của bản này (đừng phá khi chỉnh sửa):
- Không hứa hoặc ám chỉ lợi nhuận, tỷ lệ thắng, "chính xác". Không đăng ảnh lãi/lỗ.
- Đây là **mã nguồn của một công cụ**, không phải dịch vụ tín hiệu, không phải tư vấn đầu tư.
- Nói rõ cái gì không có trong gói và người mua phải tự làm gì.
- "Binance" chỉ xuất hiện như tên nguồn dữ liệu công khai; không dùng logo/tên làm thương hiệu sản phẩm; không liên kết với Binance.

---

## 1. Tiêu đề (≤ 70 ký tự)

Đề xuất (kèm số ký tự):

```
SOLPHA Futures Desk – Mã nguồn PWA phân tích futures crypto
```

Phương án khác: `SOLPHA Futures Desk | PWA futures đa khung, mã nguồn` · `SOLPHA Futures Desk – Source code PWA + Worker Play Billing`

## 2. Mô tả ngắn

```
Mã nguồn PWA cài như app: giá futures realtime, chỉ báo đa khung, quy tắc nến, kế hoạch khối lượng, backtest và nhật ký kỷ luật. Tự triển khai. Không phải tư vấn đầu tư.
```

Bản cực ngắn:

```
PWA phân tích futures tự lưu trữ (HTML/CSS/JS thuần, không build). Mã nguồn. Không phải tư vấn.
```

## 3. Mô tả dài

```
SOLPHA Futures Desk — mã nguồn

SOLPHA Futures Desk là một ứng dụng web tiến bộ (PWA) tĩnh, cài được như app, viết bằng HTML, CSS và JavaScript thuần: không framework, không bước build, không bắt buộc có backend. App theo dõi hợp đồng tương lai vĩnh cửu USDT-M trên Binance và hiển thị giá, chỉ báo, các điều kiện nến theo quy tắc cố định và công cụ tính rủi ro trong giao diện tối mang thương hiệu SOLPHA.

Bạn nhận toàn bộ mã nguồn đọc được, tự đặt lên hosting của mình, chỉnh sửa theo giấy phép bạn mua.

ĐỌC TRƯỚC KHI MUA
- Đây là MÃ NGUỒN PHẦN MỀM. Không phải tư vấn đầu tư, không phải dịch vụ tín hiệu, không phải bot giao dịch. App không đặt lệnh và không yêu cầu API key sàn.
- Không có bất kỳ cam kết hay ám chỉ nào về lợi nhuận, tỷ lệ thắng hay hiệu quả. Giao dịch futures rủi ro cao, bạn có thể mất toàn bộ vốn. Backtest (khoảng 5 ngày) và công cụ tối ưu (30 ngày) trong app là mô phỏng nhỏ, đơn giản trên dữ liệu công khai gần đây, không chứng minh kết quả tương lai.
- Các "tín hiệu" hiển thị là kết quả của quy tắc cố định, có tài liệu, áp lên dữ liệu giá công khai. Không đảm bảo đúng, và gói này không kèm tín hiệu nào.
- Bạn phải tự triển khai và cấu hình. Cần kiến thức hosting web cơ bản; phần Android/Play Billing cần nhiều hơn.
- Giao diện và phần lớn tài liệu bằng tiếng Việt.

TÍNH NĂNG

Dữ liệu thị trường
- Giá và nến realtime qua WebSocket công khai của Binance Futures (định dạng đường dẫn /market bắt buộc từ 23/04/2026), giá mark và funding mỗi giây, tự quay về hỏi giá định kỳ (REST) khi rớt kết nối và tự nối lại.
- Tab SOL, BTC, ETH, DOGE; thêm bất kỳ cặp USDT nào có trên Binance Futures (tối đa 8). Số lẻ theo bước giá của sàn.

Chỉ báo và đa khung
- EMA 9/21, Bollinger Bands, RSI, ATR, MACD trên 5M, 15M, 1H, 4H, 1D.
- Pha xu hướng từng khung, đánh giá "đồng pha" nhiều khung và phát hiện chạm dải Bollinger.

Bộ máy quy tắc nến (signals.js, dùng chung cho quét trực tiếp và backtest)
- Long A (hồi về trung bình) và B (bứt phá sau nén); Short S1/S2/S3; chế độ Short điều chỉnh khi ngược khung 1D; chế độ Momentum 4H/1H.
- Từng quy tắc bật/tắt riêng cho từng cặp trong Cài đặt; các ngưỡng số là tham số trong signals.js (DEFAULTS), bạn sửa bằng cách chỉnh mã nguồn. App tự quét khi mỗi nến 5 phút đóng, cho tất cả các cặp.

Kế hoạch vào lệnh
- Chia 3 phần giá vào, stop-loss, TP1/TP2 và khối lượng theo vốn và % rủi ro bạn nhập. Bỏ qua khi rủi ro vượt giới hạn ATR cài sẵn (tham số trong signals.js).

Backtest, Tối ưu 30 ngày, Soi lại
- Backtest từng bộ điều kiện trên khoảng 1.500 nến 5M thật (khoảng 5 ngày), tách Long/Short và từng setup, kèm lý do bị loại nhiều nhất.
- Tối ưu 30 ngày: tải 30 ngày dữ liệu công khai ngay trên trình duyệt, đo từng điều kiện sau phí và trượt giá, cho xem nửa đầu và nửa sau để kiểm tra độ ổn định, rồi cho bạn chỉ bật lại các điều kiện đủ ngưỡng cài sẵn (số lệnh mô phỏng tối thiểu, tỷ lệ lệnh có lãi tối thiểu, R trung bình dương; các giá trị là hằng số trong mã nguồn, bạn sửa được).
- Soi lại: liệt kê từng nến 5M quanh thời điểm bạn chọn cùng quyết định và lý do.
- Tất cả chạy cục bộ. Mẫu nhỏ, giả định đơn giản: dùng để hiểu quy tắc, không phải bằng chứng hiệu quả.

Nhật ký giao dịch có checklist tự đánh giá
- Checklist tự đánh giá hằng ngày với các tiêu chí có trọng số, xếp hạng A–D (điểm do bạn tự chấm, không phải thước đo hiệu quả), tổng kết tháng, chuỗi dài nhất, xuất CSV, sao lưu/khôi phục JSON. Dữ liệu lưu cục bộ trên thiết bị.

Thông báo
- Thông báo cục bộ qua service worker, nút gửi thông báo thử, quét bù 90 phút khi mở lại app, tuỳ chọn giữ màn hình sáng. Thông báo tạo ngay trên thiết bị; không có máy chủ đẩy thông báo.

PWA và Android
- Manifest, service worker có offline fallback, nút cài app, icon maskable.
- Cấu hình đóng gói Android (Trusted Web Activity, twa-manifest.json, dùng với Bubblewrap hoặc PWABuilder), ảnh đồ hoạ cho Google Play, bản nháp listing và bản nháp trả lời câu hỏi chính sách. Không kèm bản build đã ký: bạn tự build, ký, điền dấu vân tay Digital Asset Links và gửi duyệt.

Backend Google Play Billing (tuỳ chọn, cho gói đăng ký)
- Cloudflare Worker xác minh giao dịch đăng ký Google Play qua Google Play Developer API, acknowledge giao dịch, lưu quyền lợi trong Workers KV, nhận Real-time Developer Notifications (Pub/Sub). Không phụ thuộc npm. Có 39 test tự động.
- Thư viện client billing.js cho luồng Digital Goods API / Payment Request trong TWA.
- CHƯA nối vào giao diện: backend và thư viện Play Billing có kèm theo, nhưng billing.js không được index.html nạp, Worker chưa triển khai (API_BASE là chỗ trống) và các màn hình trong app chưa có màn hình mua gói hay khoá tính năng. Đã có tài liệu; bạn tự tích hợp vào màn hình mua gói của mình.

Kiểm thử
- node tests/signals.test.js kiểm tra bộ máy quy tắc; Worker có bộ test riêng (39 test).

YÊU CẦU
- Hosting tĩnh có HTTPS (Cloudflare Pages, Netlify, GitHub Pages hoặc máy chủ web bất kỳ). Chạy app không cần công cụ build.
- Trình duyệt hiện đại; cài như app tốt nhất trên Chrome (Android và máy tính).
- Node.js 18+ chỉ cần nếu muốn chạy test hoặc tạo lại icon.
- Cho Android: tài khoản Google Play Developer (phí đăng ký và yêu cầu thử nghiệm của Google áp dụng và có thể thay đổi), cộng Bubblewrap hoặc PWABuilder.
- Cho gói đăng ký: dự án Google Cloud có service account, sản phẩm đăng ký trong Play Console, tài khoản Cloudflare (gói miễn phí đủ cho quy mô nhỏ).
- Phông Roboto được đóng gói sẵn trong gói (tự lưu trữ), app không gọi Google Fonts. Truy cập được endpoint công khai của Binance. Người dùng ở vùng Binance chặn sẽ không nhận được dữ liệu. IP người dùng hiển thị với Binance như mọi trang web gọi API công khai.
- Bạn tự chịu trách nhiệm kiểm tra điều khoản hiện hành của Binance về việc dùng dữ liệu thị trường công khai cho mục đích của mình, cũng như quy định pháp luật và thuế ở nước bạn.

TRONG GÓI CÓ GÌ
- Toàn bộ mã nguồn app: index.html, app.js, signals.js, journal.js, billing.js, brand.js, styles.css, solpha-theme.css, service worker, manifest, icon, mẫu trang quyền riêng tư và điều khoản (tiếng Việt, có tóm tắt quyền riêng tư bằng tiếng Anh).
- worker/ — mã Worker, wrangler.toml, test và README.
- Cấu hình Android/TWA, ảnh cho Google Play, bản nháp listing và trả lời chính sách.
- Tài liệu (tiếng Việt): README mô tả quy tắc, hướng dẫn triển khai PWA, hướng dẫn lên Google Play và thu phí, hướng dẫn triển khai Worker.
- Test cho bộ máy quy tắc và Worker.
- Giấy phép: Single hoặc Extended (xem dưới).

KHÔNG CÓ TRONG GÓI
- Không kèm hosting, tên miền, tài khoản Google Play hay tài khoản sàn.
- Không kèm tín hiệu giao dịch, số liệu hiệu quả, "lợi thế chiến lược" hay bất kỳ bảo đảm nào.
- Không đặt lệnh, không xử lý API key sàn.
- Không có cảnh báo 24/7 từ máy chủ: app chỉ quét khi đang chạy; Android có thể đóng băng web app khi tắt màn hình. Máy chủ quét giá và đẩy thông báo (Telegram/Web Push) không có.
- Không có màn hình mua gói và khoá tính năng hoàn chỉnh, thư viện billing chưa nối vào giao diện (xem trên).
- Không có bản dịch giao diện; giao diện tiếng Việt.
- Không có văn bản pháp lý riêng cho bạn. Trang quyền riêng tư và điều khoản là mẫu có chỗ trống; bạn phải điền và nhờ người có chuyên môn rà soát.

GIẤY PHÉP (tóm tắt; toàn văn trong file LICENSE của gói tải)
- Single: một người mua, một sản phẩm cuối (một thương hiệu, một tên miền, một app Google Play). Được sửa mã và thu phí người dùng của chính sản phẩm đó. Không được chia sẻ, bán lại, đăng công khai mã nguồn hay dùng cho sản phẩm thứ hai.
- Extended: nhiều sản phẩm/thương hiệu và làm cho khách hàng (ví dụ agency); được bàn giao bản đã triển khai cho khách. Vẫn KHÔNG được bán lại hay phát tán mã nguồn như một sản phẩm mã nguồn, template hay hàng trên chợ cạnh tranh.
- Gói hỗ trợ và cập nhật ghi trên trang mua. Hỗ trợ gồm câu hỏi cài đặt và lỗi trong mã cung cấp; KHÔNG gồm tư vấn giao dịch, chỉnh chiến lược hay câu hỏi về lợi nhuận.

KHÔNG LIÊN KẾT
SOLPHA Futures Desk là sản phẩm độc lập, không liên kết, không được tài trợ hay xác nhận bởi Binance hoặc Google. Binance và Google Play là nhãn hiệu của chủ sở hữu, chỉ được nêu để mô tả nguồn dữ liệu và khả năng tương thích.

CẢNH BÁO RỦI RO
Giao dịch futures tiền mã hoá có mức rủi ro cao, kể cả mất toàn bộ vốn. Không nội dung nào trong sản phẩm này là tư vấn tài chính, đầu tư hay pháp lý. Kết quả quá khứ hoặc mô phỏng không cho biết kết quả tương lai. Chỉ dùng số tiền bạn chấp nhận mất và tự quyết định.
```

## 4. Từ khoá / tag

```
pwa, javascript, mã nguồn, crypto, futures, phân tích kỹ thuật, nhật ký giao dịch, backtest, cloudflare workers, google play billing
```

Không dùng tag: "tín hiệu", "lợi nhuận", "thu nhập thụ động", "tốt nhất", "bot", "chính xác 100%".

## 5. Hỏi đáp thường gặp (8 câu)

```
1. Đây có phải dịch vụ tín hiệu hay bot giao dịch không?
Không. Đây là mã nguồn của một bảng phân tích. App hiển thị chỉ báo và áp quy tắc cố định, có tài liệu, lên dữ liệu giá công khai. App không đặt lệnh, không kết nối tài khoản sàn và không xin API key. Không bán hay bảo đảm tín hiệu nào.

2. Dùng nó có lời không?
Không có cam kết nào, và không thể có. Giao dịch futures rủi ro cao, bạn có thể mất toàn bộ vốn. Backtest (khoảng 5 ngày) và công cụ tối ưu 30 ngày chỉ là mô phỏng nhỏ, đơn giản, không chứng minh kết quả tương lai. Hãy mua vì mã nguồn và giá trị làm công cụ/học tập, không vì kỳ vọng lợi nhuận.

3. Có cần máy chủ hay backend không?
App thì không: đó là site tĩnh. Chỉ cần backend (Cloudflare Worker đi kèm) khi bạn muốn bán gói đăng ký qua Google Play Billing. Worker chạy được trên gói miễn phí của Cloudflare ở quy mô nhỏ.

4. Cần gì để đưa lên Google Play?
Tài khoản Google Play Developer (phí và quy định thử nghiệm hiện hành của Google áp dụng), cấu hình TWA có sẵn, Bubblewrap hoặc PWABuilder để đóng gói, và nếu bán gói đăng ký thì thêm Worker cùng sản phẩm trong Play Console. Có hướng dẫn từng bước bằng tiếng Việt. Bạn tự khai báo tính năng tài chính và biểu mẫu quyền riêng tư với Google, và listing của bạn phải tuân thủ chính sách Google Play.

5. Ngôn ngữ của app và tài liệu là gì?
Giao diện và phần lớn tài liệu bằng tiếng Việt; chú thích trong mã chủ yếu tiếng Việt, tên biến và tên file bằng tiếng Anh. Đổi ngôn ngữ giao diện nghĩa là sửa chuỗi trong mã nguồn.

6. Có dùng với sàn khác ngoài Binance không? Có giao dịch ngay trong app không?
App chỉ đọc dữ liệu công khai Binance USDT-M futures. Sàn khác cần sửa mã. App không có chức năng giao dịch.

7. Những giới hạn nào tôi cần biết?
Cảnh báo chỉ hoạt động khi app đang chạy và Android có thể tạm dừng khi tắt màn hình; máy chủ cảnh báo 24/7 không có sẵn. Dữ liệu có thể không dùng được ở vùng Binance chặn. Binance có thể đổi endpoint (đã đổi vào 04/2026) nên lớp dữ liệu có thể cần bảo trì. Bạn phải tự kiểm tra điều khoản hiện hành của Binance cho mục đích sử dụng của mình.

8. Single khác Extended thế nào; hoàn tiền và cập nhật ra sao?
Single: một sản phẩm cuối (một thương hiệu, một tên miền, một app Play). Extended: nhiều sản phẩm/thương hiệu và làm cho khách. Cả hai đều không cho bán lại hay phát tán mã nguồn. Vì là hàng tải về, hoàn tiền theo chính sách ghi trên trang mua: [CHÍNH SÁCH HOÀN TIỀN — ví dụ: hoàn tiền trong 14 ngày chỉ khi file tải lỗi hoặc khác đáng kể so với mô tả và bạn chưa triển khai]. Thời gian hỗ trợ và cập nhật tuỳ gói bạn mua, ghi trên trang mua.
```

## 6. Nhật ký thay đổi

```
v1.0.0 (13/11/2026) — bản mã nguồn công khai đầu tiên
- Bàn futures đa cặp (SOL, BTC, ETH, DOGE + cặp tuỳ ý, tối đa 8), dữ liệu WebSocket realtime (định dạng /market mới) và dự phòng REST.
- Chỉ báo EMA/BB/RSI/ATR/MACD trên 5M, 15M, 1H, 4H, 1D.
- Bộ quy tắc nến: Long A/B, Short S1/S2/S3, Short điều chỉnh, Momentum 4H/1H; cài đặt riêng từng cặp.
- Kế hoạch vào lệnh (3 phần, SL, TP1/TP2, khối lượng theo rủi ro).
- Backtest (khoảng 5 ngày), Tối ưu 30 ngày (trừ phí và trượt giá ước tính), Soi lại.
- Nhật ký giao dịch có checklist tự đánh giá có trọng số, tổng kết tháng, xuất CSV/JSON.
- Thông báo cục bộ, quét bù, cài như PWA.
- Cấu hình đóng gói Android TWA (bạn tự build và ký), ảnh Google Play, bản nháp listing và chính sách.
- Cloudflare Worker xác minh gói đăng ký Google Play (acknowledge, quyền lợi trong KV, RTDN) và thư viện billing.js, có kèm nhưng chưa nối vào giao diện; 39 test tự động (chạy lại trước khi đăng).
- Giao diện tối thương hiệu SOLPHA (tiếng Việt).

Giới hạn đã biết ở 1.0.0: chưa có cảnh báo từ máy chủ; thư viện billing và Worker chưa nối vào giao diện (chưa có màn hình mua gói); không kèm bản Android đã ký; giao diện chỉ tiếng Việt.
```

## 7. Biến thể giá (khớp PRICING.md)

| Tên biến thể | Ghi chú ngắn ở trang mua |
|---|---|
| Single — Chỉ app | Mã nguồn PWA + tài liệu. Một sản phẩm cuối. |
| Single — App + bộ Android & Billing | Thêm cấu hình TWA, ảnh/bản nháp Play, Cloudflare Worker + billing.js. Một sản phẩm cuối. |
| Extended — Trọn bộ | Mọi thứ; nhiều sản phẩm/thương hiệu, được làm cho khách. |
| Thêm hỗ trợ 6 tháng | Hỗ trợ qua email cho câu hỏi cài đặt và lỗi trong mã cung cấp. Không hỗ trợ giao dịch. |

## 8. Ghi chú ảnh và video

- Ảnh đầu: ảnh chụp thật của app (giao diện tối), chỉ kèm tên sản phẩm. Không số lãi/lỗ, không logo sàn.
- Nên có: tab các cặp, bảng chỉ báo, kế hoạch tham khảo (vốn mẫu ghi rõ), công cụ mô phỏng ở trạng thái chưa chạy, form nhật ký. Không đưa bảng kết quả backtest/tối ưu (cột % lệnh có lãi, cột đủ ngưỡng) và điểm nhật ký vào ảnh.
- Chữ chèn được phép: "Mã nguồn", "Tự lưu trữ", "PWA", "Bộ Android TWA", "Cloudflare Worker". Không dùng: "lợi nhuận", "tỷ lệ thắng", "chính xác", "tín hiệu".
- Chú thích dưới ảnh: "Ảnh chụp dùng dữ liệu mẫu. Không phải tư vấn đầu tư."
