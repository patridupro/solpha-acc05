# SOLPHA · Futures Desk — Kiểm toán tuân thủ độc lập

Ngày kiểm toán: 14/11/2026 · Phạm vi: lời khai trong `docs/play/*`, `privacy.html`, `terms.html`, `commercial/*`, `docs/market/*` so với hành vi thật của app (`index.html`, `app.js`, `journal.js`, `signals.js`, `brand.js`, `billing.js`, `sw.js`, `twa-manifest.json`, `worker/`).
Kiểm toán viên không sửa file nào khác ngoài file này; không commit, không push.

**KẾT LUẬN: CHƯA SẴN SÀNG GỬI DUYỆT** (xem mục 7, kèm 5 việc phải làm trước).

---

## 0. Phương pháp và giới hạn của phép đo

| Việc | Cách làm | Giới hạn trung thực |
|---|---|---|
| Phục vụ app | `python3 -m http.server 8820`, mở `http://localhost:8820/?source=play`, Chromium 412×915, UA Android | Không phải bản cài từ Play/TWA; không có AAB trong repo nên **không đo được quyền Android thật** |
| Mạng | Lần 1 ("real"): không chặn gì. Sandbox chỉ ra được `fonts.googleapis.com`, `fonts.gstatic.com`; **mọi host Binance trả 403 từ proxy sandbox** (`ERR_TUNNEL_CONNECTION_FAILED`) | Dữ liệu Binance thật **không đo được**. Lần 2 ("mock"): chặn và trả dữ liệu nến **tổng hợp ngẫu nhiên** cho `*.binance.com` để thấy giao diện đầy đủ. Mọi con số giá/chỉ báo trong ảnh mock là giả, chỉ dùng để xem bố cục và chuỗi chữ |
| Dò | Hook `Storage.setItem`, `Notification.requestPermission`, `navigator.wakeLock.request`, `indexedDB.open`, `caches.open`, `document.cookie`, `sendBeacon`; `page.on(request/requestfailed/websocket)` | WebSocket tới `fstream.binance.com` **bị chặn nên chưa từng mở được**: khả năng nhận dữ liệu qua WS "CHƯA XÁC NHẬN"; chỉ xác nhận được địa chỉ và số luồng từ log lỗi |
| Chính sách Google | WebSearch ngày 14/11/2026 (WebFetch không dùng được với `support.google.com`) | Chỉ đọc đoạn trích trong kết quả tìm kiếm; ghi "CHƯA XÁC NHẬN" khi không thấy nguyên văn |
| Audit khác | `docs/audit/BILLING-AUDIT.md`, `docs/audit/BRAND-AUDIT.md` **chưa tồn tại** khi tôi hoàn tất (kiểm lại 2 lần). Tôi tự đọc `worker/src/index.js`, `billing.js` để đối chiếu mục billing | Khi hai file kia xuất hiện, cần đối chiếu lại mục 6 |

Bằng chứng đo (nằm ngoài repo, trong scratchpad của phiên): `.../scratchpad/audit/real-result.json`, `mock-result.json`, `*-bodytext.txt`, ảnh `real-*.png`, `mock-*.png` (412×915 và fullPage).

---

## 1. Số đo thật (tóm tắt)

**Host đã gọi (mở app, bấm hết các tab, 25 giây):**

| Host | Loại | Dữ liệu gửi đi | Trạng thái trong sandbox |
|---|---|---|---|
| `fapi.binance.com` | fetch GET | `/fapi/v1/ticker/24hr?symbol=…`, `/fapi/v1/premiumIndex?symbol=…`, `/fapi/v1/klines?symbol=…&interval=…&limit=…` | bị chặn |
| **`fapi1.binance.com`** | fetch GET | như trên (dự phòng, `app.js:8`) | bị chặn |
| `api.binance.com` | fetch GET | `/api/v3/ticker/24hr`, `/api/v3/klines` (và gọi nhầm `/fapi/v1/premiumIndex` trên host spot, `app.js:132-142`) | bị chặn |
| `fstream.binance.com` | WebSocket `wss://…/market/stream?streams=…` | tên luồng: mỗi cặp 7 luồng (`ticker`, `markPrice@1s`, 5 `kline_*`), 4 cặp = 28 luồng | bị chặn (lỗi trong console); dự phòng `wss://fstream.binance.com/stream?…` (`app.js:708`) |
| `fonts.googleapis.com` | stylesheet | `Referer: <origin của app>` (khi triển khai: `https://solpha.pages.dev/`) | 200 |
| `fonts.gstatic.com` | font (2 file woff2 Roboto) | `Referer: https://fonts.googleapis.com/`, `Origin: <origin app>` | 200 |
| `localhost:8820` (origin app) | 4 script, 2 css, 1 ảnh, 1 manifest | — | 200 |

- **Không có** request POST nào, không có `sendBeacon`, không có cookie (`ctx.cookies()` rỗng, `document.cookie` không bị ghi), không có IndexedDB, không có host phân tích/quảng cáo.
- Header gửi Binance: `Referer` (origin app), và `Origin` khi có CORS. Không có `Authorization`, không có cookie. Mã cặp, khung giờ, `endTime` nằm trong query.
- **Khi mạng/khu vực chặn Binance:** 252 request trong ~25 giây, 240 lỗi (80 mỗi host × 3 host) cho 4 cặp: app "dội" liên tục theo vòng thử lại 15/30/45/60 giây (`app.js:788-791`).

**Lưu trữ ghi trên máy** (hook `setItem` + đọc lại): `localStorage`: `solpha_view`, `solpha_logs` (nhật ký quét: có cặp, giá, lỗi), `solpha_risk_ack`, `solpha_acct` (vốn), `solpha_journal` (nhật ký giao dịch, gồm PnL và ghi chú), `solpha_wake`. Từ mã (chưa kích hoạt trong lần đo vì dữ liệu mock không có tín hiệu): `solpha_risk`, `solpha_pairs`, `solpha_active`, `solpha_price_sec`, `solpha_seen`, `solpha_last_alert`, `solpha_last_plan`, `solpha_setup*`/`solpha_walk`/`solpha_session`/`solpha_opt_applied`, `solpha_device` và `solpha_ent` (chỉ khi `billing.js` được nạp: **hiện KHÔNG nạp**, `index.html` không có thẻ script billing). `sessionStorage`: `solpha_brand`. **Cache Storage**: `solpha-v41` (22 URL cùng origin). IndexedDB: không. Cookie: không.

**Quyền trình duyệt:** `Notification.requestPermission()` chỉ được gọi khi bấm "Bật báo" (`app.js:865`) hoặc "Gửi thông báo thử" (`app.js:1124`), **không gọi lúc tải trang** (đã kiểm: 0 lần trước khi tôi bấm). `navigator.wakeLock.request("screen")` chỉ khi bật ô "Giữ màn hình sáng" (`app.js:834`) hoặc khi `solpha_wake=1` đã lưu.

**Google Fonts:** có tải (2 yêu cầu), `index.html:7-9`, **bắt buộc** (không có phương án tắt trong app).

**Màn hình đầu tiên:** hiện hộp "Trước khi dùng" (cảnh báo rủi ro + 18+) bắt buộc bấm "Tôi đã hiểu và đồng ý" (`index.html:260-271`, `app.js:875-881`); ảnh `real-00-first-open-modal.png`. **Điều này mâu thuẫn với `REVIEW-RISKS.md` R3 ("không có ở màn hình đầu")** → tài liệu cũ.

**Ảnh chụp đã xem:** `real-00/01` (mạng bị chặn: "Mất kết nối dữ liệu · mạng chậm hoặc app vừa chạy nền · đang tự thử lại…" và dòng "Failed to fetch | Failed to fetch | Failed to fetch"), `mock-01-signal`, `mock-02-analysis`, `mock-02-tools`, `mock-02-journal`, `mock-02-settings`, `mock-04b/05b` (bảng backtest/tối ưu với cột "Thắng", nhãn GIỮ/TẮT, "100%" ở dòng 3 lệnh).

