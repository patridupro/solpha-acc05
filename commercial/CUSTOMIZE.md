# Tuỳ biến — SOLPHA Futures Desk

Mọi thứ dưới đây là sửa tệp văn bản thường. Sau khi sửa, thử bằng `python3 -m http.server 8080`, rồi deploy lại. Nếu đã có người dùng cài app, tăng tên cache trong `sw.js` (`const CACHE = "solpha-c1.0.0"` → `"solpha-c1.0.1"`) để mọi thiết bị nạp bản mới.

## 1. Đổi cặp mặc định

Trong `app.js` (đầu tệp, gần dòng `const DEFAULT_PAIRS`):

```js
const DEFAULT_PAIRS = ["SOL", "BTC", "ETH", "DOGE"];
```

- Chỉ ghi mã coin (chữ in hoa, 2–12 ký tự); app tự ghép `USDT` (ví dụ `BNB` → `BNBUSDT`, hợp đồng vĩnh cửu USDT-M trên Binance Futures). Cặp phải tồn tại trên Binance Futures.
- Cặp đầu tiên của danh sách là cặp mở đầu cho người dùng mới.
- Danh sách này chỉ là **giá trị khởi tạo**. Người dùng đã dùng app có danh sách riêng lưu trong `localStorage` (khoá `solpha_pairs`), nên đổi mặc định không ảnh hưởng họ. Người dùng tự thêm/xoá cặp bằng nút `＋` trên thanh cặp (có gợi ý trong `<datalist id="coinList">` ở `index.html`; sửa danh sách gợi ý ở đó).
- Giữ nguyên tiền tố khoá `solpha_` trong `localStorage` nếu bạn không muốn người dùng cũ mất cài đặt/nhật ký. Nếu bạn đổi tiền tố, họ sẽ như người dùng mới.

## 2. Đổi quy tắc tín hiệu — `signals.js`, đối tượng `DEFAULTS`

Mỗi tham số dưới đây là giá trị mặc định khi quét/backtest. Cài đặt trong app (bật/tắt setup từng cặp) ghi đè các cờ `setups` và vài bộ lọc; còn số ngưỡng thì sửa tại đây (hoặc truyền `opt` khi gọi `evaluate`).

**Nến tín hiệu (dùng chung):**

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `atrMin`, `atrMax` | 1.3, 3 | Range (cao − thấp) của nến tín hiệu phải nằm trong khoảng [1.3, 3] × ATR(14). Nhỏ quá = nến yếu; lớn quá = đã chạy xa, đuổi giá |
| `closeZone` | 0.25 | Nến phải đóng trong 25% trên (Long) hoặc 25% dưới (Short) của range |
| `volMult` | 1.5 | Volume nến ≥ 1.5 × trung bình 20 nến |
| `rsiMax`, `rsiMin` | 75, 25 | Không Long khi RSI > 75; không Short khi RSI < 25 |
| `emaDistATR` | 1.5 | Giá đóng cửa không được xa EMA21 quá 1.5 × ATR (tránh đuổi giá) |

**Long (Setup A / B):**

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `pullbackLookback` | 6 | Setup A: trong 6 nến gần nhất giá đã chạm BB giữa (hồi về rồi bật lên) |
| `squeezePct` | 0.2 | Setup B: độ rộng Bollinger ≤ phân vị 20% của 100 nến gần nhất (đã nén) rồi đóng vượt BB trên |

**Quản lý lệnh (kế hoạch tham khảo):**

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `slATR` | 0.5 | SL = đáy (Long) / đỉnh (Short) nến tín hiệu ∓ 0.5 × ATR |
| `maxRiskATR` | 2 | Bỏ tín hiệu nếu khoảng cách từ giá vào trung bình tới SL > 2 × ATR |
| `tp1R`, `tp2R` | 1.5, 3 | TP1 = 1.5R, TP2 = 3R (R = khoảng rủi ro) |
| `feeRate` | 0.0008 | Phí + trượt giá cả vào và ra (≈ 0.04% × 2), trừ vào R của mỗi lệnh trong backtest |

**Bộ lọc thời gian và xu hướng lớn:**

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `sessionFilter` | true | Tránh giờ nhiễu (UTC): quanh funding 00/08/16h ±10′, tin Mỹ 12:30 và 13:30 ±15′, thanh khoản thấp 20:00–23:00 |
| `allowBandWalk` | true | Khi khung lớn chạm dải BB ngoài, vẫn cho vào nếu đang "bám dải" (xu hướng mạnh thật), với ½ khối lượng |
| `walkRsiMax`, `walkRsiMin` | 75, 25 | RSI 1H tối đa/tối thiểu cho phép khi bám dải |
| `walkMaxExtATR` | 0.5 | Giá không vọt quá 0.5 × ATR khỏi dải 1H |
| `walkSize` | 0.5 | Tỷ lệ khối lượng khi vào theo bám dải |
| `setups` | `{A,B,S1,S2,S3: true}` | Bật/tắt từng setup toàn cục (app còn có công tắc theo từng cặp trong Cài đặt) |

