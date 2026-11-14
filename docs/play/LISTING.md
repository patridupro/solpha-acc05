# SOLPHA · Futures Desk — Nội dung Store listing (sẵn dán)

Cập nhật 14/11/2026 (sửa theo `docs/audit/COMPLIANCE-AUDIT.md`) · Áp dụng cho bản 1.0.0 · Ngôn ngữ mặc định: Tiếng Việt (vi-VN), bản dịch: English (en-US).

Cách dùng: mỗi khối trong khung ``` bên dưới là chuỗi dán nguyên văn vào ô tương ứng ở Play Console (Grow > Store presence > Main store listing). Số ký tự đã đếm bằng máy; Play đếm theo ký tự Unicode.

> **Bản 1.0.0 dùng Bản A (không có Pro).** Play yêu cầu listing mô tả đúng những gì có trong bản đang phát hành (Metadata policy: không dùng metadata gây hiểu nhầm). Bản 1.0.0 **không có** gói Pro: `twa-manifest.json` đặt `playBilling.enabled = false`, `billing.js` chưa được nạp trong `index.html`, không có màn hình mua gói, Worker chưa triển khai. Vì vậy **không dán Bản B**, không nhắc "Pro", "gói trả phí" hay "đăng ký" ở bất cứ đâu trong listing 1.0.0. Bản B (mục 2.4 và 3.4) chỉ để dùng cho phiên bản sau, khi giao diện Pro có thật, cùng với cập nhật Data safety và `privacy.html` (xem `POLICY-ANSWERS.md`).
>
> **Mọi tính năng nêu dưới đây đã đối chiếu với app thật** (kiểm toán 14/11/2026): backtest khoảng 5 ngày, tối ưu 30 ngày; Cài đặt chỉ có công tắc bật/tắt từng điều kiện (và vốn, % rủi ro), **không** có chỉnh ngưỡng; tối đa 8 cặp; giao diện chỉ tiếng Việt; app cần truy cập được dữ liệu công khai của Binance. Sửa listing thì giữ đúng các điểm này.

Thương hiệu: SOLPHA độc lập. Không nhắc thương hiệu hay công ty nào khác ở listing, ảnh, icon, tên nhà phát triển.

---

## 1. Thông tin chung

| Mục | Giá trị |
|---|---|
| Loại | App (không phải Game) |
| Danh mục (Category) | **Tài chính (Finance)**. Lý do: đúng bản chất app; chọn "Công cụ/Tools" để né kiểm duyệt tài chính là khai sai danh mục, dễ bị coi là gây hiểu nhầm. |
| Tags (Play cho chọn tối đa 5 từ danh sách có sẵn; tên tag có thể khác bản dưới đây, chọn tag gần nghĩa nhất) | Phân tích kỹ thuật / Biểu đồ giá / Tài sản mã hoá (crypto) / Công cụ tài chính / Quản lý rủi ro. Nếu danh sách không có tag nào sát, bỏ trống thay vì chọn tag sai (chưa xác nhận danh sách tag hiện hành). |
| Email liên hệ | `[EMAIL]` |
| Website | `[WEBSITE]` (trang giới thiệu SOLPHA, không dùng domain/logo của đơn vị khác) |
| Điện thoại | Không bắt buộc, để trống |
| URL Chính sách quyền riêng tư | `https://solpha.pages.dev/privacy.html` (đã sửa theo kiểm toán; còn chỗ trống `[TÊN PHÁP NHÂN]`, `[EMAIL]`, `[WEBSITE]` **chủ app phải tự điền** trước khi gửi duyệt). Không cần kèm `?source=play`: từ BRAND-AUDIT P3, `brand.js` ép giao diện SOLPHA cho hai trang pháp lý, URL trơn là đúng. Tương tự `https://solpha.pages.dev/terms.html`. |
| Tên nhà phát triển | `[TÊN PHÁP NHÂN / CÁ NHÂN]` (không đặt tên có chữ "Binance", "Google", "Play", "Official") |

Về từ khoá: Play **không có ô từ khoá** riêng. Từ khoá nằm tự nhiên trong tên, mô tả ngắn, mô tả đầy đủ. Không nhồi từ khoá (Metadata policy coi là metadata thừa/gây hiểu nhầm). Danh sách gợi ý để cài tự nhiên vào văn bản:

- vi: giá futures realtime, phân tích kỹ thuật crypto, chỉ báo RSI MACD Bollinger, nến đa khung, quản lý rủi ro lệnh, nhật ký giao dịch, backtest, SOL BTC ETH DOGE.
- en: real-time futures prices, crypto technical analysis, RSI MACD Bollinger Bands, multi-timeframe candles, position sizing, trading journal, backtest, SOL BTC ETH DOGE.

---

## 2. Tiếng Việt (vi-VN)

### 2.1 Tên ứng dụng (≤ 30 ký tự) — 21 ký tự

```
SOLPHA · Futures Desk
```

Không thêm "Free", "Best", "#1", biểu tượng, giá hay khuyến mãi vào tên (Metadata policy).

### 2.2 Mô tả ngắn (≤ 80 ký tự)

```
Giá futures realtime, chỉ báo đa khung và kế hoạch tham khảo. Không phải tư vấn.
```

### 2.3 Mô tả đầy đủ (≤ 4000 ký tự) — Bản A, chưa có Pro

```
SOLPHA · Futures Desk là công cụ theo dõi và phân tích kỹ thuật thị trường hợp đồng tương lai (futures) tiền mã hoá. App hiển thị dữ liệu giá công khai theo thời gian thực, tính sẵn các chỉ báo kỹ thuật và trình bày kế hoạch tham khảo theo quy tắc kỹ thuật minh bạch để bạn tự cân nhắc.

SOLPHA không phải sàn giao dịch, không phải ví, không kết nối với tài khoản sàn của bạn và không đặt lệnh thay bạn. App không phải tư vấn đầu tư và không liên kết với Binance.

Tính năng

- Giá và nến gần thời gian thực (WebSocket, tự chuyển sang làm mới định kỳ khi mất kết nối) cho SOL, BTC, ETH, DOGE, cùng cặp tuỳ chọn do bạn thêm (tối đa 8 cặp USDT trên Binance Futures). Dữ liệu là dữ liệu thị trường công khai của Binance Futures. Cần truy cập được dữ liệu công khai của Binance; ở một số quốc gia Binance chặn nên app có thể không hiển thị dữ liệu.
- Chỉ báo kỹ thuật: EMA, Bollinger Bands, RSI, ATR, MACD, tính trên 5 khung thời gian: 5 phút, 15 phút, 1 giờ, 4 giờ, 1 ngày.
- Đánh giá đồng pha giữa các khung để bạn thấy xu hướng lớn và nhỏ có cùng hướng hay không.
- Kế hoạch tham khảo theo quy tắc kỹ thuật: vùng vào chia làm 3 mức, mức dừng lỗ (SL), một hoặc hai mục tiêu (TP1, TP2) và khối lượng gợi ý tính từ vốn cùng phần trăm rủi ro do chính bạn nhập. Các điều kiện chính được mô tả ngay trong app; trong Cài đặt bạn bật hoặc tắt từng điều kiện. Đây là phép tính tham khảo, không phải khuyến nghị mua hay bán.
- Backtest khoảng 5 ngày và tối ưu 30 ngày chạy ngay trên máy bạn bằng dữ liệu lịch sử công khai, đã trừ phí và trượt giá ước tính. Đây là mô phỏng đơn giản; kết quả quá khứ không bảo đảm kết quả tương lai.
- Soi lại quá khứ: chọn một thời điểm để xem vì sao lúc đó có hoặc không có điều kiện kỹ thuật.
- Nhật ký giao dịch cá nhân: ghi số lệnh, ghi chú, tự đánh giá việc tuân thủ kế hoạch của bạn theo checklist, tổng kết theo tháng, xuất CSV và sao lưu JSON.
- Thông báo ngay trên máy khi app đang chạy (trước hoặc sau khi chuyển sang nền, tuỳ Android cho phép) và có điều kiện kỹ thuật mà bạn đã bật. Thông báo không đi qua máy chủ nào.

Quyền riêng tư

- Không cần tạo tài khoản, không đăng nhập.
- Không quảng cáo, không SDK phân tích hay theo dõi của bên thứ ba.
- Cài đặt và nhật ký giao dịch chỉ lưu trên thiết bị của bạn.
- App chỉ gọi tới Binance để lấy giá công khai; phông chữ được lưu cùng app, không gọi Google. Như mọi trang web, Binance và nhà cung cấp hosting trang web thấy địa chỉ IP của bạn; chi tiết trong chính sách quyền riêng tư.
- Giao diện app bằng tiếng Việt.

Cảnh báo rủi ro

- Giao dịch hợp đồng tương lai có đòn bẩy, rất rủi ro. Bạn có thể mất toàn bộ số tiền trong tài khoản giao dịch, kể cả nhanh hơn dự tính khi thị trường biến động mạnh.
- Mọi chỉ báo, điều kiện kỹ thuật, kế hoạch tham khảo và kết quả mô phỏng chỉ phục vụ học tập và phân tích. Chúng có thể sai, trễ hoặc không phù hợp với hoàn cảnh của bạn.
- SOLPHA không đưa ra lời khuyên đầu tư, không cam kết hay bảo đảm kết quả nào. Quyết định và trách nhiệm giao dịch hoàn toàn thuộc về bạn.
- Chỉ dùng số tiền bạn có thể chấp nhận mất. Hãy tìm hiểu quy định pháp luật nơi bạn sinh sống về tài sản mã hoá.
- Dành cho người từ 18 tuổi trở lên.

Điều khoản: https://solpha.pages.dev/terms.html
Quyền riêng tư: https://solpha.pages.dev/privacy.html
Liên hệ: [EMAIL]
```