---

## 2. Bảng đối chiếu: Lời khai → Thực tế đo được → Kết luận → Sửa thế nào

Ký hiệu: ĐÚNG / SAI / THIẾU / CHƯA XÁC NHẬN. Mức: **C** cao, **V** vừa, **T** thấp.

### 2.1 `privacy.html`

| # | Lời khai | Thực tế đo được | KL | Sửa (văn bản dán) |
|---|---|---|---|---|
| P1 | Tóm tắt: "không thu thập, không lưu, không bán bất kỳ dữ liệu cá nhân nào" | IP người dùng được ít nhất 3 bên thấy: Binance, Google (Fonts), nhà cung cấp hosting (Cloudflare Pages) | **THIẾU (C)** | Thay câu tóm tắt: "SOLPHA không có tài khoản và không có máy chủ riêng của nhà phát hành. Chúng tôi không thu thập, không lưu và không bán dữ liệu cá nhân của bạn. Khi dùng app, địa chỉ IP và thông tin kết nối chuẩn của thiết bị được các bên cung cấp dịch vụ mà app gọi tới (Binance, Google Fonts, nhà cung cấp hosting trang web) nhìn thấy theo cách hoạt động thông thường của internet; các bên đó có chính sách riêng." |
| P2 | Mục 2: Binance = `fapi.binance.com, fstream.binance.com, api.binance.com` | App còn gọi **`fapi1.binance.com`** (`app.js:8`) | **SAI/THIẾU (V)** | Sửa: "Gửi tới Binance (fapi.binance.com, fapi1.binance.com, api.binance.com và kênh WebSocket fstream.binance.com): mã cặp (ví dụ SOLUSDT) và khung thời gian để lấy giá, nến, mark price, funding công khai. Binance thấy địa chỉ IP, loại trình duyệt và địa chỉ trang (solpha.pages.dev) của bạn như với mọi website; app không gửi tên, email hay định danh nào." |
| P3 | Google Fonts: "Google thấy địa chỉ IP" | Đúng; còn gửi `Referer` = origin app; 2 request | **ĐÚNG, THIẾU chi tiết (T)** | Thêm: "…Google cũng nhận địa chỉ trang đang tải phông (Referer)." Cân nhắc tự host Roboto để bỏ mục này |
| P4 | Không nêu việc trang/ứng dụng được phục vụ bởi hosting | Mọi tệp tải từ `solpha.pages.dev` (Cloudflare Pages): nhật ký truy cập hosting có IP | **THIẾU (C)** | Thêm mục: "Hosting: app và các trang này được phục vụ bởi Cloudflare Pages. Nhà cung cấp hosting có thể ghi nhật ký kỹ thuật (địa chỉ IP, thời điểm, tên tệp được tải) theo chính sách của họ. Chúng tôi không dùng nhật ký này để nhận diện cá nhân." (đúng chỉ khi chủ app không bật Web Analytics/Logpush: kiểm cấu hình Cloudflare trước khi dán) |
| P5 | Lưu trên thiết bị: "danh sách cặp, cài đặt tín hiệu, vốn và % rủi ro, nhật ký giao dịch, nhật ký quét, kế hoạch lệnh gần nhất" (localStorage) | Đúng. Thiếu: `solpha_seen` (khoá tín hiệu đã báo), cờ đã đồng ý cảnh báo, Cache Storage (bản sao tệp app để chạy offline), `sessionStorage` | **THIẾU (T)** | Thêm: "…cờ đã đọc cảnh báo rủi ro, danh sách tín hiệu đã thông báo, và bản lưu tạm các tệp của app (Cache Storage) để chạy khi mất mạng." |
| P6 | Thông báo: "chỉ khi bạn cho phép… không qua máy chủ đẩy" | Đúng: chỉ xin quyền khi bấm nút (đo được); `showNotification` qua service worker | **ĐÚNG** | Giữ nguyên |
| P7 | Giữ sáng màn hình: tuỳ chọn | Đúng (đo được) | **ĐÚNG** | Giữ |
| P8 | Mục 3: không SDK bên thứ ba, không phân tích, không quảng cáo | Không có host/script lạ; nhưng Google Fonts là tài nguyên bên thứ ba | **ĐÚNG có điều kiện** | Đổi "không SDK bên thứ ba" thành "không SDK phân tích, quảng cáo hay theo dõi của bên thứ ba (chỉ tải phông chữ từ Google Fonts)" |
| P9 | Mục 4 (khi có thanh toán): "chỉ nhận mã xác nhận mua hàng" | Worker (`worker/src/index.js`) lưu: `deviceId` (UUID ngẫu nhiên do app sinh, `billing.js` `solpha_device`), băm SHA-256 của purchase token, purchase token mã hoá AES-GCM, SKU, trạng thái, hạn dùng; dùng IP để giới hạn tốc độ (`index.js:596`, trong bộ nhớ) | **SAI nếu bật Pro (C)** | Chưa dán khi chưa có Pro. Khi bật Pro dùng: "Khi bạn đăng ký gói trả phí: máy chủ của chúng tôi (Cloudflare Workers) lưu mã định danh ngẫu nhiên của app trên thiết bị bạn, mã giao dịch Google Play (dạng băm và dạng mã hoá), gói đã mua, trạng thái và ngày hết hạn để mở tính năng. Địa chỉ IP chỉ dùng tạm để chống lạm dụng, không lưu. Không lưu tên, email hay thẻ. Giữ dữ liệu trong thời gian đăng ký còn hiệu lực và [N] ngày sau đó. Yêu cầu xoá: [EMAIL]." |
| P10 | Mục 6 hướng dẫn xoá bằng xoá dữ liệu app | Đúng cho dữ liệu cục bộ. `POLICY-ANSWERS.md` 1B nhắc tới `privacy.html#xoa-du-lieu`: **neo này không tồn tại** | **THIẾU (T, chỉ khi Pro)** | Thêm `<h2 id="xoa-du-lieu">` khi bật Pro |
| P11 | Mục 1: `[TÊN PHÁP NHÂN]`, `[EMAIL]` (3 chỗ), `[WEBSITE]` | Còn nguyên trong file | **CHƯA ĐIỀN (C)** | Điền; Play từ chối chính sách thiếu liên hệ |

### 2.2 `docs/play/POLICY-ANSWERS.md`