**Short (bộ riêng vì crypto giảm nhanh, hồi nông):**

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `sMinATR`, `sVol` | 1.2, 1.3 | S1: range nến ≥ 1.2 × ATR, volume ≥ 1.3 × TB |
| `s2MinATR`, `s2Vol`, `s2Lookback` | 1.3, 1.5, 12 | S2: thủng đáy 12 nến, range ≥ 1.3 × ATR, volume ≥ 1.5 × TB (vào ½ khối lượng) |
| `sBounceLookback` | 6 | S1: trong 6 nến gần nhất có nhịp hồi chạm EMA21/BB giữa |
| `sSlATR`, `sMaxRiskATR` | 0.3, 2.5 | SL Short sát hơn (0.3 × ATR); bỏ lệnh nếu rủi ro > 2.5 × ATR |
| `s2RsiMin` | 20 | RSI tối thiểu cho S2 |
| `sCrashATR` | 3 | Chặn Short nếu trong 3 nến trước đó có nến range > 3 × ATR (vừa có cú sập lớn, chờ hồi) |
| `sH1RsiMin` | 25 | Chặn Short nếu RSI 1H < 25 (quá bán) |
| `fundingMin` | −0.0003 | Chặn Short khi funding âm sâu hơn −0.03% (Short đông, dễ squeeze) |
| `sTimeStopBars` | 24 | Quá 24 nến mà chưa có kết quả thì thoát (time-stop) |

**Short điều chỉnh / Momentum 4H:**

| Tham số | Mặc định | Ý nghĩa |
|---|---|---|
| `allowCorrective` | true | Cho Short "điều chỉnh": 1D còn tăng nhưng giá đã thủng BB giữa 1D (½ khối lượng) |
| `shortRegime` | `"all"` | Chỉ dùng cho backtest: `"all"`, `"trend"` hoặc `"corrective"` |
| `allowMomentum4H` | true | Cho setup M4H: 4H và 1H đang giảm, 15M và 5M cùng chạm BB dưới (½ khối lượng) |
| `m4hRsiMin`, `m4hRsiMax` | 10, 90 | Giới hạn RSI cho M4H |
| `m4hSlATR`, `m4hMaxRiskATR` | 0.3, 2 | SL và mức rủi ro tối đa cho M4H |
| `m4hTimeStopBars` | 12 | Time-stop của M4H (số nến) |

Cách làm an toàn:
1. Sửa một tham số, chạy `node tests/signals.test.js`. Test khẳng định các hành vi cốt lõi (ví dụ TP1 = giá vào − 1.5R, funding quá âm chặn Short); nếu bạn **cố ý** đổi hành vi, sửa các con số trong test cho khớp.
2. Dùng tab **Công cụ → Backtest 5M** và **Tối ưu 30 ngày** để xem tác động trên dữ liệu thật trước khi phát hành. Kết quả quá khứ không bảo đảm tương lai.
3. Không quảng cáo tỷ lệ thắng/lợi nhuận mà bạn không thể chứng minh; xem mục cảnh báo trong `README.md`.

Thêm một setup mới: thêm logic vào hàm `evaluate` trong `signals.js` (trả về `side`, `setup` và `plan`), thêm cờ vào `DEFAULTS.setups`, thêm ô chọn trong tab Cài đặt của `index.html` và danh sách `SETTING_CHECKS` trong `app.js`.

## 3. Thêm cặp

- **Cho người dùng:** nút `＋` trên thanh cặp, nhập mã coin (ví dụ `BNB`).
- **Là mặc định:** thêm vào `DEFAULT_PAIRS` (mục 1) và, nếu muốn gợi ý, vào `<datalist id="coinList">` trong `index.html`.
- Cặp mới tự dùng bộ tham số `DEFAULTS` chung. Cài đặt bật/tắt setup được lưu riêng theo cặp.
- Chỉ hỗ trợ hợp đồng `<COIN>USDT` trên Binance USDT-M Futures. Muốn dùng sàn khác, bạn phải sửa phần gọi API trong `app.js` (địa chỉ `fapi.binance.com`, `fstream.binance.com`) và các trường dữ liệu tương ứng; cập nhật `privacy.html` cho khớp.

