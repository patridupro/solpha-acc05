# SOLPHA Futures Desk — Danh sách việc người bán PHẢI tự làm, và danh sách "đừng làm"

Ngày: **13/11/2026**. Dành cho người đứng tên bán. Những việc dưới đây tài liệu và AI **không làm thay được** (tài khoản, danh tính, thuế, ảnh/video thật, cam kết pháp lý). Đây không phải tư vấn pháp lý hay thuế; quyết định cuối cùng thuộc về bạn và người có chuyên môn.

Ký hiệu: ☐ = chưa làm. Mức ưu tiên: **[P0]** phải xong trước khi đăng bán, **[P1]** nên xong trong tuần đầu, **[P2]** tuỳ chọn.

---

## A. Pháp lý, thuế, hình thức kinh doanh (ở Việt Nam)

☐ **[P0] Chọn hình thức đứng tên bán**: cá nhân, hộ kinh doanh, hay công ty. Hỏi kế toán/thuế **trước** khi nhận đồng đầu tiên. Những điểm tra cứu được (đều từ bài tư vấn kế toán, **chưa đối chiếu văn bản gốc**, phải xác minh):
  - Từ 01/01/2026 bỏ thuế khoán đối với hộ kinh doanh, hộ phải kê khai; ngưỡng doanh thu không chịu thuế được nêu là 500 triệu đồng/năm (diễn đạt đơn giản hoá) [MISA, Tạp chí Kinh tế Tài chính].
  - Dịch vụ/phần mềm cung cấp cho tổ chức nước ngoài, tiêu dùng ngoài lãnh thổ và thanh toán qua ngân hàng bằng ngoại tệ có thể áp **thuế GTGT 0%** nếu đủ hồ sơ chứng minh (Nghị định 181/2025/NĐ-CP được viện dẫn) [VCI, hỏi đáp Bộ Tài chính 2025]. Bán qua nền tảng MoR có được coi là "bán cho tổ chức nước ngoài" hay không: **hỏi kế toán**.
  - Giữ chứng từ: bảng kê đơn từ nền tảng, sao kê PayPal/Payoneer, chứng từ rút về ngân hàng, hợp đồng/điều khoản nền tảng.
☐ **[P0] Ngoại hối và nhận tiền nước ngoài**: hỏi ngân hàng/kế toán về thủ tục khi rút tiền từ PayPal/Payoneer về tài khoản VND (chứng từ nguồn thu).
☐ **[P1] Luật sư rà**: (1) bán công cụ liên quan giao dịch phái sinh tiền mã hoá có cần giấy phép nào ở Việt Nam không (hướng dẫn nội bộ nhắc Luật Công nghiệp công nghệ số hiệu lực 01/01/2026 và Nghị quyết 05/2025/NQ-CP về thí điểm thị trường tài sản mã hoá; chưa kiểm chứng); (2) văn bản giấy phép `LICENSE`; (3) điều khoản mua bán; (4) chính sách hoàn tiền.
☐ **[P2] Đăng ký quyền tác giả phần mềm** nếu muốn có bằng chứng sở hữu (thủ tục và lệ phí: chưa xác nhận).
☐ **[P0] Điều khoản Binance**: đọc Terms of Use và API/Market Data terms hiện hành, **chụp màn hình có ngày**, ghi lại kết luận của bạn về việc tích hợp dữ liệu công khai vào sản phẩm bán (tra cứu 13/11/2026 không xác nhận được nội dung; xem `PLATFORMS.md` mục 3). Nếu không chắc, hỏi Binance bằng văn bản.
☐ **[P1] Điều khoản Google Play** nếu người mua/bạn sẽ đăng app tài chính: Financial features declaration, Metadata policy (đã có bản nháp trong `docs/play/`).

## B. Tài khoản, KYC, nhận tiền