| # | Lời khai | Thực tế | KL | Sửa |
|---|---|---|---|---|
| D1 | Data safety 1A: "Không thu thập hoặc chia sẻ" | Không có máy chủ riêng, không SDK, không POST, không cookie, không ID. Nhưng IP đi tới Binance/Google/Cloudflare; Google nói dữ liệu chuyển cho bên thứ ba thường tính là "chia sẻ", ngoại lệ cho nhà cung cấp xử lý theo chỉ dẫn của nhà phát triển (kết quả tìm kiếm; nguyên văn hiện hành CHƯA XÁC NHẬN). Binance không xử lý "thay mặt" nhà phát triển (là nguồn dữ liệu công khai, không phải nhà xử lý) | **CHƯA XÁC NHẬN (V)** | Giữ "Không thu thập" nhưng **chuẩn bị sẵn phương án dự phòng** của tài liệu. Cải thiện chắc chắn nhất: tự host Roboto (bỏ Google); `fapi1` bỏ khỏi `ENDPOINTS` nếu không cần. Không thể bỏ Binance (nguồn dữ liệu) |
| D2 | Binance chỉ gồm `fapi`, `fstream`, `api` (cả `POLICY-ANSWERS` 1A và ghi chú reviewer dòng 155) | Thiếu `fapi1` | **SAI nhỏ (T)** | Thêm `fapi1.binance.com` vào ghi chú reviewer và bảng |
| D3 | Dòng 35 "`app.js:10-11` khoá `solpha_*`; `journal.js:4`" | Đúng khoá; số dòng còn đúng cho `store` (10-11) | **ĐÚNG** | — |
| D4 | 1B: "Device or other IDs: chỉ khai nếu app sinh UUID… thiết kế khuyến nghị: không tạo ID riêng, dùng purchase token" | `billing.js` **có** sinh `deviceId` UUID (`LS_DEVICE`) và Worker lưu (`/api/verify {deviceId,…}`) | **SAI nếu Pro (C)** | Sửa 1B: "Device or other IDs: **CÓ** (mã ngẫu nhiên do app sinh, gửi lên máy chủ để gắn quyền lợi). Mục đích: App functionality; Fraud prevention. Không chia sẻ bên thứ ba." |
| D5 | Financial features: chọn "Không có tính năng tài chính" nếu form chỉ có sàn/ví/NFT/chứng khoán/vay | Tìm kiếm ngày 14/11/2026 cho thấy form có nhóm gồm "Credit monitoring and reporting, **Financial advice**, Insurance, Other" (CHƯA XÁC NHẬN nguyên văn). App tính SL/TP/khối lượng từ vốn người dùng nhập (`app.js:266-277`, `580-604`) | **CHƯA XÁC NHẬN (C)** | Quyết định của chủ app: khai "Financial advice"/"Other" (nếu có) kèm ghi chú reviewer có sẵn; **không** chọn "không có tính năng tài chính" nếu form có hạng mục tư vấn/phân tích. Khai thừa an toàn hơn khai thiếu (bị từ chối vì "inaccurate" đã có ghi nhận) |
| D6 | Ghi chú reviewer: "Region note", "Settings tab… Capital… Risk per trade" | Đúng nơi nhập (`index.html:211-212`). "LIVE indicator" trên màn đầu: **không có** ở hero; "LIVE"/"⚡ REALTIME" là pill ở tab Phân tích (`index.html:104`, `app.js:771`), hero chỉ có "giá hh:mm:ss"/"⚡ hh:mm:ss" | **SAI nhỏ (V)** | Sửa: "…shows the live price for SOLUSDT; a timestamp with a lightning icon means the WebSocket stream is live (the 'REALTIME' pill is on the Analysis tab)." |
| D7 | Ghi chú reviewer Pro: "Pro features marked with 'Pro' label", "Settings > 'Restore purchase'" | Không có nhãn Pro, không có nút khôi phục trong `index.html`/`app.js` (`billing.js` chưa nối UI; thông báo trong lib nhắc "Khôi phục giao dịch" nhưng không có nút) | **SAI nếu dùng (C)** | Không dùng đoạn Pro cho tới khi UI tồn tại |
| D8 | Quyền: `POST_NOTIFICATIONS` + `INTERNET`; `WAKE_LOCK` "thường không có" | Không có AAB để kiểm. `enableNotifications:true` (`twa-manifest.json`) làm Bubblewrap bật uỷ quyền thông báo; có/không `POST_NOTIFICATIONS`, `WAKE_LOCK`, `AD_ID` **CHƯA XÁC NHẬN** | **CHƯA XÁC NHẬN (V)** | Chạy `bundletool dump manifest` trên AAB thật trước khi trả lời; dán kết quả vào hồ sơ |
| D9 | Ads: không quảng cáo | Đúng (không script ngoài, không host quảng cáo) | **ĐÚNG** | AD_ID vẫn cần kiểm trong AAB |
| D10 | Target audience 18+ | `index.html:267`, `terms.html` mục 3, `privacy.html` mục 5 đều ghi 18+. Không có kiểm tuổi thực | **ĐÚNG** | — |
| D11 | App access: "Tất cả chức năng đều khả dụng" | Đúng về đăng nhập. Nhưng ở khu vực Binance chặn thì dữ liệu không có (xem mục 4/R2) | **ĐÚNG có điều kiện** | Kèm video + email như tài liệu |
| D12 | Số dòng dẫn chứng (`app.js:863-864`, `872`, `1115`, `index.html:250`, `257`, `37`) | Đã lệch: nút thông báo `app.js:863-865`; `app.js:1115` nay là `1122-1124`; footer `index.html:272`; rule "Tự quản size" `index.html:255`; logo công ty khác `index.html:39` | **LỖI THỜI (T)** | Cập nhật hoặc bỏ số dòng |
| D13 | Mục 10.3: "Màn hình đầu còn logo thương hiệu khác" | Ở `?source=play`, `brand.js` gỡ `img.etek-logo` và không tải `etek-logo.png` (0 request ảnh đó). Nhưng `index.html:39` (alt "ETEK Power"), `icon.svg:1` (aria-label "SOLPHA · ETEK Power"), và Cache Storage chứa `manifest.webmanifest`, `icons/icon-*.png`, `maskable-*`, `apple-touch-icon.png`, `favicon-32.png` của bản kia | **ĐÃ XỬ LÝ MỘT PHẦN (V)** | Giao cho BRAND-AUDIT; ở đây chỉ ghi nhận mâu thuẫn với `REVIEW-RISKS.md` R0 "ĐÃ XỬ LÝ" |

### 2.3 `docs/play/LISTING.md` (bản A, vi/en)

