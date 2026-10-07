# SOLPHA — SOL/USDT Perpetual Desk

PWA theo dõi SOL/USDT futures đa khung (5M, 15M, 1H, 4H, 1D), RSI / EMA / Bollinger, cảnh báo khi **đồng pha + chạm band**.

## Link đang chạy

https://solpha.pages.dev — Cloudflare Pages build từ nhánh `claude/intelligent-lamport-vrk29w` của repo này (1 build mỗi lần push). Đường dẫn trong app đều tương đối nên vẫn chạy được nếu sau này chuyển sang GitHub Pages/Netlify.

## Playbook cho app sau

Xem [`docs/PWA-DEPLOY-GUIDE.md`](docs/PWA-DEPLOY-GUIDE.md) (bản PDF: `docs/PWA-DEPLOY-GUIDE.pdf`) · skill Claude: `skills/pwa-deploy/` · tạo icon: `node tools/make-icons.js`.

## Deploy lên Cloudflare Pages (miễn phí, link chính: https://solpha.pages.dev)

1. dash.cloudflare.com → **Workers & Pages → Create → tab Pages → Connect to Git** → chọn `patridupro/solpha-acc05`.
2. Production branch: nhánh chính của repo. Framework preset: **None**. Build command: **để trống**. Build output directory: **để trống** (gốc repo).
3. **Save and Deploy** → link dạng `https://<tên-project>.pages.dev`.
4. Header/cache cho service worker nằm trong `_headers`, redirect trong `_redirects` (Cloudflare tự đọc).

## Deploy lên Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/patridupro/solpha-acc05)

1. app.netlify.com → **Add new site → Import an existing project → GitHub** → chọn `patridupro/solpha-acc05`.
2. Branch: `main` (hoặc nhánh đang dùng). Build command: **để trống**. Publish directory: `.` — đã cấu hình sẵn trong `netlify.toml`.
3. **Deploy site** → đổi tên site tại *Site configuration → Change site name* (vd `solpha-desk` → `https://solpha-desk.netlify.app`).
4. Mỗi lần push, Netlify tự deploy lại; service worker network-first nên app trên điện thoại tự cập nhật bản mới.

## Cài lên Chrome Android
1. Mở link `https://<site>.netlify.app` bằng Chrome.
2. Bấm nút **Cài app** trong app, hoặc menu ⋮ → **Thêm vào màn hình chính / Cài đặt ứng dụng**.
3. Mở app từ icon SOLPHA → bấm **Bật cảnh báo** → cho phép thông báo.
4. Giữ app mở (chạy nền) để quét mỗi 5 phút và mỗi giờ.

## Checklist PWA đã đạt
- Manifest có `id`, `start_url`, `scope`, icon PNG 192/512 + maskable (bắt buộc cho WebAPK trên Android).
- Service worker kiểm soát trang, có offline fallback, cache tự làm mới khi deploy.
- Thông báo dùng `ServiceWorkerRegistration.showNotification` (Chrome Android không hỗ trợ `new Notification()`).
- Kiểm tra bằng Chromium DevTools Protocol `Page.getInstallabilityErrors` → **0 lỗi**.