☐ **[P0] PayPal Business** đã xác minh danh tính, liên kết ngân hàng VN; kiểm tra giới hạn nhận/rút và phí hiện hành tại trang PayPal Việt Nam. (Nhận quốc tế ~4,40% + phí cố định, rút về ngân hàng 60.000 đ/lần, chênh lệch tỷ giá 3–4% theo bên thứ ba, hãy đối chiếu.)
☐ **[P1] Payoneer** (tuỳ chọn): đăng ký, KYC; kiểm tra xem nền tảng bạn chọn có chi trả qua Payoneer không (Gumroad có bài hướng dẫn "Payoneer and Gumroad").
☐ **[P0] Tài khoản Gumroad**: xác minh danh tính/thuế theo yêu cầu, chọn phương thức chi trả. **Kiểm tra trên trang "Getting paid" xem Việt Nam có chi trả ngân hàng không; nếu không, dùng PayPal.**
☐ **[P1] Tài khoản Payhip**: kết nối PayPal; bật gửi file và license key (nếu có tính năng; xác nhận trong bảng điều khiển).
☐ **[P1] Envato (CodeCanyon)**: xem "Becoming an Envato Author" có đang nhận đơn hay không (đang tạm dừng/chọn lọc theo trang trợ giúp). Nếu mở: chuẩn bị Author ID check (giấy tờ), **mẫu W-8BEN** (người phi Mỹ; doanh thu từ người mua Mỹ có thể bị khấu trừ tới 30% nếu nước không có hiệp ước; nếu không nộp mẫu thì khấu trừ dự phòng 28% mọi đơn theo tài liệu cũ của Envato), tài liệu theo mẫu Envato.
☐ **[P1] Email chuyên dụng** cho bán hàng và hỗ trợ (không dùng email cá nhân), cùng tên miền với trang demo.
☐ **[P1] Bật 2FA** trên mọi tài khoản bán hàng và thanh toán; lưu mã khôi phục ngoại tuyến.

### Mẫu email hỏi trước (tiếng Anh, gửi support nền tảng; giữ câu trả lời)

```
Subject: Pre-approval question — source code of a market-data analysis web app

Hello,
I plan to sell the source code of "SOLPHA Futures Desk", a self-hosted Progressive Web App (HTML/CSS/vanilla JS). It displays public Binance futures price data and technical indicators, applies fixed rules to highlight candle conditions, and includes a position-size calculator, a backtest and a trade journal.
It is NOT a signal service, NOT a trading bot, does not place orders, does not handle exchange API keys, does not custody funds, and makes no profit claims. Buyers deploy it themselves. The listing carries an explicit "not investment advice / no guaranteed signals" warning.
Is this type of product allowed on your platform? If any part of it is restricted, please tell me which part and what changes would make it acceptable. I am based in Vietnam; please also confirm whether I can receive payouts there (bank or PayPal).
Thank you,
[YOUR NAME] — [YOUR EMAIL]
```

## C. Chuẩn bị gói bán (làm sạch mã nguồn)

☐ **[P0] Điền hoặc để rõ placeholder** (người mua sẽ phải điền; trong gói bán chỉ để dạng placeholder dễ tìm, đừng để thông tin thật của bạn):
  - `privacy.html`, `terms.html`: `[TÊN PHÁP NHÂN / CÁ NHÂN PHÁT HÀNH]`, `[EMAIL]`, `[WEBSITE]`.
  - `billing.js`: `API_BASE` đang là `https://solpha-billing.<subdomain>.workers.dev`.
  - `worker/wrangler.toml`: `THAY_BANG_ID_KV_NAMESPACE`, `PACKAGE_NAME`, `ALLOWED_ORIGINS`, `SKUS`.
  - `twa-manifest.json`: `packageId`, `host`, các URL icon/manifest, đường dẫn keystore.
  - `docs/play/LISTING.md`, `POLICY-ANSWERS.md`, `docs/GOOGLE-PLAY-GUIDE.md`: `[EMAIL]`, `[WEBSITE]`, `[TÊN PHÁP NHÂN]` và các ghi chú nội bộ.