| # | Khẳng định | Thực tế | KL | Sửa (dán) |
|---|---|---|---|---|
| L1 | "Giá và nến theo thời gian thực… SOL, BTC, ETH, DOGE, cặp tuỳ chọn" | Có WebSocket 28 luồng, nến cập nhật; khi WS lỗi quay về REST 5–60 giây (mặc định 10). WS **chưa xác nhận hoạt động** (bị chặn). Khu vực bị chặn: không có dữ liệu | **ĐÚNG có điều kiện / CHƯA XÁC NHẬN (V)** | "Giá và nến gần thời gian thực (WebSocket, tự chuyển sang làm mới định kỳ khi mất kết nối)…" và thêm câu: "Cần truy cập được dữ liệu công khai của Binance; ở một số quốc gia Binance chặn nên app có thể không hiển thị dữ liệu." (đây là yêu cầu trung thực về hạn chế) |
| L2 | "Cặp tuỳ chọn" | Tối đa **8 cặp tổng cộng**, chỉ USDT-M, xác minh với Binance (`app.js:933-935`) | **THIẾU (T)** | "…tối đa 8 cặp USDT trên Binance Futures." |
| L3 | "Chỉ báo EMA, Bollinger, RSI, ATR, MACD trên 5 khung" | Đúng (`TFS`, `analyze`, bảng Đa khung) | **ĐÚNG** | — |
| L4 | "Backtest 5 ngày và tối ưu 30 ngày … **đã trừ phí ước tính**" | Tối ưu: có trừ 0.08%/lệnh (`signals.js:23,461`; UI `app.js:1095`). Backtest 5M cũng trừ (cùng `DEFAULTS.feeRate`) **nhưng UI nói ngược**: "Chưa tính phí giao dịch và trượt giá" (`app.js:997`). 0.08% gộp phí+trượt giá ước tính, không phải trượt giá thật | **ĐÚNG ở listing, SAI ở UI (V)** | Sửa UI `app.js:997` thành "Đã trừ phí và trượt giá ước tính 0,08% mỗi lệnh (chưa phản ánh đầy đủ thanh khoản thực và lỗi kết nối)." Listing giữ nhưng đổi "đã trừ phí ước tính" thành "đã trừ phí và trượt giá ước tính" |
| L5 | "Đánh giá đồng pha giữa các khung" | Đúng (thẻ "Đồng pha") | **ĐÚNG** | — |
| L6 | "Kế hoạch tham khảo: vùng vào 3 phần, SL, **hai mục tiêu**, khối lượng theo vốn và % rủi ro" | Đúng; ngoại lệ: khi TP2 sát TP1 thì "TP2 = TP1, chốt hết" (`app.js:275,602`) | **ĐÚNG, T** | "…một hoặc hai mục tiêu…" |
| L7 | "Mọi quy tắc được công bố ngay trong app" | Có thẻ "Rule cố định" nhưng ngưỡng cụ thể (ví dụ range ≥1.2–1.3×ATR, volume ≥1.3–1.5×, `signals.js` DEFAULTS) chỉ hiện ở thanh "cần …" (`app.js:557-570`), không có trang liệt kê toàn bộ | **HƠI QUÁ (T)** | "Các điều kiện chính được mô tả trong app" |
| L8 | "Soi lại quá khứ… vì sao có hoặc không có tín hiệu" | Đúng (`app.js:1003-1033`) | **ĐÚNG** | — |
| L9 | "Nhật ký… xuất CSV và sao lưu JSON" | Đúng (+ khôi phục JSON) | **ĐÚNG** | — |
| L10 | "Thông báo ngay trên máy khi app đang mở… không đi qua máy chủ" | Đúng: `showNotification` cục bộ. Lưu ý thông báo "tín hiệu bỏ lỡ" chỉ phát khi tab ẩn (`app.js:822`): nghĩa là có thể xuất hiện khi app ở nền | **ĐÚNG, T** | "…khi app đang chạy (trước hoặc sau khi chuyển sang nền, tuỳ Android cho phép)" |
| L11 | "Không cần tài khoản" | Đúng | **ĐÚNG** | — |
| L12 | "App chỉ gọi tới Binance … và Google Fonts" | Đúng (+ `fapi1` cùng chủ Binance; hosting `solpha.pages.dev` là nguồn app) | **ĐÚNG** | — |
| L13 | Bản en-US mô tả bằng tiếng Anh | UI chỉ có tiếng Việt (`SCREENSHOT-PLAN` thừa nhận; `LISTING.md` en không nói) | **THIẾU (V)** | Thêm dòng đầu mục Features (en): "The app interface is in Vietnamese." |
| L14 | Từ cấm (§4) | Quét `LISTING.md`: không có "thắng", "chắc chắn", "kiếm tiền", "lợi nhuận đảm bảo" trong các khối dán. Có "tín hiệu kỹ thuật", "kế hoạch tham khảo". Có "mua hoặc bán" chỉ trong câu phủ định | **ĐÚNG** | — |
| L15 | Tên "SOLPHA · Futures Desk" 21 ký tự | Đúng; không từ khoá/ biểu tượng | **ĐÚNG** | — |
| L16 | Category Finance | Hợp lý (và khớp `manifest-solpha` `categories:["finance"]`) | **ĐÚNG** | — |
| L17 | "Bản B" Pro | `playBilling.enabled=false`, `billing.js` không nạp, API_BASE còn `<subdomain>`; không có paywall UI | **SAI nếu dùng (C)** | Không dùng Bản B cho 1.0.0 |

### 2.4 `docs/play/SCREENSHOT-PLAN.md`

| # | Mục | Thực tế | KL | Sửa |
|---|---|---|---|---|
| S1 | Ảnh 1: "badge LIVE" ở hero; "thanh xu hướng 5 khung" | LIVE là pill ở tab Phân tích; hero có badge "CHỜ/LONG/SHORT/CHÚ Ý" + thời gian giá. Thanh xu hướng 5 khung **có** (`mock-01-signal.png`) | **SAI nhỏ** | Đổi thành "dấu thời gian ⚡ (WebSocket)" |
| S2 | Ảnh 1 phải che "ĐANG GIỮ"/"ĐÃ CHẠM TP1" | Đúng, nhưng **thiếu**: ở trạng thái CHỜ, ô hành động còn hiện dòng "Kế hoạch gần nhất: … → **chạm TP2 ✓✓ / chạm SL ✗**" trong 3 giờ sau một kế hoạch (`app.js:611-613`) và hộp "BỎ LỠ" ở thẻ dưới | **THIẾU (C)** | Thêm vào mục "Phải che": "dòng Kế hoạch gần nhất (kết quả ✓/✗), hộp 'Tín hiệu 90 phút qua' và thẻ BỎ LỠ"; chụp khi 3 giờ gần nhất không có kế hoạch |
| S3 | Ảnh 2, 3 (bảng Đa khung) | Có (`tfBody`, 5 hàng). Chú thích "MACD*" nằm ở Cài đặt > Rule cố định, **không** dưới bảng | **SAI nhỏ** | Bỏ câu "chữ nhỏ có MACD* giải thích" |
| S4 | Ảnh 4: thẻ "Lệnh tham khảo" ở trạng thái MỚI | Thẻ này là văn bản thô `<pre>` (`orderBox`), có dấu `**` hiển thị nguyên (`app.js:382`); khối đẹp là ô hành động ở tab Tín hiệu (▲ LONG/▼ SHORT, "Vào ngay…", "Khối lượng… ≈ $…") | **CẦN RÀ (V)** | Chụp ô hành động; sửa chuỗi theo mục 3 trước khi chụp |
| S5 | Ảnh 5: khối lượng ở màn Cài đặt | Màn Cài đặt chỉ có ô nhập (`index.html:211-212`), **không** hiện khối lượng; khối lượng chỉ hiện ở ô hành động khi có kế hoạch (`app.js:604`) | **SAI (V)** | Ảnh 5 = ô nhập vốn/rủi ro (chụp Cài đặt) hoặc ô hành động có kế hoạch; không ghép |
| S6 | Ảnh 6: Công cụ chưa chạy + "Soi lại" | Có (`mock-02-tools`: nút Backtest/Tối ưu, ô Soi lại). Tiêu đề thẻ là "**Công cụ kiểm chứng**" (`index.html:137`) | **ĐÚNG, nhưng tiêu đề rủi ro** | Đổi tiêu đề (mục 3) trước khi chụp |
| S7 | Ảnh 7: Đứng ngoài, PnL trống, chưa lưu | Có đủ (`mock-02-journal`). Pill "Điểm: —" an toàn; tiêu chí "Kỷ luật theo chỉ báo — Chỉ vào khi app đủ điều kiện" hiện trên ảnh | **RỦI RO NHỎ** | Đổi hint (mục 3) |
| S8 | Ảnh 8: cuộn tới "Rule cố định" | Ở Cài đặt, thẻ ngay phía trên có "▲ LONG · mua khi…/▼ SHORT · bán khi…" (`index.html:227,232`) có thể lọt khung | **THIẾU** | Sửa chuỗi hoặc cắt khung |
| S9 | Mọi ảnh có thanh cặp | Thanh cặp luôn hiện badge "LONG/SHORT/CHÚ Ý/CHỜ" + "5M R x · V y" (`app.js:671-688`); `+x%` 24h có màu | **THIẾU (V)** | Ghi vào quy tắc chung: chụp lúc cả 4 cặp "CHỜ" hoặc che badge |
| S10 | Quy tắc: không cột "Thắng", không GIỮ/TẮT, không điểm hạng | Cột "Thắng", "đạt chuẩn", GIỮ/TẮT, "100%" có thật ở tab Công cụ sau khi chạy (`mock-04b/05b`, `mock-bodytext.txt` dòng 32, 74-86) | **ĐÚNG khi tuân thủ** | Giữ; không chụp |

### 2.5 `commercial/*`, `docs/market/*`