## 4. Ngôn ngữ

Giao diện hiện bằng tiếng Việt, viết thẳng trong mã (không có hệ thống i18n). Để dịch:
1. Đổi `lang="vi"` trong `index.html`, `privacy.html`, `terms.html` và `"lang": "vi"` trong `manifest.webmanifest`.
2. Dịch chuỗi trong `index.html` (nhãn, nút, tiêu đề các tab, đoạn rule cố định).
3. Dịch chuỗi động trong `app.js`, `journal.js` và các lý do/ghi chú tín hiệu trong `signals.js` (ví dụ `"giờ ra tin Mỹ"`, `"chưa đồng pha"`, `"đi ngang"`). Tìm bằng cách tìm các chuỗi có dấu tiếng Việt.
4. **Cẩn thận:** `signals.js` dùng vài giá trị chuỗi làm **mã logic**, không chỉ để hiển thị (`"tang"`, `"giam"`, `"sideway"`, `"long"`, `"short"`); đừng đổi các mã này, chỉ đổi bảng hiển thị như `DIR_VI`. Sau khi dịch, chạy `node tests/signals.test.js` và mở từng tab để rà lỗi.
5. Dịch `privacy.html`, `terms.html` (đã có tóm tắt tiếng Anh ở cuối mỗi trang) và nhờ luật sư soát bản dịch.
6. Cập nhật `description` và `shortcuts` trong `manifest.webmanifest`, và hồ sơ cửa hàng `docs/play/LISTING.md`.

## 5. Thương hiệu: tên, màu, logo

| Việc | Tệp | Chi tiết |
|---|---|---|
| Tên app | `index.html` | `<title>`, `<h1>` trong `.brand`, `alt` của ảnh logo, `<meta name="apple-mobile-web-app-title">`, `<meta name="description">` |
| Tên app | `manifest.webmanifest` | `name`, `short_name`, `description` |
| Tên app | `privacy.html`, `terms.html` | Tiêu đề và đoạn mô tả |
| Tên app | `brand.js` | trường `name` |
| Tên Android | `twa-manifest.json` | `name`, `launcherName`, `packageId` |
| Màu nền, thẻ, chữ, viền | `styles.css` (khối `:root`) và `solpha-theme.css` (khối đầu `html[data-brand="solpha"]`) | `--bg`, `--card`, `--line`, `--text`, `--muted`, `--tint`, `--raise`, `--soft` |
| Màu nhấn | cùng hai khối | `--brand` (nhấn chính), `--brand-dark`, `--cyan`, `--violet`, `--lime`, `--gold` |
| Màu trạng thái | cùng hai khối | `--up` (tăng/Long), `--down` (giảm/Short), `--warn` (cảnh báo) |
| Chữ gradient của tên | `solpha-theme.css` | luật `.brand h1`, `.legal h1` (`linear-gradient(90deg, #3ecbff, #9b5cff)`) |
| Hào quang nền | `solpha-theme.css` | luật `.bg` (3 `radial-gradient`) |
| Màu thanh trình duyệt | `index.html`, `privacy.html`, `terms.html` | `<meta name="theme-color" content="#07080c">` |
| Màu splash/PWA | `manifest.webmanifest` | `theme_color`, `background_color` |
| Màu Android | `twa-manifest.json` | `themeColor`, `navigationColor`, `backgroundColor`... |
| Logo/icon | `icons/icon.svg` | Nguồn vector (512×512). Sửa rồi chạy `node tools/make-icons.js` để sinh `icon-192/512.png`, `maskable-192/512.png`, `apple-touch-icon.png`, `favicon-32.png` |
| Ảnh cửa hàng Google Play | `tools/play-assets.js` | Sửa chữ/màu trong tệp rồi `node tools/play-assets.js` để sinh lại `play-assets/` |

Các màu trạng thái dùng cả trong `rgba(...)` ở `solpha-theme.css` (ví dụ `rgba(62,224,160,.14)` là `--up` với độ mờ). Nếu đổi `--up` hoặc `--down`, tìm và đổi các `rgba` tương ứng để đồng bộ.

## 6. Lưu ý khi tách sản phẩm của bạn

- Giữ nguyên thông báo bản quyền/giấy phép theo `LICENSE.md` trong kho mã riêng của bạn.
- Sau khi đổi tên thương hiệu, thay mọi chuỗi cũ trong `docs/play/LISTING.md`, `privacy.html`, `terms.html`.
- Chạy lại `node tests/signals.test.js` mỗi lần sửa `signals.js`.