☐ **[P0] Quét sạch thương hiệu và danh tính không thuộc SOLPHA** trong toàn bộ thư mục sẽ bán: tên công ty/đơn vị khác, logo (kể cả file ảnh trong `icons/`), tên tác giả, URL repo hoặc tài khoản GitHub cá nhân, email nội bộ, tên miền cũ. Cách làm: liệt kê các từ cần tìm (tên đơn vị cũ của bạn, tên tài khoản cá nhân, tên miền cũ), chạy `grep -ril <từ> .` không phân biệt hoa thường trên cả mã, tài liệu (README, `docs/`, `skills/`, `worker/`), manifest và tên file; xoá hoặc thay bằng placeholder; kiểm tra thêm các ảnh bằng cách mở từng file trong `icons/` và `play-assets/`.
☐ **[P0] Quét bí mật**: không có `android.keystore`, file JSON service account, token, `.env`, ID KV thật, khoá RTDN, `.git` chứa lịch sử có bí mật. Gói bán nên được tạo từ `git archive` hoặc thư mục sạch, **không** nén cả `.git`. Chạy công cụ quét bí mật (ví dụ gitleaks) trên cả lịch sử trước khi cân nhắc bàn giao kho git.
☐ **[P0] Chốt trạng thái kho mã**: lúc soạn tài liệu này, kho có thay đổi chưa commit (`worker/src/index.js`) và thư mục/file mới chưa theo dõi (`billing.js`, `docs/play/`, `worker/test/`). Phải commit/nghiệm thu trước khi đóng gói để gói bán trùng với mô tả.
☐ **[P0] Quyết định phần nào bán**: `skills/` và `dist/*.skill` (công cụ nội bộ/hướng dẫn triển khai) có nên nằm trong gói không; `docs/*.pdf` trùng bản `.md`. Chỉ đưa vào gói thứ bạn muốn người mua có.
☐ **[P0] Thêm file `LICENSE`** (Single/Extended, xem `PRICING.md`), `CHANGELOG.md` (lấy từ listing), `SUPPORT.md` (phạm vi hỗ trợ, thời gian trả lời, KHÔNG hỗ trợ giao dịch), `THIRD-PARTY.md` (phông Roboto tải qua Google Fonts: kiểm tra giấy phép hiện hành; không có thư viện JS bên thứ ba trong tài liệu hiện có, hãy tự xác minh bằng cách quét thư mục).
☐ **[P0] Chạy kiểm thử trên bản sạch**: `node tests/signals.test.js`; bộ test Worker (`node --test worker/test/worker.test.mjs worker/test/billing-client.test.mjs` cho 39 test); mở app từ hosting tĩnh thử (HTTPS), kiểm tra kết nối WebSocket `/market`, cài PWA, thông báo thử.
☐ **[P0] Một người khác cài thử theo tài liệu** trên máy trống (không có sẵn môi trường của bạn). Ghi mọi chỗ vấp và sửa tài liệu.
☐ **[P1] Bản tiếng Anh tối thiểu**: tài liệu hiện chủ yếu bằng tiếng Việt; làm một `QUICKSTART-EN.md` 1–2 trang (cách host, cách tuỳ biến thương hiệu, cách chạy test, các chỗ cần đổi trong `twa-manifest.json` và Worker). Bắt buộc nếu bán trên Gumroad cho khách quốc tế, nếu không sẽ có yêu cầu hoàn tiền.
☐ **[P1] Ghi rõ phiên bản và ngày** trong gói (`VERSION`), đặt tên file `solpha-futures-desk-v1.0.0.zip`, tính checksum SHA-256 và đưa vào trang bán.
☐ **[P1] Xác nhận hạn chế đã biết trung thực** (đã có trong listing): không có cảnh báo máy chủ 24/7; màn hình mua gói Play Billing chưa nối sẵn; UI chỉ tiếng Việt. Nếu bạn nối xong phần Billing trước khi bán, cập nhật listing, changelog và giá.

## D. Hình ảnh sản phẩm thật