| # | Khẳng định | Thực tế | KL | Sửa |
|---|---|---|---|---|
| M1 | `LISTING-EN.md:47` / `LISTING-VI` tương ứng: "The built-in backtest is a small simulation on recent public data (roughly **30 days**)" | Backtest 5M dùng ~1.500 nến 5M ≈ 5 ngày (`app.js:974`); 30 ngày là **Tối ưu** | **SAI (V)** | "The built-in backtest (about 5 days) and optimizer (30 days) are small, simplified simulations…" (EN) / "Backtest (khoảng 5 ngày) và công cụ tối ưu (30 ngày) là mô phỏng nhỏ, đơn giản…" (VI). Câu tương tự ở FAQ dòng 156 (EN) và 145 (VI) |
| M2 | `LISTING-EN.md:64` "Each rule is parameterised in Settings" và `:67` "your configured ATR limit" | Settings chỉ có **bật/tắt** từng setup và bộ lọc (`index.html:226-243`); ngưỡng (ATR, volume, `sMaxRiskATR`…) là hằng số trong `signals.js` `DEFAULTS`, chỉ sửa được bằng mã | **SAI/gây hiểu nhầm (V)** | "Each rule can be switched on or off per pair in Settings; thresholds are parameters in signals.js (DEFAULTS) that you can edit in the source." |
| M3 | `LISTING-EN.md:70` "lets you keep only the conditions that pass **your** thresholds" | Ngưỡng tối ưu là hằng cố định `OPT_RULES` (`app.js:1050`: ≥6 lệnh, thắng ≥50%) | **SAI nhỏ** | "…pass the built-in thresholds (editable in source)…" |
| M4 | `commercial/README.md:24` "**Sẵn sàng Android**" | `assetlinks.json` còn placeholder, không có AAB, signing key không có (`twa-manifest.json: ./android.keystore`), PWA chưa duyệt | **QUÁ LỜI (V)** | "Kèm cấu hình khởi tạo Android (TWA) và mẫu hồ sơ Google Play; bạn tự build, ký và gửi duyệt." |
| M5 | `commercial/README.md:25` "Sẵn khung thanh toán Google Play Billing… mặc định tắt" | `billing.js` **không được nạp** ở `index.html` (kể cả bản `dist/solpha-commercial/index.html`), `API_BASE` placeholder, chưa có paywall; `LISTING-EN.md:192` đã nói đúng "paywall UI not pre-wired" | **MÂU THUẪN GIỮA TÀI LIỆU (V)** | README: "Kèm thư viện billing.js và Worker xác minh (đã có test), **chưa nối giao diện mua gói**: bạn cần tự thêm màn hình mua." |
| M6 | `commercial/README.md:20`, `DEMO-VIDEO`: "Công cụ kiểm chứng" | Gọi backtest là "kiểm chứng" ngụ ý đã xác thực hiệu quả; trái với lời cảnh báo "mô phỏng, không chứng minh" | **GÂY HIỂU NHẦM (V)** | "Công cụ mô phỏng: Backtest 5M…" (đổi cả UI `index.html:137`) |
| M7 | `commercial/LICENSE.md` §5 "tải phông từ Google Fonts **(tuỳ chọn)**" | Tải phông là cứng trong `index.html:7-9` cả bản thương mại (`dist/…/index.html` có 2 liên kết) | **SAI nhỏ (T)** | "Sản phẩm mặc định tải phông Roboto từ Google Fonts (có thể thay bằng phông tự host bằng cách sửa `index.html`)." |
| M8 | `LISTING-EN.md` "No promise of profit/win rate/accuracy" | Không có từ cam kết. Nhưng UI có cột "Thắng", "đạt chuẩn", "GIỮ/TẮT" (mục 3) và tab "Tín hiệu" — trong khi tag/ảnh bán bị cấm chữ "signals" | **MÂU THUẪN NHẸ (V)** | Ảnh bán: không chụp bảng Thắng/GIỮ; chấp nhận "Tín hiệu" tab, nhưng ghi rõ "signals = rule outputs, none bundled" như đã có (`LISTING-EN.md:48`) |
| M9 | `commercial/README.md:3` "theo dõi **tín hiệu** futures" vs `LISTING-*` cấm tag "signals" | Mâu thuẫn từ ngữ giữa README (đi kèm gói) và listing | **MÂU THUẪN (T)** | "…theo dõi **điều kiện kỹ thuật** futures đa khung…" |
| M10 | "24/7 alert", "tự động giao dịch", "độ chính xác", "đã kiểm chứng" | `LISTING-EN.md:114`, `LISTING-VI.md:113` nói rõ **không** có 24/7; không có lời hứa tự động giao dịch hay độ chính xác nào. `terms.html §1` cũng ghi Android có thể tạm dừng | **ĐÚNG** | — |
| M11 | `LISTING-EN.md:55` "mark price and funding every second" | Luồng `markPrice@1s` (`app.js:715`) | **ĐÚNG (WS chưa xác nhận trong sandbox)** | — |
| M12 | "Ready to paste" `docs/market/*` nêu "39 automated tests" | `worker/test/*` có; không chạy lại trong phạm vi này | **CHƯA XÁC NHẬN** | Chạy `node --test worker/test` trước khi đăng |

### 2.6 Cấu hình nền tảng

| # | Mục | Thực tế | KL | Sửa |
|---|---|---|---|---|
| T1 | `twa-manifest.json` `features.playBilling.enabled=false` | Khớp với việc chưa có paywall | **ĐÚNG** | — |
| T2 | `enableNotifications:true` | Cần AAB để biết quyền xuất ra | **CHƯA XÁC NHẬN** | Xem D8 |
| T3 | `.well-known/assetlinks.json` fingerprint | `THAY_BANG_SHA256_…` | **CHƯA ĐIỀN (C)** | Điền SHA-256 của khoá app signing Play |
| T4 | Shortcut "Quét ngay" `/?scan=1` | `app.js` không đọc tham số `scan`; app tự quét lúc mở nên hiệu ứng gần như đúng, nhưng tham số vô nghĩa | **T** | Bỏ shortcut hoặc thêm xử lý; không ảnh hưởng duyệt |
| T5 | `index.html:6` `theme-color #189848` (màu bản kia); `brand.js` đổi thành `#07080c` khi `source=play` | Có đổi (kiểm trong DOM không đo); TWA dùng giá trị từ `twa-manifest.json` | **ĐÚNG** | — |

---

## 3. Chuỗi giao diện rủi ro (file:dòng) và cách diễn đạt thay thế

Rủi ro: **C** (dễ bị gắn "tư vấn tài chính cá nhân hoá"/"số liệu gây hiểu nhầm"), **V**, **T**. Chính sách tham chiếu: Financial Services (gồm "personalized advice" — đoạn trích tìm kiếm 14/11/2026), Metadata/Misleading Claims ("false or misleading information or claims, including in the description, title, icon, and screenshots"; ảnh chụp phải phản ánh trải nghiệm thật), Financial features declaration.

