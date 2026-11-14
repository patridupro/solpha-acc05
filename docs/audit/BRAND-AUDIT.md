# Kiểm toán độc lập: rò rỉ nhận diện ETEK (gói thương mại + bản Google Play)

Ngày: 2026-11-14 · Commit: 80162b6 · Người kiểm: agent độc lập, không dùng script kiểm tra của người xây gói.
Tiêu chí: gói bán và bản Play (`/?source=play`, TWA) không được chứa dấu vết ETEK (tên, logo, màu #189848, "Tân Phát", "Hội tụ tinh hoa"). Bản web thường được phép giữ ETEK.

## KẾT LUẬN

- **(i) Gói thương mại: ĐẠT** (0 rò rỉ; chỉ có ghi chú về độ yếu của script quét của người xây).
- **(ii) Bản Play: KHÔNG ĐẠT** theo tiêu chí "không dấu vết": giao diện hiển thị thì sạch, nhưng service worker nạp sẵn (precache) 7 tệp ETEK vào bộ nhớ thiết bị Play, và có 3 đường mở app mất nhận diện solpha (thành ETEK). Không có mục nào nghiêm trọng về hình ảnh đang hiển thị trên luồng chính.

| # | Mức | Phạm vi | Tóm tắt |
|---|-----|---------|---------|
| P1 | NGHIÊM TRỌNG (theo tiêu chí "không dấu vết") | Bản Play | `sw.js` precache icon/manifest ETEK vào CacheStorage trên máy dùng Play |
| P2 | TRUNG BÌNH | Bản Play | Bấm thông báo / shortcut `/?scan=1` mở trang không có `source=play` thành giao diện ETEK |
| P3 | TRUNG BÌNH | Play Console | URL privacy/terms/gốc không kèm tham số hiển thị màu + favicon ETEK |
| P4 | TRUNG BÌNH | Hướng dẫn | `GOOGLE-PLAY-GUIDE.md:42` bảo nhập Theme color `#189848` cho TWA |
| P5 | THÔNG TIN | Bản Play | Mã nguồn tĩnh phục vụ cho Play vẫn chứa chuỗi ETEK; tệp ETEK truy cập được cùng origin |
| P6 | THÔNG TIN | Gói bán | Script quét của `build-commercial.js` bị lách dễ (gói hiện tại vẫn sạch) |
| P7 | THÔNG TIN | Cả hai | Điều chưa xác minh được trên thiết bị thật |

---

## 1. Gói thương mại: `dist/solpha-futures-desk-v1.0.0.zip`

Lệnh: `node tools/build-commercial.js` chạy thành công (zip 451965 byte, 42 mục, SHA-256 `d6f62e78…c730`, thông điệp "Quét rò rỉ: SẠCH"). Tôi giải nén vào `/tmp/audit-zip` và tự quét.

Đã kiểm, kết quả đều sạch:
- **Tên tệp** (`find | grep -iE 'etek|tan.?phat|hoi.?tu|tien.?phong'`): 0.
- **Nội dung văn bản** không phân biệt hoa thường (`etek`, `tân phát`, `tan phat`, `hội tụ`, `tiên phong`, `189848`, `24,152,72`, `rgb(24 152 72)`, `#1898`): chỉ trúng 1 chuỗi vô hại `app.js:616` "…100 nến là đủ **hội tụ**" (hội tụ số liệu ATR, không phải slogan). 0 trúng thật.
- **Quét chống lách** (script `decode-scan.py` ở scratchpad): giải entity HTML, `\uXXXX`/`\xXX`, url-decode, gộp `"ET"+"EK"`, bỏ ký tự zero-width, giải base64/hex, đảo chuỗi, regex `e\W{0,3}t\W{0,3}e\W{0,3}k`. Kết quả: chỉ 2 trúng giả `store.delete(k)` (sw.js, worker/src/index.js). Không có `hsl()`; không có màu hex/rgb nào nằm gần xanh ETEK (hue≈141°, bão hòa>0.6). Màu xanh trong gói là `#3ee0a0` (SOLPHA).
- **Kiểm chứng chính công cụ quét**: chèn mẫu lách (entity, nối chuỗi, hsl, base64, slogan, logo ETEK đổi tên) vào thư mục thử: công cụ của tôi bắt được tất cả, nên kết quả sạch ở trên đáng tin.
- **PNG** (8 tệp trong `icons/`, `play-assets/`): chunk chỉ có IHDR/IDAT/IEND, không có tEXt/zTXt/iTXt/eXIf; `strings` không có ETEK. **Pixel** (đọc canvas Chromium, tôi đã xác nhận bộ quét bắt đúng `icons/etek-logo.png` = 44,8% xanh ETEK + 52% pixel đỏ, và `icons/icon-512.png` ETEK = 81% xanh): tất cả 8 PNG trong gói = **0 pixel** xanh ETEK, 0 pixel đỏ logo. **Nhìn bằng mắt** (Read): `icons/icon-512.png`, `maskable-512.png`, `apple-touch-icon.png`, `play-assets/feature-graphic-1024x500.png` đều là logo SOLPHA (3 thanh cyan/tím/lime, vòng vàng) trên nền #0b0d12, chữ "SOLPHA". `play-assets/icon-512.png` trong repo cũng vậy.
- **Băm**: hash mọi PNG/SVG trong gói không trùng tệp ETEK nào (`icons/*.png`, `icon.svg`, `etek-logo.png`) ở repo; trùng đúng với `icons/solpha/*`.
- **SVG** `icons/icon.svg`: aria-label="SOLPHA", không có title/desc/comment/metadata editor.
- **Manifest/TWA/assetlinks**: `manifest.webmanifest` (theme #07080c, icon solpha), `twa-manifest.json` (`app.solpha.desk`, #07080c, `{{DOMAIN}}`), `.well-known/assetlinks.json` (fingerprint là placeholder): sạch.
- **sw.js ASSETS** trong gói: chỉ `./icons/*` (SOLPHA); 19 mục cache `solpha-c1.0.0`, không có tệp ETEK.
- **README/LICENSE/CHANGELOG/docs/play/LISTING.md/INSTALL/…**: sạch. Không có email/điện thoại/tên người; chỉ placeholder `{{COMPANY_NAME}}`, `{{CONTACT_EMAIL}}`, `{{WEBSITE}}`, `{{DOMAIN}}` (người mua điền).
- **Zip**: không có comment toàn gói/từng mục, không có extra field.
- **Chạy thật** (`python3 -m http.server 8811` trên thư mục giải nén, Playwright): với `/` và `/?source=play`, privacy/terms, reload, và offline từ cache: `data-brand=solpha`, title "SOLPHA · Futures Desk", theme-color #07080c, nền rgb(7,8,12), 0 trúng ETEK trong outerHTML/innerText, 0 phần tử có màu tính toán là rgb(24,152,72) (kể cả `::before/::after`), icon thông báo `icons/icon-192.png` (SOLPHA), cache không chứa tệp ETEK (so băm), không có request nào tới tệp ETEK.
- Test của người xây (`node tests/commercial.test.js`): 0 fail (tôi chỉ chạy để đối chiếu).

**Kết luận gói bán: ĐẠT.**

## 2. Bản Play (`/?source=play`)

Phương pháp: `python3 -m http.server 8810` trên repo; Playwright (chromium, chặn fonts, mock Binance), service worker bật. Script: scratchpad `audit/play-audit.js`. Luồng: `/?source=play` → đợi `serviceWorker.ready` → 5 tab (Tín hiệu/Phân tích/Công cụ/Nhật ký/Cài đặt) → gọi `notify()` → `/privacy.html` → `/terms.html` → `/` không tham số → reload → offline từ cache.

### Đạt (không có phát hiện)
- Mọi trang: `data-brand="solpha"`; `document.title` "SOLPHA · …"; `theme-color` #07080c; `<link rel=manifest>` = `manifest-solpha.webmanifest`; `rel=icon`/`apple-touch-icon` đều `icons/solpha/*`; ảnh duy nhất là `icons/solpha/icon.svg`; không có `.etek-logo` trong DOM.
- `outerHTML` và `innerText`: 0 trúng (`etek|tân phát|hội tụ tinh|tiên phong|189848|24,152,72`).
- `getComputedStyle` toàn bộ phần tử (+`::before/::after`) trên 10 trạng thái trang (5 tab, privacy, terms, `/` sau điều hướng, reload, offline): **0** phần tử dùng rgb(24,152,72) cho color/background/border/outline/box-shadow/fill/stroke. Nền body rgb(7,8,12).
- 17 luật CSS chứa màu ETEK cứng trong `styles.css` (`.status.ok`, `.tag.tang/.lower`, `#trigCard.trig-long`, `.seg input[value=yes]:checked + span`, `.ptab.active`, `.pbadge.long`, `.gtable tr.grp.long td`, `.why.long`, `.sgrp.long`, `.act.long`, `.tchip.tang`, `.held.long`, `.pill`, `.logo`, `:root`): đều có luật ghi đè trong `solpha-theme.css` (kể cả trạng thái `:checked`).
- Thông báo (stub `ServiceWorkerRegistration.showNotification`): 5 lần, `icon` và `badge` luôn `icons/solpha/icon-192.png`; tiêu đề "SOLPHA · … cảnh báo".
- Yêu cầu mạng từ trang: không URL nào chứa etek; không tải `icons/etek-logo.png` hay `icons/icon-*.png` gốc từ trang. Máy chủ chỉ phục vụ `/icons/solpha/*`, `/manifest-solpha.webmanifest` cho trang.
- Điều hướng tới privacy/terms rồi `/` không tham số và reload: vẫn solpha nhờ `sessionStorage` (khóa `solpha_brand`). Không có khóa localStorage chứa etek.
- `twa-manifest.json` (gốc repo): `app.solpha.desk`, màu #07080c, icon `icons/solpha/*`, `startUrl /?source=play`; `.well-known/assetlinks.json`; `manifest-solpha.webmanifest`; `play-assets/*.png` (nhìn bằng mắt: SOLPHA); `docs/play/LISTING.md`, `docs/play/POLICY-ANSWERS.md`: **không có chữ ETEK** nào. PNG `play-assets` không có chunk metadata.

### P1 · NGHIÊM TRỌNG (theo tiêu chí "không dấu vết"): service worker precache tệp ETEK vào máy dùng bản Play
- Vị trí: `sw.js:3-4` (`ASSETS`: `./manifest.webmanifest`, `./icon.svg`, `./icons/icon-192.png`, `icon-512`, `maskable-192`, `maskable-512`, `apple-touch-icon`, `favicon-32`). Đây là bộ ETEK (xanh #189848), không phải bộ solpha.
- Bằng chứng: sau `/?source=play` + `serviceWorker.ready`, `caches.keys()` = `solpha-v41` (24 mục), trong đó 8 mục có băm **trùng byte** với tệp ETEK của repo: `/icon.svg` (aria-label "SOLPHA · ETEK Power", fill #189848), `/icons/icon-192.png`, `icon-512.png`, `maskable-192.png`, `maskable-512.png`, `apple-touch-icon.png`, `favicon-32.png`, và `/manifest.webmanifest` (theme_color #189848). Nhật ký server xác nhận máy chủ nhận đúng các GET đó (mỗi tệp 1 lần) trong phiên Play. Trang không hề dùng chúng; chỉ `addAll(ASSETS)` ép tải.
- Ảnh hưởng: các tệp logo/màu ETEK nằm trong bộ nhớ ứng dụng trên thiết bị của người dùng Play (kiểm tra được qua DevTools/Cache Storage). Chính `docs/play/REVIEW-RISKS.md:185` đã ghi "kiểm cả `sw.js` cache" nhưng chưa làm.
- Sửa: bỏ các mục ETEK khỏi `ASSETS` (chỉ giữ mục trung tính); precache theo thương hiệu: trong `install`, đọc brand (qua tham số URL của scope đăng ký, hoặc `registerServiceWorker("sw.js?brand=solpha")`) rồi nạp `icons/solpha/*` + `manifest-solpha.webmanifest` thay cho tệp ETEK. Cách triệt để: dựng bản Play riêng (như `build-commercial.js`) không chứa tệp ETEK.

### P2 · TRUNG BÌNH: ba đường mở app làm mất `source=play` → hiện giao diện ETEK
Tái hiện (`audit/newwin.js`, cùng context đã vào `/?source=play`): mở trang mới (cửa sổ/tab mới = sessionStorage mới, không referrer) tới:
- `/` (tương đương `clients.openWindow("./")`) → `brand=etek`, `.etek-logo` có trong DOM, theme #189848, nền rgb(244,248,245).
- `/?scan=1` (shortcut) → cũng `brand=etek`.
- Vị trí lỗi: `sw.js:37` `self.clients.openWindow("./")` (khi bấm thông báo mà không còn cửa sổ nào); `twa-manifest.json:26` shortcut `"url": "/?scan=1"` (thiếu `source=play`; trong khi `manifest-solpha.webmanifest` thì có `&source=play`).
- Ảnh hưởng: trên Android thật, mở lại app từ thông báo hoặc từ shortcut nhấn giữ icon có thể hiện logo + màu ETEK trong app Play.
- Sửa: đổi `twa-manifest.json` shortcut thành `/?scan=1&source=play`; trong `showNotification` truyền `data:{url:"./?source=play"}` khi brand solpha và để `notificationclick` dùng `e.notification.data.url` cho `openWindow`; hoặc lưu brand vào IndexedDB/Cache để `sw.js` đọc.
- Lưu ý: nhánh `document.referrer` `android-app://` của `brand.js` không thể mô phỏng bằng Playwright (tham số `referer` không cho ra `document.referrer` loại này); xem P7.

### P3 · TRUNG BÌNH: URL dán lên Play Console không kèm tham số hiện nhận diện ETEK
- `docs/play/LISTING.md:23, 82-83, 176-177` dán `https://solpha.pages.dev/privacy.html` và `/terms.html` (không có `?source=play`). Mở các URL này thẳng (`audit/legal.js`): `brand=etek`, theme-color #189848, favicon `icons/favicon-32.png` (ETEK), tiêu đề h1 màu rgb(24,152,72), nền #f4f8f5. Không có chữ ETEK trong nội dung (etekText=false), nhưng màu + favicon là nhận diện ETEK. Reviewer của Google, hoặc người dùng mở chính sách từ trang cửa hàng, sẽ thấy giao diện ETEK. Với `?source=play` thì đúng solpha.
- Tương tự trang gốc `https://solpha.pages.dev/` (website nhà phát triển) hiện logo ETEK.
- Sửa: dùng `.../privacy.html?source=play` và `.../terms.html?source=play` trong LISTING.md; hoặc bỏ nhánh brand trên hai trang pháp lý (luôn solpha); hoặc phục vụ Play từ origin riêng.

### P4 · TRUNG BÌNH: hướng dẫn nội bộ dẫn tới rò rỉ màu
- `docs/GOOGLE-PLAY-GUIDE.md:42`: "…Theme color `#189848`, Background `#FFFFFF`…" khi chạy Bubblewrap. `twa-manifest.json` đã đặt #07080c; làm theo hướng dẫn (đặc biệt khi chạy `bubblewrap init`) tạo app Play có thanh trạng thái/splash xanh ETEK trắng.
- Sửa: đổi thành `#07080C` cho theme/nền; thêm bước đối chiếu với `twa-manifest.json`.
- `docs/GOOGLE-PLAY-GUIDE.md:10`, `docs/play/REVIEW-RISKS.md:185`, `README.md:1`, `skills/pwa-deploy/SKILL.md`: nhắc ETEK, là **tài liệu nội bộ/web thường**, chấp nhận được. `README.md:1` ("SOLPHA — Futures Desk · ETEK Power") không nằm trong zip (zip dùng `commercial/README.md`).

### P5 · THÔNG TIN: mã nguồn tĩnh phục vụ cho Play vẫn chứa chuỗi ETEK
Runtime sạch (xem mục "Đạt") nhưng tải thô các tệp phục vụ cho phiên Play chứa: `index.html:39` (`<img class="etek-logo" data-src="icons/etek-logo.png" alt="ETEK Power">`), `index.html:6` (`#189848`), `privacy.html:6`, `terms.html:6`, `styles.css:2,8-15,210,214,282,290…` (màu #189848, comment "ETEK Power", `.etek-logo`), `brand.js` (nhánh `"etek"`), `solpha-theme.css:33`, `manifest.webmanifest:14`, `icon.svg:1-2`, và các tệp `icons/etek-logo.png`, `icons/icon-*.png` gốc truy cập được tại cùng origin. Người cố tình xem nguồn/gọi URL sẽ thấy; không hiển thị trong app. Cách dứt điểm: build Play tách riêng, như gói bán.

### P6 · THÔNG TIN: script quét của người xây dễ bị lách (gói hiện tại vẫn sạch)
Tôi gọi `scanDir()` (export của `tools/build-commercial.js`) trên thư mục thử. Nó **bỏ sót**: `&#69;TEK` (entity), `"ET"+"EK"`, `atob("RVRFSyBQb3dlcg==")`, `hsl(141,73%,35%)`, "Hội tụ tinh hoa" / "Tiên Phong Giải Pháp" (không có trong `LEAK_PATTERNS`), SVG `E&#84;EK`, `rgb(24 152 72)` dạng cách nhau bằng dấu cách (nó chỉ bắt dạng dấu phẩy), logo ETEK đổi tên tệp (chỉ bắt khi trùng hash, không so pixel), icon ETEK vẽ lại. Nó chỉ bắt `etek` thường, `#189848`, `rgb(24,152,72)` có dấu phẩy. Gợi ý: thêm các mẫu trên, quét pixel PNG (mẫu quét ở `audit/pix.js`), chạy `audit/decode-scan.py`-kiểu giải mã trước khi quét, và thêm slogan "hội tụ tinh hoa", "tiên phong giải pháp".

### P7 · THÔNG TIN: chưa xác minh được
- Hành vi `document.referrer = android-app://app.solpha.desk` khi TWA khởi chạy thật (nhánh trong `brand.js:10`); nên thử trên Android thật.
- `fallbackType: customtabs`: nếu `assetlinks.json` chưa điền fingerprint (đang là `THAY_BANG_SHA256…`), app mở dạng Custom Tab có thanh URL; nội dung vẫn solpha nhờ `startUrl /?source=play`.
- Tôi không kiểm tra Android thật, Play Console thật hay trang cửa hàng thật.

## 3. Phân loại

- (a) **Rò rỉ trong gói bán / bản Play**: P1 (precache ETEK), P2 (mở lại mất brand), P3 (URL pháp lý Play Console), P4 (hướng dẫn #189848).
- (b) **Docs nội bộ / web thường (chấp nhận được, đã liệt kê)**: `README.md:1`, `docs/GOOGLE-PLAY-GUIDE.md:10`, `docs/play/REVIEW-RISKS.md:185`, `skills/pwa-deploy/SKILL.md`, `tests/commercial.test.js`, `tools/build-commercial.js`, `tools/play-assets.js:8` (comment), `styles.css`, `brand.js`, `icons/etek-logo.png`, `icon.svg`, `icons/*.png` gốc.

## 4. Việc nên làm trước khi nộp Play (theo ưu tiên)
1. Sửa `sw.js` (P1) rồi chạy lại `audit/play-audit.js` kiểm `cacheEtek` rỗng.
2. Thêm `source=play` vào shortcut TWA và `openWindow` của thông báo (P2).
3. Dán `...?source=play` cho privacy/terms trong LISTING.md hoặc cố định hai trang này sang solpha (P3).
4. Sửa dòng 42 của GOOGLE-PLAY-GUIDE.md (P4).
5. Cân nhắc build Play tách riêng (P5) và nâng cấp script quét (P6).

## 5. Tệp bằng chứng (scratchpad, không thuộc repo)
`/tmp/claude-0/-home-user-solpha-acc05/a31db763-0c4b-5414-8146-129234fa28b0/scratchpad/audit/`: `play-audit.js`, `audit-play.json` (đầy đủ request/cache/DOM), `audit-zip.json`, `pix.js`, `decode-scan.py`, `css-audit.js`, `newwin.js`, `legal.js`, ảnh chụp `play-*.png`, `privacy-plain.png`, `newwin-etek.png`.