☐ **[P0] Chụp 6–8 ảnh màn hình thật** từ bản chạy (không dựng giả):
  1. Màn hình chính với tab SOL/BTC/ETH/DOGE và bảng giá/chỉ báo.
  2. Bảng "Phân tích" đa khung 5M–1D.
  3. Kế hoạch vào lệnh (vốn mẫu 1.000 USDT, rủi ro 1%) — ghi chú "dữ liệu mẫu".
  4. Backtest và "Tối ưu 30 ngày" (kết quả như đang hiển thị, kèm cột nửa đầu/nửa sau; **không** cắt bỏ phần xấu).
  5. "Soi lại" một thời điểm.
  6. Nhật ký + điểm kỷ luật tháng.
  7. Cài đặt / nút cài app.
  8. (Tuỳ chọn) sơ đồ cấu trúc gói: app, Worker, TWA.
☐ **[P0] Quy cách ảnh**: màn hình điện thoại 390×844 (chụp ở DPR 2–3), máy tính 1280×800; PNG hoặc WebP nén; đặt tên có nghĩa; thêm chú thích "Ảnh dùng dữ liệu mẫu. Không phải tư vấn đầu tư."
☐ **[P0] Che hoặc dùng số mẫu cho** số dư thật, vị thế thật, email, tên tài khoản. Không lộ ghi chú nhật ký cá nhân.
☐ **[P0] Không có logo sàn hay ví** trong ảnh (xem mục "đừng làm").
☐ **[P1] Ảnh bìa** (1280×720 hoặc theo yêu cầu nền tảng): tên SOLPHA, dòng "Source code · PWA · Android TWA kit · Cloudflare Worker", nền tối thương hiệu. Có thể dựa vào `play-assets/feature-graphic-1024x500.png` (kiểm tra không còn yếu tố không thuộc SOLPHA).

## E. Video demo (60–90 giây)

☐ **[P0] Quay theo `DEMO-VIDEO-SCRIPT.md`** bằng bản chạy thật, màn hình thật. Xuất 1080p, ≤ 90 giây, có phụ đề (tiếng Anh nếu bán quốc tế), hạ âm nhạc nền để giọng rõ, **không số lãi/lỗ**.
☐ **[P1] Đăng lên** YouTube (công khai hoặc không liệt kê) và nhúng vào trang bán; lưu bản gốc.

## F. Demo URL

☐ **[P0] Dựng demo công khai** trên **tên miền/hosting của bạn** (không dùng địa chỉ cũ chứa tên đơn vị khác). Banner đầu trang: "Bản demo — dữ liệu công khai, không phải tư vấn đầu tư". Không bật Play Billing thật trong demo. Không để bất kỳ khoá/bí mật nào trong demo.
☐ **[P0] Kiểm tra demo** trên Chrome Android và máy tính, ở mạng thường và mạng di động; ghi chú rõ nếu dữ liệu không tải được ở vùng bị Binance chặn.
☐ **[P1] Theo dõi**: bật thống kê trang (không thu thập dữ liệu cá nhân, phù hợp trang quyền riêng tư của bạn).

## G. Tài liệu và trang bán

☐ **[P0] Dán listing** từ `LISTING-EN.md` / `LISTING-VI.md`, thay `[REFUND POLICY]` bằng chính sách thật; đặt giá theo `PRICING.md`.
☐ **[P0] Chính sách hoàn tiền rõ ràng, hiển thị trước khi mua**. Lưu ý: nhiều nền tảng có quy định hoàn tiền riêng (Envato theo trang Refund Rules; nền tảng MoR theo điều khoản của họ, chưa đọc chi tiết 2026) và hoàn tiền có thể do nền tảng quyết định chứ không chỉ bạn.
☐ **[P0] Mô tả đúng sự thật**: không nâng cấp tính năng chưa có (đặc biệt Play Billing), không ghi "đã được kiểm chứng lợi nhuận".
☐ **[P1] Quy trình hỗ trợ**: hộp thư riêng, mẫu trả lời, cách xác minh người mua, giới hạn phạm vi (cài đặt/lỗi mã, không giao dịch).
☐ **[P1] Quy trình cập nhật**: ai nhận bản mới, kênh thông báo, ghi lại thay đổi endpoint Binance (đã đổi năm 2026).
☐ **[P2] Bảng theo dõi doanh số/chi phí/thuế** theo tháng.