| # | Chuỗi hiện tại | Vị trí | Rủi ro | Vấn đề | Thay bằng |
|---|---|---|---|---|---|
| U1 | "▲ LONG · mua khi 1D/4H/1H cùng tăng" / "▼ SHORT · bán khi khung lớn giảm" | `index.html:227,232`; `app.js:960` (`SIDE_HEAD`, hiện ở bảng Backtest/Tối ưu) | **C** | Mệnh lệnh mua/bán | "▲ Điều kiện thuận xu hướng tăng (1D/4H/1H cùng tăng)" / "▼ Điều kiện thuận xu hướng giảm (khung lớn giảm)" |
| U2 | "Vào ngay ${giá}: R:R 1:x" | `app.js:604` | **C** | "Vào ngay" là chỉ dẫn | "Nếu dùng giá hiện tại ${giá} làm điểm vào, R:R là 1:x" |
| U3 | "ĐANG GIỮ · tín hiệu nến …"; "ĐÃ CHẠM TP1 … ✓ · dời SL về giá vào, **giữ** phần còn lại tới TP2"; "GIÁ ĐÃ CHẠY XA … **không vào mới, đã vào thì giữ theo kế hoạch**" | `app.js:593-595` | **C** | Chỉ dẫn quản lý lệnh đang mở, ngụ ý người dùng đã vào | "KẾ HOẠCH CÒN HIỆU LỰC · nến … (còn N′)" / "GIÁ ĐÃ CHẠM MỤC TIÊU 1 lúc hh:mm (theo quy tắc: SL dời về giá vào)" / "GIÁ ĐÃ ĐI XA · R:R hiện tại chỉ 1:x (dưới ngưỡng 1)" |
| U4 | "Vào 3 phần", "Stop loss", "TP1/TP2" | `app.js:272-275,599-602` | **V** | Thuật ngữ trung tính nếu có chữ "tham khảo" | "Vùng vào tham khảo (3 mức)", "Mức dừng lỗ tham khảo (SL)", "Mục tiêu tham khảo 1/2" |
| U5 | "Khối lượng … ≈ $ · rủi ro $" | `app.js:276,604` | **C** | Cá nhân hoá theo vốn của người dùng | "Khối lượng gợi ý theo vốn và % rủi ro bạn nhập: …" + dòng cố định "Giá trị do bạn nhập; app không biết hoàn cảnh tài chính của bạn." |
| U6 | "Kế hoạch gần nhất: … → chạm TP2 ✓✓ / chạm SL ✗ / chạm TP1, chốt hết ✓" | `app.js:611-612` | **C** | Hiện kết quả thắng/thua có biểu tượng; dễ chụp ảnh | "Kế hoạch gần nhất: … → giá đã chạm mục tiêu 2 / giá đã chạm mức dừng lỗ / giá đã chạm mục tiêu 1" (bỏ ✓✗) |
| U7 | "BỎ LỠ" (nhãn), "Bỏ lỡ n tín hiệu … — mở app xem kế hoạch lệnh" (nhật ký + **thông báo đẩy** tiêu đề "tín hiệu bỏ lỡ"), "Tín hiệu quá 30′ tuổi … cân nhắc kỹ trước khi vào" | `app.js:816-817,820,822` | **C** | Ngôn ngữ FOMO + "xem kế hoạch lệnh" + "trước khi vào" | Nhãn "CHƯA XEM"; thông báo "SOLPHA · {coin}: n điều kiện kỹ thuật xuất hiện khi app ở nền"; dòng cuối "Điều kiện đã xuất hiện hơn 30′ trước; giá có thể đã thay đổi." |
| U8 | Thông báo "SOLPHA · {coin} nến tín hiệu" kèm "vào …/…/… · SL … · TP1 … · TP2 …" | `app.js:523-525` | **V** | Thông báo đẩy chứa mức giá như chỉ dẫn | "SOLPHA · {coin}: có điều kiện kỹ thuật mới (xem kế hoạch tham khảo trong app)" — không để mức SL/TP trong thông báo |
| U9 | Thẻ "Ưu tiên" / "XEM LONG" / "XEM SHORT" / "KHÔNG CHASE · chờ pullback" / "KHÔNG SHORT ĐÁY · chờ hồi" | `index.html:95`; `app.js:448-450` | **C** | "Ưu tiên" = khuyến nghị | Tiêu đề "Trạng thái điều kiện"; nội dung "Thiên tăng (điều kiện LONG đang thoả)" / "Thiên giảm (điều kiện SHORT đang thoả)" / "Chưa đủ điều kiện" |
| U10 | "Ưu tiên: WAIT. Không chase, không đoán."; "Hướng: LONG (thuận 1D/4H…)", "Chờ pullback … mới xét long", "SL tham chiếu nếu vẫn muốn plan", "Không short đáy band khi tín hiệu lệch" | `app.js:368-419` (văn bản `<pre>` thẻ Lệnh tham khảo) | **V** | Giọng khuyên nhủ | "Trạng thái: chờ (chưa đủ điều kiện)" / "Điều kiện thiên tăng (LONG tham khảo)" / "Mức tham chiếu: …" |
| U11 | "Thiên LONG · chờ nến 5M đủ chuẩn" | `app.js:608` | **V** | "đủ chuẩn" hàm ý chuẩn chất lượng | "Thiên tăng · chờ nến 5M đạt điều kiện" |
| U12 | Cột "**Thắng**" (%) ở bảng Backtest và Tối ưu | `app.js:994-995,1096-1097` | **C** | Chỉ số thắng thua; ảnh cắt ghép | "Lệnh có lãi (mô phỏng)" và thêm dòng đầu bảng (U20) |
| U13 | "đạt chuẩn = ≥ 6 lệnh, thắng ≥ 50%, R TB sau phí > 0"; "Không điều kiện nào đạt chuẩn"; "Áp dụng: chỉ giữ n điều kiện đạt chuẩn" | `app.js:1095,1099,1100` | **C** | Đóng dấu "đạt chuẩn" lên chiến lược | "đủ ngưỡng thống kê tối thiểu của app (≥6 lệnh mô phỏng, ≥50% lệnh có lãi, R TB > 0) — không phải bảo chứng hiệu quả"; nút "Áp dụng: chỉ bật n điều kiện đủ ngưỡng" |
| U14 | Nhãn "**GIỮ / TẮT**" (cột Kết luận) và "→ BẬT/TẮT" | `app.js:1097-1098` | **C** | Phán quyết nên/không nên dùng | "Đủ ngưỡng" / "Chưa đủ ngưỡng" |
| U15 | "Công cụ **kiểm chứng**" + "đo trên … bằng dữ liệu Binance **thật**" | `index.html:137,138` | **V** | "Kiểm chứng" hàm ý xác thực; "thật" dễ bị đọc là kết quả giao dịch thật | "Công cụ mô phỏng" + "…chạy mô phỏng trên dữ liệu giá công khai của Binance trong quá khứ" |
| U16 | "Đã áp dụng ✓" | `app.js:1107` | **T** | Dấu ✓ trung tính (thao tác) | Giữ |
| U17 | Journal: "Kỷ luật theo chỉ báo — Chỉ vào khi app đủ điều kiện; đứng ngoài khi WAIT." ; "Không có tín hiệu mà vẫn vào lệnh = trừ điểm Kỷ luật" | `journal.js:6,89` | **C** | Hướng dẫn người dùng chỉ giao dịch theo app = tư vấn chiến lược | "Tuân thủ kế hoạch của bạn — Bạn tự đặt quy tắc vào/ra lệnh và ghi lại có tuân thủ không." ; "App không ghi nhận điều kiện nào ngày này. Mục này chỉ để bạn đối chiếu với kế hoạch của mình." |
| U18 | "Setup đúng", "Quản trị rủi ro — Đặt SL trước khi vào; mỗi lệnh rủi ro ≤ 1–2% tài khoản", "Chia nhỏ lệnh — Vào 2–3 phần…, không all-in" | `journal.js:7-9` | **V** | Hướng dẫn quản trị cụ thể (1–2%) như khuyến nghị | Đổi thành câu hỏi tự đánh giá: "Tôi có đặt SL trước khi vào không?" ; bỏ con số "1–2%" hoặc ghi "ví dụ do bạn tự đặt" |
| U19 | "Điểm: 92/100 · A", "Ngày hạng A", "Tổng PnL" xanh/đỏ | `journal.js:78,105,108`; `index.html:178` | **V** | Điểm hạng + lãi/lỗ dễ bị đọc là kết quả | Giữ trong app; **cấm xuất hiện trong ảnh Play** (đã có trong plan); ghi rõ "Điểm kỷ luật là tự đánh giá của bạn" |
| U20 | Thiếu cảnh báo ở đầu bảng Backtest/Tối ưu | `app.js:993,1095,997` | **C** | Có dòng cuối "mẫu nhỏ… chưa tính phí" (sai, xem L4) nhưng không có "kết quả quá khứ không bảo đảm" ngay phía trên bảng | Thêm dòng trên bảng: "Số liệu mô phỏng trên dữ liệu quá khứ; chưa phản ánh đầy đủ thanh khoản, trượt giá, lỗi kết nối. Kết quả quá khứ không bảo đảm kết quả tương lai." |
| U21 | "Chưa tính phí giao dịch và trượt giá." (backtest) | `app.js:997` | **V** | Sai thực tế (xem L4) | "Đã trừ phí và trượt giá ước tính 0,08%/lệnh." |
| U22 | "Nếu anh thấy dòng này trên khay thông báo…"; "anh" trong chẩn đoán | `app.js:1127,1130` | **T** | Xưng "anh" với người dùng/ khách mua mã nguồn | "Nếu bạn thấy…" |
| U23 | Thông báo chào "Cảnh báo đã bật. Giữ app mở để quét mỗi 15 phút và realtime." | `app.js:866` | **T** | "Cảnh báo" nên là "thông báo điều kiện kỹ thuật" | "Đã bật thông báo điều kiện kỹ thuật. Giữ app mở để quét." |
| U24 | Tiêu đề thẻ "CẢNH BÁO ĐỒNG PHA + BB" và `<meta description>` "cảnh báo tín hiệu" | `app.js:382`; `index.html:10` | **T** | `<meta description>` còn "SOLPHA — … cảnh báo tín hiệu." | "…theo dõi điều kiện kỹ thuật đa khung…" |
| U25 | Lỗi mạng: "Mất kết nối dữ liệu · mạng chậm hoặc app vừa chạy nền" + "Failed to fetch | Failed to fetch | Failed to fetch" | `app.js:576,639`; ảnh `real-01-signal.png` | **C (R2)** | Thông báo sai nguyên nhân khi vùng bị chặn; lộ lỗi thô | Xem R2 bên dưới |
| U26 | Điểm tốt đã có (giữ): "Kế hoạch tham khảo theo quy tắc kỹ thuật — không phải khuyến nghị đầu tư." (`index.html:61`), pill "Không phải lệnh sàn" (`index.html:121`), hộp "Trước khi dùng" (`index.html:260-271`), "Tự quản size/leverage…" (`index.html:255`) | | — | | Giữ, làm nổi hơn |