### 2.4 Phần thay thế cho Bản B (có gói Pro) — KHÔNG DÙNG cho 1.0.0

Chỉ dùng cho phiên bản sau, khi bản trên Play đã bật Play Billing, **giao diện mua gói đã có thật trong app** và đã có sản phẩm đăng ký trong Play Console. Nếu app chưa có màn hình mua gói mà listing nhắc Pro thì đó là mô tả sai tính năng. Thay `[GIÁ THÁNG]`, `[GIÁ NĂM]` bằng giá thật (Subscriptions policy: nêu rõ giá và chu kỳ; không nói "miễn phí" khi sau thời gian dùng thử sẽ bị tính phí). Danh sách tính năng Pro dưới đây là ví dụ, **sửa cho khớp đúng những gì Pro thật sự mở khoá**.

```
Gói SOLPHA Pro (tuỳ chọn)

- Các tính năng cơ bản ở trên dùng được không cần trả phí.
- SOLPHA Pro mở thêm [MỞ KHOÁ GÌ — ví dụ: số cặp theo dõi nhiều hơn, tối ưu 30 ngày không giới hạn lượt, xuất báo cáo].
- Đăng ký theo tháng ([GIÁ THÁNG]/tháng) hoặc theo năm ([GIÁ NĂM]/năm). Giá hiển thị cuối cùng theo quốc gia và đã gồm thuế (nếu có) ở màn hình thanh toán của Google Play.
- Dùng thử 7 ngày cho người dùng đủ điều kiện. Sau 7 ngày, gói tự gia hạn và bị tính phí theo chu kỳ bạn chọn, trừ khi bạn huỷ trước khi hết thời gian dùng thử.
- Huỷ bất cứ lúc nào: mở Google Play, chọn ảnh hồ sơ, Thanh toán và đăng ký, Đăng ký, chọn SOLPHA Pro, Huỷ đăng ký. Việc xoá app không tự huỷ đăng ký.
- Gói Pro mở thêm tính năng phần mềm. Gói Pro không bảo đảm lợi nhuận hay kết quả giao dịch nào.
- Thanh toán và hoàn tiền do Google Play xử lý. Chúng tôi không nhận thông tin thẻ; máy chủ xác minh chỉ lưu mã ngẫu nhiên của app, mã giao dịch ở dạng băm và mã hoá, gói và hạn dùng.
```

Và sửa mục "Quyền riêng tư" của Bản B thành:

```
Quyền riêng tư

- Không cần tạo tài khoản, không đăng nhập.
- Không quảng cáo, không SDK phân tích hay theo dõi của bên thứ ba.
- Cài đặt và nhật ký giao dịch chỉ lưu trên thiết bị của bạn.
- App gọi tới Binance để lấy giá công khai; phông chữ lưu cùng app.
- Nếu bạn đăng ký Pro, máy chủ của chúng tôi lưu mã ngẫu nhiên của app, mã giao dịch (dạng băm và mã hoá), gói và trạng thái/hạn dùng để mở tính năng. Không lưu thông tin cá nhân khác.
```

### 2.5 Có gì mới — v1.0.0 (≤ 500 ký tự)

```
Phiên bản đầu tiên.
- Giá và nến gần thời gian thực cho SOL, BTC, ETH, DOGE và cặp tuỳ chọn.
- Chỉ báo EMA, Bollinger, RSI, ATR, MACD trên 5 khung thời gian.
- Kế hoạch tham khảo theo quy tắc kỹ thuật, tính khối lượng từ vốn và % rủi ro bạn nhập.
- Backtest (khoảng 5 ngày), tối ưu 30 ngày và soi lại quá khứ chạy trên máy.
- Nhật ký giao dịch có checklist tự đánh giá.
Không phải tư vấn đầu tư. Giao dịch futures có thể mất toàn bộ vốn.
```