---

## H. ĐỪNG LÀM

1. **Đừng hứa hay ám chỉ lợi nhuận**: không "kiếm tiền", "thu nhập thụ động", "x% mỗi tháng", "tỷ lệ thắng", "chính xác", "chắc thắng", "đã kiểm chứng lợi nhuận". Cả trong tiêu đề, tag, ảnh, video, bình luận, tin nhắn riêng. Nhiều nền tảng (Payhip cấm "làm giàu nhanh"; Gumroad cấm "đầu tư vì lợi ích thương mại"; Paddle cấm tín hiệu) coi đây là lý do khoá.
2. **Đừng đăng ảnh P&L**, ảnh chụp lệnh thắng, số dư tăng, bảng xếp hạng lợi nhuận, kết quả backtest cắt chọn lọc.
3. **Đừng dùng logo hay tên Binance** làm thương hiệu, ảnh bìa, biểu tượng, tên miền, tên sản phẩm; chỉ ghi tên dạng chữ để mô tả nguồn dữ liệu, kèm câu "không liên kết". Cũng đừng dùng logo Google/Google Play ngoài mục đích mô tả tương thích theo hướng dẫn nhãn hiệu của họ.
4. **Đừng để sót tên, logo, tài khoản hay địa chỉ của đơn vị khác** (hoặc của bạn nếu bạn không muốn lộ) trong gói bán, tài liệu, ảnh, metadata file, lịch sử git.
5. **Đừng bán "tín hiệu"** hay dịch vụ nhóm, copy trade, quản lý vốn, đăng ký nhận tín hiệu cùng với mã nguồn này. Đừng đóng vai tư vấn viên.
6. **Đừng nói app "tự động giao dịch"** hay "bot". Nó không đặt lệnh.
7. **Đừng khẳng định Play Billing hoàn chỉnh** nếu chưa nối màn hình mua và chưa thử trên Play. Đừng nói "chạy 24/7" cho cảnh báo.
8. **Đừng mua đánh giá, mua phiếu bầu (Product Hunt), tạo tài khoản ảo để khen**, hay thưởng người đánh giá điều kiện "5 sao".
9. **Đừng bán cùng một giấy phép cho nhiều người dưới một giá "Single" rồi cho phép họ chia sẻ**; đừng bán lại cho bên thứ hai mã nguồn đã bán độc quyền (nếu sau này bán trọn gói qua kênh khác).
10. **Đừng lách phí** bằng cách dẫn khách mua ngoài nền tảng (Gumroad có điều khoản chống lách phí; Envato cũng cấm) nếu bạn đang bán trong chính nền tảng đó.
11. **Đừng tạo nhiều tài khoản** để vòng qua việc bị khoá (nhiều nền tảng cấm đăng ký lại sau khi bị khoá).
12. **Đừng giữ số dư lớn** trên một nền tảng có rủi ro bị giữ tiền; rút theo đợt.
13. **Đừng dùng email/số điện thoại cá nhân** công khai nếu không cần; đừng công khai thông tin khách hàng.
14. **Đừng quảng cáo ở nhóm cấm** bán hàng/crypto, và đừng spam; đọc luật nhóm trước.
15. **Đừng cam kết cập nhật vĩnh viễn** hoặc thời gian phản hồi bạn không thực hiện được.
16. **Đừng đăng lên kênh khác với mô tả khác nhau**; giữ một nguồn sự thật (file `LISTING-*.md`).

---

## I. Sau khi bán

☐ Gửi hoá đơn/biên nhận theo yêu cầu thuế (nếu hình thức kinh doanh cần).
☐ Ghi nhật ký mỗi đơn: mã đơn, gói, giấy phép, hạn hỗ trợ.
☐ Theo dõi hoàn tiền và lý do để sửa tài liệu.
☐ Định kỳ kiểm tra Binance có đổi endpoint/điều khoản không, và chính sách nền tảng bán (đổi nhiều trong 2026: Envato đổi cấu trúc phí 07/2026; Lemon Squeezy đang chuyển sang Stripe).