---

## 4. Đánh giá lại 3 rủi ro duyệt hàng đầu của `REVIEW-RISKS.md` bằng bằng chứng đo được

`REVIEW-RISKS.md` xếp R1 (tư vấn), R2 (khu vực chặn), R3 (số liệu hiệu quả/cảnh báo ở màn hình đầu) là Cao. Sau đo, thứ tự và nội dung đổi như sau.

**R2 (khu vực chặn Binance) → nâng lên rủi ro số 1, vì có bằng chứng trực tiếp.**
- Khi mọi host Binance không truy cập được (mô phỏng bằng sandbox 403), màn hình đầu hiển thị "Mất kết nối dữ liệu — mạng chậm hoặc app vừa chạy nền · đang tự thử lại" và dòng thô "Failed to fetch | Failed to fetch | Failed to fetch" (`real-01-signal.png`); thanh cặp toàn "…"; mọi tab khác trống. Một reviewer ở Mỹ (nơi Binance chặn, theo tài liệu app) sẽ thấy app **không có chức năng nào**.
- Thông báo riêng cho khu vực chặn ("Binance không phục vụ mạng này", `app.js:575-576`) chỉ hiện khi thông báo lỗi chứa `451` hoặc `403`. Nhưng `fetchJSON` chỉ có mã trạng thái khi phản hồi **đọc được** (`app.js:124`); phản hồi chặn địa lý của Binance/CDN thường không kèm CORS thì trình duyệt chỉ báo `Failed to fetch`. Bằng chứng trong sandbox: chặn ở tầng proxy cho đúng lỗi `Failed to fetch`, không có 403 trong thông báo. **Phản hồi 451 thật của Binance: CHƯA XÁC NHẬN (không truy cập được).** Nhiều khả năng thông báo địa lý không bao giờ hiện.
- App còn "dội" 252 request/25 giây (240 lỗi) khi bị chặn.
- Việc phải làm: (1) phân biệt "không kết nối được mọi host Binance" với "mất mạng"; (2) hiện thông báo trung thực: "Không tải được dữ liệu thị trường từ Binance trên mạng/khu vực này. Một số khu vực bị Binance chặn. Thử mạng khác hoặc VPN hợp pháp nơi bạn ở. [Thử lại]"; (3) ẩn lỗi thô; (4) giãn nhịp thử lại (backoff dài, dừng sau N lần), nhất là khi `document.visibilityState` ẩn; (5) video + email cho reviewer; (6) chọn quốc gia phân phối; (7) kiểm bằng thiết bị thật ở Mỹ/EU/VN (**CHƯA XÁC NHẬN**).

**R1 (tư vấn tài chính) → vẫn Cao, nhưng hộp "Trước khi dùng" đã giảm một phần.**
- Bằng chứng: ô hành động của app hiện "▲ LONG/▼ SHORT" cỡ lớn + giá vào, SL, TP, "Vào ngay…", "Khối lượng … ≈ $… · rủi ro $…" tính từ vốn người dùng nhập; nhật ký coi "chỉ vào khi app đủ điều kiện" là tiêu chí kỷ luật (`journal.js:6`); thông báo đẩy chứa giá vào/SL/TP (`app.js:523`). Các chuỗi U1–U11, U17 là điểm nóng. Google định nghĩa dịch vụ tài chính gồm quản lý/đầu tư tiền và tiền mã hoá, gồm tư vấn cá nhân hoá (đoạn trích tìm kiếm; nguyên văn CHƯA XÁC NHẬN). Việc "cá nhân hoá" ở đây là công thức theo số do chính người dùng nhập, nhưng "ĐANG GIỮ", "không vào mới" nói như thể người dùng có vị thế. Mức giảm sau sửa chuỗi: lớn; không loại bỏ hẳn nên Financial features declaration phải khai trung thực (D5).

**R3 (số liệu hiệu quả + thiếu cảnh báo ở màn đầu) → tách thành hai phần.**
- *Cảnh báo ở màn đầu:* **đã được xử lý** (hộp bắt buộc, đo được). Bỏ mục này khỏi danh sách Cao; cập nhật `REVIEW-RISKS.md` (checklist, R3.1).
- *Số liệu hiệu quả:* vẫn còn nguyên: cột "Thắng", "đạt chuẩn", "GIỮ/TẮT", "✓✓/✗" (U6, U12–U14). Rủi ro của **listing/ảnh** thấp (đã cấm), rủi ro **trong app** vừa-cao vì reviewer mở tab Công cụ. Ngoài ra bảng cho ra "100%" với 3 lệnh (đã đo: dòng M4H `3 | 100% | +1.09`, nhãn TẮT) — một mẫu quá nhỏ trình bày như một thống kê.

**Rủi ro #3 mới (không trong top 3 cũ): hồ sơ khai không khớp.** Thiếu `fapi1` trong chính sách quyền riêng tư, thiếu hosting/IP, `[EMAIL]`/pháp nhân chưa điền, `assetlinks` chưa điền, quyền AAB chưa kiểm, Financial features chưa quyết (D5, T3). Đây là kiểu từ chối "kỹ thuật/hồ sơ", dễ sửa nhưng chắc chắn xảy ra nếu bỏ qua.

---

## 5. Data safety và phát hành: đề xuất tóm tắt