---

## 3. English (en-US)

### 3.1 App name (≤ 30 characters) — 21 characters

```
SOLPHA · Futures Desk
```

### 3.2 Short description (≤ 80 characters)

```
Live futures prices, multi-timeframe indicators and reference plans. Not advice.
```

### 3.3 Full description (≤ 4000 characters) — Version A, no Pro yet

```
SOLPHA · Futures Desk is a monitoring and technical analysis tool for cryptocurrency futures markets. It shows public market prices in real time, calculates technical indicators for you, and lays out reference plans built from transparent technical rules so you can weigh them yourself.

SOLPHA is not an exchange, not a wallet, does not connect to your exchange account and does not place orders for you. It is not investment advice and is not affiliated with Binance.

Features

- The app interface is in Vietnamese.
- Near real-time prices and candles (WebSocket, falling back to periodic refresh when the connection drops) for SOL, BTC, ETH, DOGE and any custom pair you add (up to 8 USDT pairs on Binance Futures). Data comes from Binance Futures public market data. The app needs access to Binance public data; in some countries Binance blocks access, so the app may not show any data there.
- Technical indicators: EMA, Bollinger Bands, RSI, ATR and MACD across 5 timeframes: 5 minutes, 15 minutes, 1 hour, 4 hours and 1 day.
- Cross-timeframe alignment view, so you can see whether the larger and smaller trends point the same way.
- Reference plans from technical rules: a three-level entry zone, a stop-loss level (SL), one or two targets (TP1, TP2) and a suggested position size calculated from the capital and risk percentage that you enter. The main conditions are described inside the app, and in Settings you switch each condition on or off. This is a calculation for reference, not a recommendation to buy or sell.
- A backtest of about 5 days and a 30-day optimisation that run on your device using public historical data, with estimated fees and slippage deducted. These are simplified simulations; past results do not guarantee future results.
- Replay the past: pick a moment and see why a technical condition did or did not appear then.
- Personal trading journal: log trades and notes, assess your own plan-following with a checklist, review monthly summaries, export CSV and back up as JSON.
- On-device notifications while the app is running (before or after it moves to the background, as far as Android allows) for conditions you have switched on. Notifications do not go through any server.

Privacy

- No account, no sign-in.
- No ads and no third-party analytics or tracking SDKs.
- Settings and your journal are stored only on your device.
- The app contacts Binance only, for public prices; the typeface is bundled with the app and Google is not contacted. As with any website, Binance and the web hosting provider see your IP address; details are in the privacy policy.

Risk warning

- Trading futures with leverage is highly risky. You can lose all the money in your trading account, sometimes faster than expected when markets move sharply.
- All indicators, technical conditions, reference plans and simulation results are for learning and analysis only. They can be wrong, late or unsuitable for your situation.
- SOLPHA does not give investment advice and does not promise or guarantee any outcome. Trading decisions and their consequences are entirely yours.
- Only use money you can afford to lose. Check the laws that apply to crypto assets where you live.
- For users aged 18 and over.

Terms: https://solpha.pages.dev/terms.html
Privacy: https://solpha.pages.dev/privacy.html
Contact: [EMAIL]
```

### 3.4 Version B insert (with SOLPHA Pro) — NOT FOR 1.0.0 (no Pro UI exists yet); place between "Features" and "Privacy"

```
SOLPHA Pro (optional)

- The core features above work without paying.
- SOLPHA Pro adds [WHAT IT UNLOCKS — e.g. more watched pairs, unlimited 30-day optimisation runs, report export].
- Subscribe monthly ([MONTHLY PRICE]/month) or yearly ([YEARLY PRICE]/year). The final price depends on your country and includes taxes where applicable on the Google Play checkout screen.
- 7-day free trial for eligible users. After 7 days the plan renews automatically and you are charged for the period you chose, unless you cancel before the trial ends.
- Cancel any time: open Google Play, tap your profile picture, Payments and subscriptions, Subscriptions, choose SOLPHA Pro, Cancel subscription. Uninstalling the app does not cancel the subscription.
- Pro unlocks software features. It does not guarantee profit or any trading result.
- Payments and refunds are handled by Google Play. We never receive card details; our verification server stores only a random app ID, a hashed and encrypted transaction identifier, the plan and its status and expiry.
```