## Rule
- Đồng pha = 1D + 4H + 1H cùng hướng EMA9/21, 15M không ngược mạnh. MACD(12,26,9) chỉ hiển thị để tham khảo (đã bỏ khỏi điều kiện vì làm lỡ nhiều cơ hội).
- Cảnh báo khi đồng pha và chạm BB trên ≥2 khung, có ≥1 khung ≥1H.
- Nến tín hiệu (nến **đã đóng** 5M/15M, quét ngay sau mỗi mốc 5 phút) — bộ máy trong `signals.js`, dùng chung cho quét trực tiếp và backtest:
  - Xu hướng: EMA 1D/4H/1H cùng hướng. 4H/1D ở BB trên (Long) / BB dưới (Short) = chase, chặn.
  - 1H ở dải ngoài **vẫn cho vào nếu đang bám dải**: BB 1H mở rộng so với 3 nến trước, RSI 1H ≤ 75 (Long) / ≥ 25 (Short), giá không vượt dải quá 0.5 ATR → lệnh **Momentum, ½ khối lượng**. Tắt được trong Cài đặt; backtest có dòng "chặn cứng 1H BB" để so sánh.
  - Nến: range 1.3–3 × ATR(14), đóng ở 25% trên (Long) / dưới (Short); volume ≥ 1.5 × TB20; RSI ≤ 75 (Long) / ≥ 25 (Short).
  - **Setup A** (pullback): trong 6 nến đã chạm BB mid, nến tín hiệu đóng lại trên (dưới) mid; cách EMA21 ≤ 1.5 ATR.
  - **Setup B** (bứt phá sau nén): độ rộng BB nến trước ≤ phân vị 20% của 100 nến, nến đóng vượt BB trên (thủng BB dưới); cách EMA21 ≤ 2.5 ATR.
  - Tránh giờ funding (07/15/23h VN ±10′), tin Mỹ (19:30/20:30 VN ±15′), 03–06h VN.
  - Kế hoạch: vào 3 phần (giá đóng / hồi 50% nến / BB mid), SL = đáy (đỉnh) nến ∓ 0.5 ATR, bỏ lệnh nếu rủi ro > 2 ATR, TP1 = 1.5R (dời SL về giá vào), TP2 = 3R hoặc BB 1H nếu cản gần hơn. Khối lượng = vốn × % rủi ro ÷ (giá vào TB − SL).
  - **Short — bộ riêng** (crypto giảm nhanh, hồi nông nên không đối xứng với Long): 1D/4H/1H giảm + **15M giảm** + giá dưới EMA21 1H; nến ≥ 1.2×ATR đóng ở 25% dưới.
    - **S3** (1H vừa chạm BB trên rồi thất bại) → **S1** (6 nến trước đã hồi chạm EMA21/BB mid, nến đóng dưới EMA21, volume ≥ 1.3×, RSI 5M ≥ 25) → **S2** (đóng dưới đáy 12 nến, ≥ 1.3×ATR, volume ≥ 1.5×, RSI 5M ≥ 20, **½ khối lượng**). App thử theo thứ tự này và lấy setup đầu tiên có rủi ro hợp lệ.
    - Không Short khi: funding ≤ −0.03%/8h, RSI 1H < 25, vừa có nến > 3×ATR (so với ATR trước nến đó), 4H/1D ở BB dưới; 1H ở BB dưới chỉ cho khi đang bám dải (½ khối lượng).
    - SL = đỉnh nhịp hồi + 0.3 ATR (S2: đỉnh nến + 0.3 ATR), bỏ nếu rủi ro > 2.5 ATR. TP1 = 1.5R **chốt ½** + dời SL về giá vào, TP2 = 3R hoặc BB dưới 1H. **Quá 2 giờ chưa TP1 thì thoát.**
  - Backtest tách Long/Short và từng setup, kèm "lý do bị loại nhiều nhất". Backtest Short bỏ qua bộ lọc funding (Binance không trả funding lịch sử theo nến).
  - Bộ cũ (range ≥ $0.55) vẫn chọn được trong Cài đặt. Nút **Backtest** so 4 bộ trên ~1.500 nến 5M thật (vào ở giá đóng, chốt 1.5R, tối đa 4 giờ, nến chạm cả SL/TP tính thua, chưa tính phí).

## Nhật ký giao dịch & tổng kết tháng
- Mỗi ngày chấm 5 tiêu chí (Đạt / Không / N/A), trọng số: **Kỷ luật theo chỉ báo 30 · Setup đúng 25 · Quản trị rủi ro 20 · Chia nhỏ lệnh 15 · Không FOMO/gỡ/chase 10**.
- Điểm ngày = tổng trọng số Đạt ÷ tổng trọng số áp dụng (bỏ N/A). Hạng A ≥ 85 · B ≥ 70 · C ≥ 50 · D < 50. Ngày "Đứng ngoài" tự để N/A cho Setup/Rủi ro/Chia nhỏ — đứng ngoài đúng lúc vẫn đạt Kỷ luật.
- Tổng kết tháng: số ngày đạt từng tiêu chí, điểm TB, số ngày hạng A, chuỗi kỷ luật dài nhất, tổng PnL, checklist từng ngày. Xuất CSV, sao lưu/khôi phục JSON.
- Dữ liệu lưu trên máy (localStorage) — sao lưu định kỳ.

- Không phải tư vấn tài chính. Tự quản size/leverage.