- **Bản 1.0.0 không Pro:** có thể khai "Không thu thập" **nếu** chấp nhận rủi ro D1; nên (a) tự host Roboto, (b) sửa `privacy.html` P1–P5, P8, (c) giữ sẵn phương án dự phòng "Device or other IDs / IP, chia sẻ, App functionality" như `POLICY-ANSWERS.md` 1A để chuyển ngay nếu Play yêu cầu.
- **Bản có Pro:** khai thêm Purchase history **và Device or other IDs** (D4), sửa P9–P10, cập nhật listing Bản B **khi UI Pro có thật**.
- Giữ nguyên "không SDK, không cookie, không quảng cáo" — đo được ĐÚNG.

---

## 6. Đối chiếu chéo với các audit khác

- `docs/audit/BILLING-AUDIT.md`: **chưa tồn tại** ở mọi lần kiểm (đầu và cuối phiên). Không thể ghi mâu thuẫn trực tiếp; xem đối chiếu bằng đọc mã bên dưới.
- `docs/audit/BRAND-AUDIT.md`: **xuất hiện cuối phiên, đã đọc**. Đối chiếu:
  - **Nhất quán với tôi:** Cache Storage của bản Play chứa tệp ETEK (BRAND P1: 8 mục trùng byte với tệp ETEK, tôi đếm 22 mục tổng gồm cùng nhóm `manifest.webmanifest`, `icons/icon-*`, `maskable-*`, `apple-touch-icon`, `favicon-32`; chênh số tổng do điều kiện chạy khác nhau, không phải mâu thuẫn về bản chất); không có request tải `etek-logo.png` lúc chạy (BRAND mục 54 và đo của tôi); `index.html:39` còn alt "ETEK Power"; `icon.svg` gốc còn aria-label "SOLPHA · ETEK Power".
  - **Mâu thuẫn tài liệu:** `REVIEW-RISKS.md` R0 ghi "ĐÃ XỬ LÝ" trong khi BRAND P1 xếp NGHIÊM TRỌNG (theo tiêu chí "không dấu vết"). Cần sửa R0 sau khi sửa `sw.js`. Tôi giữ mức "ĐÃ XỬ LÝ MỘT PHẦN" (giao diện sạch, bộ nhớ chưa).
  - **BRAND bổ sung điều tôi không đo:** P2 (mở lại từ thông báo hoặc shortcut `/?scan=1` làm mất `source=play`, `sw.js:37`, `twa-manifest.json:26`) và P3 (URL `privacy.html`/`terms.html` dán vào Play Console không kèm `?source=play` nên hiện giao diện/ màu bản kia). P3 liên quan trực tiếp đến mục 2.1 (trang pháp lý là thứ reviewer mở đầu tiên). Tôi bổ sung vào T4: shortcut không chỉ vô nghĩa với `app.js` mà còn đổi thương hiệu. Không thấy mâu thuẫn số liệu nào khác.
- Đối chiếu billing bằng đọc mã (tạm thời, thay cho audit): backend **lưu** `deviceId` (UUID), băm và mã hoá purchase token, SKU, trạng thái, hạn (`worker/README.md`, `worker/src/index.js:425-463`, KV `ENT`). Điều này **không khớp** với `privacy.html` mục 4 ("chỉ nhận mã xác nhận mua hàng") và với `POLICY-ANSWERS.md` 1B/"Device IDs" (D4, P9). `POLICY-ANSWERS.md` 1B còn nói "Cloudflare Workers Logs/Logpush: tắt nếu không cần" nhưng `worker/wrangler.toml` không có `[observability]`; **CHƯA XÁC NHẬN** mặc định logs của tài khoản Cloudflare. Giới hạn tốc độ dựa IP (`index.js:596`) là xử lý tạm trong bộ nhớ.
- Brand: xem điểm đối chiếu BRAND-AUDIT ở trên (D13).
- Khi BILLING-AUDIT ra đời: đối chiếu trường dữ liệu Worker lưu ↔ Data safety (D4) và `privacy.html` mục 4 (P9).

---

## 7. Kết luận: **CHƯA SẴN SÀNG GỬI DUYỆT**

Các lời khai dưới đây ĐÚNG và đo được: không tài khoản, không quảng cáo/SDK/cookie/IndexedDB/POST, quyền thông báo và giữ sáng màn hình chỉ xin theo thao tác của người dùng, dữ liệu cá nhân (vốn, nhật ký) chỉ ở `localStorage`, 18+, hộp cảnh báo bắt buộc ở lần mở đầu. Phần "đúng sự thật" của hồ sơ khá chắc. Cái chưa đạt là các chỗ dưới đây.

**5 việc phải làm trước khi gửi:**

1. **Sửa trạng thái "Binance bị chặn/không kết nối"** (R2/U25): thông báo trung thực, bỏ lỗi thô, giãn nhịp thử lại; thử trên IP Mỹ/EU/VN; quay video luồng đầy đủ cho App access; chọn quốc gia phân phối.
2. **Đổi chuỗi giao diện rủi ro** theo mục 3 (ít nhất U1–U3, U5–U7, U9, U12–U15, U17, U20–U21) và chụp lại ảnh sau khi đổi; cập nhật `SCREENSHOT-PLAN.md` (S1–S9).
3. **Sửa `privacy.html` và hồ sơ khai**: P1, P2, P3, P4, P5, P8 (thêm `fapi1`, hosting/IP, Referer, Cache Storage); điền pháp nhân/email/website; dán URL pháp lý vào Play Console kèm `?source=play` (hoặc sửa `brand.js` để trang pháp lý luôn trung tính, theo BRAND P3), sửa `sw.js` precache (BRAND P1); tự host Roboto nếu muốn giữ nhãn "Không thu thập"; sửa D2, D6, D12 trong `POLICY-ANSWERS.md`; cập nhật `REVIEW-RISKS.md` (R3 đã xử lý, checklist).
4. **Chốt khai báo**: quyết định mục Financial features (D5), dán ghi chú reviewer; điền SHA-256 vào `assetlinks.json` (T3); build AAB và chạy `bundletool dump manifest` để xác nhận quyền (D8); kiểm `AD_ID`.
5. **Giữ Pro ra khỏi 1.0.0** và sửa tài liệu mâu thuẫn: không dùng Bản B/ghi chú Pro (D7, L17); sửa `LISTING-EN/VI` (M1–M3), `commercial/README.md` (M4–M6, M9), `LICENSE.md` §5 (M7); khi bật Pro thì sửa P9–P10 và Data safety (D4).

**Điểm cần người thứ hai kiểm** (CHƯA XÁC NHẬN trong phiên này): WebSocket thực sự mở được ở vùng có Binance; phản hồi chặn thật của Binance; nguyên văn chính sách Google (đặc biệt Financial features declaration hiện hành, định nghĩa "share" cho IP/Google Fonts, Subscriptions); quyền trong AAB; số test Worker (39).

---

## Nguồn đã tra (14/11/2026, chỉ đọc kết quả tìm kiếm)

- Financial Services: https://support.google.com/googleplay/android-developer/answer/9876821
- Cryptocurrency Exchanges and Software Wallets: https://support.google.com/googleplay/android-developer/answer/16329703
- Financial features declaration: https://support.google.com/googleplay/android-developer/answer/13849271
- Data safety (định nghĩa chia sẻ, nhà cung cấp dịch vụ): https://support.google.com/googleplay/android-developer/answer/10787469 và https://support.google.com/googleplay/answer/11416267
- Metadata policy và Misleading Claims: https://support.google.com/googleplay/android-developer/answer/9898842 , https://support.google.com/googleplay/android-developer/answer/9887877 , https://support.google.com/googleplay/android-developer/answer/13393723
- Subscriptions: https://support.google.com/googleplay/android-developer/answer/12154973