Replace the Privacy block in Version B with:

```
Privacy

- No account, no sign-in.
- No ads and no third-party analytics or tracking SDKs.
- Settings and your journal are stored only on your device.
- The app contacts Binance for public prices; the typeface is bundled with the app.
- If you subscribe to Pro, our server stores a random app ID, the transaction identifier (hashed and encrypted), the plan and its status/expiry to unlock features. No other personal information is stored.
```

### 3.5 What's new — v1.0.0 (≤ 500 characters)

```
First release.
- Near real-time prices and candles for SOL, BTC, ETH, DOGE and custom pairs. Interface in Vietnamese.
- EMA, Bollinger, RSI, ATR and MACD across 5 timeframes.
- Reference plans from technical rules, with position size from your own capital and risk %.
- Backtest (about 5 days), 30-day optimisation and replay run on your device.
- Trading journal with a self-assessment checklist.
Not investment advice. Futures trading can lose all your capital.
```

---

## 4. Quy tắc từ ngữ cho toàn bộ listing (kiểm tra lần cuối trước khi dán)

Cấm tuyệt đối trong tên, mô tả, ảnh, video, "Có gì mới", phản hồi đánh giá:

| Cấm | Dùng thay |
|---|---|
| lợi nhuận đảm bảo, bảo đảm lãi, cam kết lợi nhuận | (không nói gì về kết quả) / "công cụ hỗ trợ phân tích" |
| thắng x%, tỷ lệ thắng cao, win rate, 90% | "thống kê backtest trên dữ liệu quá khứ" (không nêu con số trong listing) |
| kiếm tiền dễ, làm giàu, thu nhập thụ động, x2 tài khoản | "theo dõi", "phân tích", "quản lý rủi ro" |
| tín hiệu chắc chắn, tín hiệu chuẩn, không thể thua, không lỗ | "tín hiệu kỹ thuật theo quy tắc", "điều kiện kỹ thuật", "kế hoạch tham khảo" |
| nên mua, nên bán, hãy vào lệnh, khuyến nghị đầu tư | "kế hoạch tham khảo", "phép tính theo quy tắc" |
| #1, tốt nhất, miễn phí (khi có Pro mà không nêu), giảm giá, hot | mô tả trung tính |
| Binance trong tên app, logo Binance, ảnh có logo sàn | Chỉ nhắc "dữ liệu công khai của Binance" như nguồn dữ liệu, kèm câu "không liên kết với Binance" |
| Tên/logo công ty hoặc thương hiệu khác ngoài SOLPHA | Không nhắc ở bất cứ đâu |
| Viết hoa cả câu, nhiều dấu chấm than, emoji nhồi nhét | Viết thường bình thường; không emoji trong mô tả |
| Đánh giá/ lời chứng thực ẩn danh | Không đưa vào mô tả (Metadata policy: không cho phép lời chứng thực ẩn danh trong mô tả) |

## 5. Nguồn đã tra (13/11/2026)

- Metadata policy (tiêu đề ≤ 30 ký tự; không chữ/hình trong tên-icon-tên nhà phát triển nói về xếp hạng, giá, khuyến mãi; không lời chứng thực ẩn danh trong mô tả; cấm metadata gây hiểu nhầm/thừa): https://support.google.com/googleplay/android-developer/answer/9898842
- Hướng dẫn trình bày store listing: https://support.google.com/googleplay/android-developer/answer/13393723
- Subscriptions (cần nêu thời hạn dùng thử, giá sau dùng thử, cách huỷ): https://android-developers.googleblog.com/2020/04/building-user-trust-through-more.html và trang chính sách thanh toán/đăng ký của Play (chưa mở được bản gốc trong phiên này: mới đọc qua kết quả tìm kiếm, xem **chưa xác nhận** ở `POLICY-ANSWERS.md`)
- Financial Services policy: https://support.google.com/googleplay/android-developer/answer/9876821

**Chưa xác nhận:** (1) giới hạn ký tự "Có gì mới" 500 và mô tả ngắn 80, đang dùng theo hiểu biết chung về Play Console, nên kiểm tra khi dán; (2) danh sách tag hiện hành; (3) cách hiển thị giá và nút huỷ trong Pro (phải kiểm khi có bản Pro thật); (4) trang chính sách gốc trên support.google.com không mở được từ môi trường của phiên này (WebFetch bị chặn), mọi dẫn chứng lấy từ kết quả WebSearch.
