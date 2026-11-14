# Báo cáo kiểm toán bảo mật: backend Google Play Billing của SOLPHA

- Phạm vi: `worker/src/index.js` (619 dòng), `worker/wrangler.toml`, `worker/README.md`, `billing.js` (502 dòng), `worker/test/*.mjs`, `docs/play/POLICY-ANSWERS.md` (mục 1B), `privacy.html` (mục 4).
- Commit kiểm toán: `80162b6`. Không sửa file nguồn nào; chỉ thêm hai file: báo cáo này và `worker/test/audit-poc.test.mjs`.
- Cách tái hiện: `node --test worker/test/audit-poc.test.mjs`. Mỗi test mang mã phát hiện `[F#]` và mô tả hành vi ĐÚNG mong muốn, nên **test FAIL = lỗi thật**. Các test `CONTROL-*` là đối chứng và phải qua.
- Kết quả chạy lại ngày 2026-11-14 (Node v22.23.4):
  - `node --test worker/test/*.test.mjs` (gồm cả file kiểm toán): bộ cũ vẫn 39/39 qua, bộ kiểm toán 35 test: **9 qua (CONTROL-1..9), 26 fail (= 26 bằng chứng khai thác của F1..F16, F18)**.
  - Điểm mấu chốt: "39/39 qua" đúng, nhưng 39 test đó kiểm hành vi đường thuận (happy path). Chúng không có test nào cho lỗi Google tạm thời trong RTDN, RTDN bị mất, token chưa qua verify, chạy đua, hay khoá yếu. Đó chính là nơi các lỗi nằm.

## 1. Tóm tắt

Phần cốt lõi xác minh là **đúng**: mọi trạng thái đều lấy từ Google (`subscriptionsv2.get`), không tin payload RTDN, so khớp `sku` với `lineItems[].productId`, acknowledge đúng điều kiện, token mã hoá AES-GCM với IV ngẫu nhiên, JWT service account chuẩn, CORS so khớp chính xác. Không tìm thấy cách qua mặt Google để tạo quyền lợi từ hư không, nên **không có phát hiện mức NGHIÊM TRỌNG**.

Rủi ro nằm ở **độ tin cậy vòng đời** (hoàn tiền/thu hồi bị lỡ thì quyền lợi sống tới hết kỳ, người trả tiền nhưng backend chết thì không được ack) và ở **thiết kế định danh yếu** (deviceId tự khai, token là bearer, không có bằng chứng sở hữu).

| Mức | Số lượng | Mã |
|---|---|---|
| NGHIÊM TRỌNG | 0 | |
| CAO | 3 | F1, F2, F3 |
| TRUNG BÌNH | 9 | F4, F5, F6, F7, F8, F9, F10, F11, F16 |
| THẤP | 4 | F12, F13, F14, F15 |
| THÔNG TIN | 3 | F17, F18, F19 |
| **Tổng** | **19** | |

**3 lỗi cần vá ngay**: F3 (người đã trả tiền không được ack), F1 (RTDN nuốt lỗi Google bằng HTTP 200, hoàn tiền bị mất), F2 (token đang active không bao giờ được đối chiếu lại). Ngoài ra F10 (khai báo quyền riêng tư sai so với mã) là điều kiện chặn phát hành lên Play.

## 2. Bảng phát hiện

| Mã | Mức | Vị trí | Tóm tắt | Test |
|---|---|---|---|---|
| F1 | CAO | `index.js:553-565` | RTDN gặp lỗi Google tạm thời vẫn trả 200, Pub/Sub không gửi lại; thông báo hoàn tiền (void) mất vĩnh viễn | `[F1]` |
| F2 | CAO | `index.js:485-491` | Token đang active và đã ack không bao giờ được làm mới cho tới hết hạn cục bộ (gói năm = 365 ngày); mọi RTDN bị lỡ là vĩnh viễn | `[F2]` |
| F3 | CAO | `billing.js:362-373`, `index.js:547-551` | Google đã tính tiền nhưng verify lỗi: token chỉ ở RAM, không thử lại tự động; RTDN cho token lạ bị bỏ qua nên không ai ack; sau 3 ngày Google hoàn tiền | `[F3a]`, `[F3b]` |
| F4 | TRUNG BÌNH | `index.js:459-463`, `parseSubscription` (37-58) | `purchaseToken` là bearer: chuyển thiết bị không giới hạn (cướp/chia sẻ/phá), không đọc `externalAccountIdentifiers` | `[F4a]`, `[F4b]` |
| F5 | TRUNG BÌNH | `index.js:480-483`, `461-463` | Bất biến "1 token : 1 thiết bị" chỉ được duy trì lúc ghi, không kiểm lúc đọc; lỗi giữa chừng hoặc chạy đua cho 2 thiết bị cùng active | `[F5a]`, `[F5b]` |
| F6 | TRUNG BÌNH | `index.js:437-444`, `554-558` | `REVOKED` không "dính": `/api/verify` lại ghi đè bằng trạng thái Google (có thể vẫn ACTIVE) | `[F6]` |
| F7 | TRUNG BÌNH | `index.js:522-525`, `wrangler.toml:25` | Xác thực RTDN chỉ bằng `?key=` trong URL (lộ qua `wrangler tail`/log/console GCP); không bắt buộc độ dài; không kiểm OIDC của Pub/Sub | `[F7a]` |
| F8 | TRUNG BÌNH | `index.js:164-169`, `432`, `492-494` | Thiếu `TOKEN_ENC_KEY` thì dùng `RTDN_KEY` làm khoá mã hoá (cùng bí mật vừa nằm trong URL); đổi khoá thì giải mã hỏng im lặng | `[F8a]`, `[F8b]` |
| F9 | TRUNG BÌNH | `index.js:128-144`, `596` | Rate limit trong bộ nhớ isolate: bỏ qua bằng xoay IPv6 /64; làm tràn 5000 khoá thì `store.clear()` xoá bộ đếm của mọi người | `[F9a]`, `[F9b]` |
| F10 | TRUNG BÌNH | `index.js:299`, `billing.js:254`, `privacy.html:21,44,57` | Lưu `deviceId`+băm+token mã hoá vĩnh viễn (không TTL, không có thao tác xoá); `privacy.html` khẳng định "không có máy chủ riêng, không lưu"; Data safety khuyến nghị "không tạo ID riêng" nhưng mã tạo | `[F10a]`, `[F10b]`, `[F10c]` |
| F11 | TRUNG BÌNH | `billing.js:249-270`, `456-474` | `restore()` coi 502/429/500 như "không có giao dịch hiệu lực": người đã trả tiền thấy `inactive` | `[F11]` |
| F12 | THẤP | `index.js:56`, `366` | `testPurchase` được đọc rồi bỏ; giao dịch license-tester cấp Pro ở production, không đánh dấu, không có cấu hình | `[F12a]`, `[F12b]` |
| F13 | THẤP | `index.js:301-307`, `426`; `billing.js:103` | deviceId không có bằng chứng sở hữu: 20 token hợp lệ đẩy token thật khỏi `dev:<id>`; UUID dự phòng hằng số công khai được chấp nhận | `[F13a]`, `[F13b]` |
| F14 | THẤP | `index.js:454-463` | Verify ghi đè trạng thái mới hơn của RTDN bằng ảnh chụp Google cũ (đọc-sửa-ghi không phiên bản); kết hợp F2 thì tồn tại tới hết hạn | `[F14]` |
| F15 | THẤP | `index.js:407-411` | `request.text()` đọc toàn bộ body trước khi kiểm `MAX_BODY` | `[F15]` |
| F16 | TRUNG BÌNH (có điều kiện) | `billing.js:140-180` | Pro chỉ là cờ localStorage; bản web công khai; sửa `solpha_ent` là có Pro | `[F16]` |
| F17 | THÔNG TIN | `index.js:377-384`, `577` | Kiểm Origin không phải biên xác thực (không có Origin vẫn qua; origin mặc định luôn được phép). Không có CSRF vì không có credential môi trường | CONTROL-2 |
| F18 | THÔNG TIN | `index.js:561-564` | Log `rtdn_error` ghi `e.message` của `JSON.parse`, chứa 10 ký tự đầu của dữ liệu đầu vào | `[F18]` |
| F19 | THÔNG TIN | nhiều nơi | Dự phòng `x-forwarded-for`; `billing.js` chưa được nhúng vào `index.html`; `deviceId` nằm trong query URL; KV nhất quán cuối cùng | (không có) |

---

## 3. Chi tiết từng phát hiện

### F1 [CAO] RTDN nuốt lỗi Google bằng HTTP 200: thông báo hoàn tiền bị mất vĩnh viễn

- Vị trí: `worker/src/index.js:553-565`.
- Mã: với `voidedPurchaseNotification`, việc thu hồi (`state: "REVOKED"`) nằm **sau** `await refreshRecord(...)` (dòng 553). Nếu Google trả 5xx/timeout thì `refreshRecord` ném lỗi, khối `catch` (561) ghi log rồi trả `200 {"ok":true,"error":"logged"}`. Pub/Sub coi là đã nhận và **không bao giờ gửi lại**. README còn xác nhận thiết kế này: "Các lỗi xử lý khác đều trả 200".
- Kịch bản: người dùng mua gói năm, xin hoàn tiền (hoặc chargeback). Google gửi `voidedPurchaseNotification`; đúng lúc đó Google API trả 503 (hoặc Worker timeout 8 giây, hoặc service account tạm mất quyền). Thông báo bị nuốt. Vì F2, token vẫn "active + acknowledged" nên **Pro còn nguyên đến hết 365 ngày** dù tiền đã trả lại.
- Bằng chứng: `[F1]` fail với thông điệp "RTDN trả 200 (Pub/Sub sẽ KHÔNG gửi lại) và người dùng đã hoàn tiền vẫn active=true".
- Cách vá (hai lớp):

```js
// (a) Thu hồi KHÔNG phụ thuộc Google: ghi REVOKED trước.
if (vn) {
  const rec = { ...prev, state: "REVOKED", expiryMs: now, updatedAt: now,
                voidedAt: now, voidedOrderId: vn.orderId || null };
  await kvPut(env, "tok:" + hash, rec);
  log("info", "rtdn_voided", { tok: shortId(hash) });
  return json({ ok: true, state: "REVOKED" });
}
// (b) Lỗi xử lý (không phải lỗi dữ liệu đầu vào) -> 503 để Pub/Sub gửi lại với backoff.
} catch (e) {
  log("error", "rtdn_error", { err: e && e.name });
  const badInput = e instanceof SyntaxError || (e && e.name === "InvalidCharacterError");
  return badInput ? json({ ok: true, error: "bad_payload" }) : json({ ok: false, error: "retry" }, 503);
}
```

  Sửa README mục "Lỗi thường gặp": Pub/Sub gửi lại khi 503 là chủ đích; đặt Retry policy exponential backoff (đã có trong hướng dẫn) và **dead-letter topic** cho thông báo hỏng kéo dài.

### F2 [CAO] Token đang active không bao giờ được đối chiếu lại

- Vị trí: `worker/src/index.js:485-491`.
- Mã: `needsRefresh` chỉ đúng khi `(!isActive(...) || !rec.ackedAt) && now - updatedAt >= 10 phút`. Bản ghi `ACTIVE` đã ack và còn hạn thì **không bao giờ** gọi Google nữa, cho tới khi `expiryMs` trôi qua.
- Kịch bản: mọi sự kiện đáng lẽ làm mất quyền giữa kỳ (revoke do nhà phát triển, hoàn tiền, `SUBSCRIPTION_REVOKED`, chargeback) chỉ đến qua RTDN; một RTDN bị lỡ (F1, Pub/Sub tắt nhầm, sai `?key=` sau khi đổi khoá, token chưa có trong KV lúc RTDN tới) là **vĩnh viễn** cho tới hết kỳ. Gói năm = tối đa 365 ngày Pro miễn phí.
- Bằng chứng: `[F2]` fail: "Pro vẫn còn tới 2026-12-14... dù Google đã thu hồi" (sau khi lùi `updatedAt` 25 giờ).
- Cách vá: thêm làm mới định kỳ cho cả token đang active, ví dụ 6 giờ (chi phí: tối đa 4 lần gọi Google/ngày/token đang mở app; rẻ hơn nhiều so với hạn mức 200.000/ngày).

```js
const REVALIDATE_MS = 6 * 3600_000;
const TERMINAL = new Set(["EXPIRED", "INVALID", "REPLACED", "REVOKED"]);
// trong handleEntitlement:
const age = now - (rec.updatedAt || 0);
const needsRefresh = !TERMINAL.has(rec.state) &&
  (((!isActive(rec.state, rec.expiryMs, now) || !rec.ackedAt) && age >= REFRESH_MIN_MS) || age >= REVALIDATE_MS);
```

### F3 [CAO] Đã bị trừ tiền nhưng backend không biết token: không ack, không thử lại

- Vị trí: `billing.js:362-373` (nhánh `verify` thất bại), `index.js:547-551` (RTDN token lạ).
- Chuỗi lỗi:
  1. `purchase()` nhận `purchaseToken` từ Google (tiền đã bị trừ), gọi `/api/verify`; nếu backend 502/mạng rớt/rate limit thì `complete("fail")` và trả `verify_failed`. **Token chỉ nằm trong biến cục bộ; không ghi localStorage**; đóng app là mất.
  2. Không có tự động thử lại: `refresh()` chỉ gọi `/api/entitlement?deviceId=`, mà backend chưa từng thấy token nên trả `active:false`. `restore()` chỉ chạy khi người dùng bấm nút.
  3. Google gửi RTDN `SUBSCRIPTION_PURCHASED` ngay lập tức, nhưng `handleRtdn` bỏ qua token chưa có trong KV (`ignored: unknown_token`) **và không acknowledge**.
  4. Không ai acknowledge trong 3 ngày, Google tự hoàn tiền và thu hồi giao dịch (tài liệu Play Billing: gói mới phải ack trong 3 ngày). Người dùng mất Pro ngay sau khi trả tiền; đánh giá 1 sao.
- Bằng chứng: `[F3a]` (token không được lưu bền) và `[F3b]` (RTDN `PURCHASED` token lạ: `google.acks.length` = 0).
- Cách vá:
  - Máy chủ: ack độc lập với client. Khi RTDN tới cho token chưa biết, gọi Google, ack nếu active và chưa ack, rồi lưu bản ghi "mồ côi" (`deviceId: null`) để `verify`/`restore` về sau gắn vào thiết bị.

```js
if (!prev) {
  if (sn) { // PURCHASED(4), RECOVERED(1), RENEWED(2), RESTARTED(7)...
    const parsed = await fetchSubscription(env, token);          // lỗi -> 503 (xem F1)
    let ackedAt = parsed.acknowledged ? now : null;
    if (!parsed.acknowledged && isActive(parsed.state, parsed.expiryMs, now) && parsed.sku &&
        (await acknowledgePurchase(env, parsed.sku, token))) ackedAt = now;
    await kvPut(env, "tok:" + hash, { sku: parsed.sku, deviceId: null, state: parsed.state,
      expiryMs: parsed.expiryMs, ackedAt, updatedAt: now, tokenEnc: await encryptToken(env, token) });
  }
  return json({ ok: true, adopted: true });
}
```

  - Client: lưu token chờ xác minh trước khi gọi `verify`, thử lại khi khởi động / `online` / `visibilitychange`, và tự `restore()` nhẹ khi không phải Pro nhưng `listPurchases()` có giao dịch.

```js
var LS_PENDING = "solpha_pending";
function savePending(sku, token) { lsSet(LS_PENDING, JSON.stringify({ sku: sku, token: token, at: now() })); }
function clearPending() { lsSet(LS_PENDING, ""); }
function retryPending() {
  var p; try { p = JSON.parse(lsGet(LS_PENDING) || "null"); } catch (e) { p = null; }
  if (!p || !p.token) return Promise.resolve(null);
  return verify(p.sku, p.token).then(function (v) {
    if (v.ok && v.data) { clearPending(); applyEntitlement(v.data, "retry"); }
    return v;
  });
}
// trong purchase(): savePending(sku, token) NGAY sau khi có token, trước verify(); clearPending() khi v.ok.
// khởi động: root.addEventListener("online", retryPending); gọi retryPending() khi nạp trang.
```

### F4 [TRUNG BÌNH] `purchaseToken` là bearer: chuyển quyền không giới hạn, không gắn tài khoản Google

- Vị trí: `index.js:459-463` (chuyển quyền), `index.js:37-58` (`parseSubscription` bỏ qua `externalAccountIdentifiers`).
- Trả lời câu hỏi A:
  - **Ai cũng gọi được `/api/verify` với token của người khác?** Có, nếu họ **có** token. Token dài, ngẫu nhiên, không đoán được; nhưng token không bí mật theo thiết kế của Google (nằm trong `listPurchases()` của mọi ứng dụng cùng thiết bị, log, backup, ảnh chụp màn hình lỗi). Mã coi nó là bằng chứng sở hữu duy nhất.
  - **Cướp gói bằng token nghe lén?** Có: gửi lại token cùng `deviceId` mới thì `removeTokenFromDevice(prev.deviceId)` chuyển quyền sang kẻ tấn công; nạn nhân mất Pro ở lần làm mới kế tiếp và client của họ **không tự `restore`**, nên đây là cách "phá" bền bỉ. Kẻ tấn công cũng có thể lật token qua lại liên tục (chỉ bị giới hạn 10 lần/phút/IP, theo IP chứ không theo token).
  - **`sku` client gửi có được so với Google?** Có: `index.js:454` so với `lineItems[].productId` (CONTROL-9 qua).
  - **Có dùng `obfuscatedExternalAccountId`?** Không. `parseSubscription` không đọc `externalAccountIdentifiers`.
- Bằng chứng: `[F4a]` (8 lần lật liên tiếp đều 200), `[F4b]` (Google trả `obfuscatedExternalAccountId` của thiết bị A, thiết bị B vẫn được chấp nhận).
- Cách vá:
  - Giới hạn chuyển quyền theo token (chỉ chặn lạm dụng, không chặn người đổi máy hợp lệ):

```js
// ngay sau khi đọc prev trong handleVerify, trước refreshRecord
const T_MAX = 3, T_WINDOW = 30 * 86400_000;
let transfers = (prev && prev.transfers) || [];
if (prev && prev.deviceId && prev.deviceId !== deviceId) {
  transfers = transfers.filter((t) => now - t < T_WINDOW);
  if (transfers.length >= T_MAX)
    return json({ error: "transfer_limited", message: "Giao dịch đã chuyển thiết bị quá nhiều lần. Liên hệ hỗ trợ." }, 429, cors);
  transfers.push(now);
}
// và lưu `transfers` vào finalRec
```

  - Đọc và so khớp danh tính tài khoản nếu có (**giả định chưa xác nhận**: PaymentRequest của TWA có cho truyền `obfuscatedAccountId` hay không; xem mục 6):

```js
// parseSubscription: thêm
extAccount: json.externalAccountIdentifiers && json.externalAccountIdentifiers.obfuscatedExternalAccountId || null,
// handleVerify: sau refreshRecord
if (rec._extAccount && rec._extAccount !== (await sha256Hex("acct:" + deviceId)))
  return json({ error: "account_mismatch" }, 403, cors);
```

  - Đường dài hạn: "bằng chứng sở hữu thiết bị" (xem F13).

### F5 [TRUNG BÌNH] Bất biến "một token một thiết bị" không được kiểm lúc đọc

- Vị trí: `index.js:480-483` (`handleEntitlement` duyệt `dev:<id>` và không đối chiếu `rec.deviceId`), `461-463` (ba thao tác KV không nguyên tử).
- Kịch bản: (1) Worker/KV lỗi sau khi ghi `tok:` mới nhưng trước `removeTokenFromDevice` thì token nằm ở **cả hai** danh sách mãi mãi. (2) Hai `verify` song song từ hai thiết bị cùng token: cả hai đọc `prev` cũ, cả hai ghi `addTokenToDevice` cho thiết bị của mình: hai thiết bị cùng active. Bằng chứng lệch với tuyên bố trong README ("một purchaseToken thuộc một thiết bị tại một thời điểm").
- Bằng chứng: `[F5a]`, `[F5b]` fail ("cả B và C đều active với cùng một purchaseToken").
- Cách vá (một dòng, đủ chặn cả hai): thiết bị chỉ được hưởng token mà bản ghi `tok:` đang ghi là của nó.

```js
// handleEntitlement, trong vòng for
let rec = await kvGet(env, "tok:" + hash);
if (!rec) continue;
if (rec.deviceId && rec.deviceId !== deviceId) continue; // token đã thuộc thiết bị khác
```

  Khi đó "người ghi sau thắng" quyết định duy nhất một thiết bị. Về dài hạn nên đưa trạng thái vào Durable Object/D1 (nguyên tử theo `tok`).

### F6 [TRUNG BÌNH] `REVOKED` không bền: verify lại hồi sinh quyền lợi đã hoàn tiền

- Vị trí: `index.js:437-444` (verify lấy `prev`, gọi `refreshRecord` với `markInvalid:false`, ghi đè `state` bằng giá trị Google), `554-558`.
- Kịch bản: Google báo giao dịch bị void; nhận RTDN → `REVOKED`. Nếu Google vẫn trả `ACTIVE` cho token đó (trường hợp hoàn tiền không kèm revoke, **giả định chưa xác nhận**, xem mục 6), người dùng bấm "Khôi phục giao dịch" hoặc gọi verify lại thì bản ghi bị ghi đè thành ACTIVE và có Pro tiếp.
- Bằng chứng: `[F6]` fail "verify lại ghi đè REVOKED -> active=true". (Test cũ "RTDN voidedPurchase thu hồi quyền lợi ngay" chỉ kiểm `entitlement`, không kiểm verify lại.)
- Cách vá: ghi nhớ đơn hàng bị void và không cho trạng thái Google hồi sinh nó.

```js
// parseSubscription: latestOrderId: typeof json.latestOrderId === "string" ? json.latestOrderId : null
// refreshRecord, sau khi tạo rec:
if (prev && prev.voidedAt && (!prev.voidedOrderId || parsed.latestOrderId === prev.voidedOrderId)) {
  rec.state = "REVOKED"; rec.expiryMs = prev.expiryMs <= now ? prev.expiryMs : now;
}
```

### F7 [TRUNG BÌNH] Xác thực RTDN yếu: khoá trong URL, không độ dài tối thiểu, không OIDC

- Vị trí: `index.js:522-525`, `wrangler.toml:25`, `README.md:93`, `README.md:99`.
- Trả lời câu hỏi B:
  - **So sánh hằng-thời-gian đúng chưa?** Đúng: băm SHA-256 cả hai rồi XOR, nên độ dài khác nhau không lộ thông tin (CONTROL-1 qua với chuỗi rỗng, tiền tố, hậu tố, chữ hoa, byte NUL).
  - **Lộ khoá trong URL/log?** Có rủi ro: `?key=` nằm trong URL đăng ký của Pub/Sub (ai có quyền xem subscription trong GCP đọc được), trong dòng sự kiện của `npx wrangler tail` (README khuyến khích chạy lệnh này) và trong bất kỳ Workers Logs/Logpush nào ghi URL (**giả định chưa xác nhận**, xem mục 6). Code Worker tự nó không ghi khoá.
  - **Replay?** Mỗi thông báo hợp lệ có thể phát lại: không dedupe `messageId`, không kiểm `eventTimeMillis`. Vì `handleRtdn` luôn lấy trạng thái thật từ Google, phát lại chỉ gây thêm lượt gọi Google và ghi KV, **ngoại trừ `voidedPurchaseNotification`**, vốn ép `REVOKED` vô điều kiện (dòng 554-558): một thông báo void cũ bị Pub/Sub phát lại muộn (giao ít nhất một lần, không đảm bảo thứ tự) sau khi đơn hàng đã được xử lý lại có thể thu hồi một gói hợp lệ. Kết hợp F6 để chỉ void đúng `orderId`.
  - **Payload khổng lồ?** Không đáng kể ở RTDN: khoá được kiểm trước khi đọc body, giới hạn 16 KB (phần `/api/verify` xem F15).
  - **Thông báo của gói app khác?** Bị bỏ qua đúng (CONTROL-3). Lưu ý nhỏ: kiểm này là "fail-open" khi payload không có `packageName` hoặc `env.PACKAGE_NAME` trống; không khai thác được vì mọi cuộc gọi Google đều gắn `PACKAGE_NAME`.
  - Khoá ngắn: không có kiểm độ dài (`RTDN_KEY="a"` vẫn được chấp nhận). `/api/rtdn` không có rate limit.
- Bằng chứng: `[F7a]` fail (khoá 1 ký tự được chấp nhận).
- Cách vá: dùng xác thực OIDC của Pub/Sub push (gói `Authorization: Bearer <JWT>` do Google ký) thay cho khoá trong URL, và buộc độ dài khoá nếu còn dùng:

```js
// 1) cấu hình đăng ký push:  gcloud pubsub subscriptions create ... \
//      --push-endpoint=https://<worker>/api/rtdn \
//      --push-auth-service-account=pubsub-push@<project>.iam.gserviceaccount.com \
//      --push-auth-token-audience=https://<worker>/api/rtdn
// 2) Worker: biến RTDN_AUDIENCE, PUSH_SA_EMAIL
let jwks = { at: 0, keys: null };
async function verifyPushJwt(request, env) {
  const m = (request.headers.get("authorization") || "").match(/^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/);
  if (!m) return false;
  const header = JSON.parse(new TextDecoder().decode(bytesFromB64(m[1])));
  const claims = JSON.parse(new TextDecoder().decode(bytesFromB64(m[2])));
  if (Date.now() - jwks.at > 3600_000) {
    jwks = { at: Date.now(), keys: (await (await fetch("https://www.googleapis.com/oauth2/v3/certs")).json()).keys };
  }
  const jwk = jwks.keys.find((k) => k.kid === header.kid);
  if (header.alg !== "RS256" || !jwk) return false;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, bytesFromB64(m[3]), new TextEncoder().encode(m[1] + "." + m[2]));
  return ok && ["https://accounts.google.com", "accounts.google.com"].includes(claims.iss) &&
    claims.aud === env.RTDN_AUDIENCE && claims.email === env.PUSH_SA_EMAIL &&
    claims.email_verified === true && claims.exp * 1000 > Date.now();
}
// và với khoá cũ: if (!env.RTDN_KEY || env.RTDN_KEY.length < 32) return json({ error: "server_misconfigured" }, 500);
```

### F8 [TRUNG BÌNH] Không tách khoá mã hoá token khỏi khoá RTDN; giải mã hỏng thì im lặng

- Vị trí: `index.js:164-169` (`env.TOKEN_ENC_KEY || env.RTDN_KEY`), `432` (chỉ yêu cầu một trong hai), `492-494` (`if (token)` rồi bỏ qua im lặng).
- Trả lời câu hỏi D:
  - **IV tái sử dụng?** Không: `crypto.getRandomValues(12)` mỗi lần mã hoá (CONTROL-5: hai lần verify cho hai `tokenEnc` khác nhau). 96 bit ngẫu nhiên an toàn ở quy mô này.
  - **Phân tách khoá?** Không. Khi thiếu `TOKEN_ENC_KEY`, bí mật **dùng để xác thực RTDN và nằm trong URL** lại là khoá giải mã mọi token đã lưu. Người có quyền xem cấu hình Pub/Sub hoặc `wrangler tail` đọc được khoá, cộng với quyền đọc KV là giải mã toàn bộ token (token mua hàng còn hiệu lực dùng để cướp gói theo F4). Ngoài ra khoá chỉ băm SHA-256 một lần (không HKDF), không có `kid`, không có AAD gắn băm token nên có thể tráo `tokenEnc` giữa các bản ghi nếu ghi được KV.
  - **Đổi khoá:** README cảnh báo "đừng đổi RTDN_KEY" trong khi F7 đòi hỏi phải đổi khi lộ: hai yêu cầu mâu thuẫn. Khi đã đổi, `decryptToken` trả `null`, `handleEntitlement` bỏ qua làm mới và **không log gì**: người đã gia hạn mất Pro không dấu vết.
- Bằng chứng: `[F8a]` (thiếu `TOKEN_ENC_KEY` mà verify vẫn 200), `[F8b]` (xoay khoá: không có dòng log nào).
- Cách vá:

```js
async function encKey(env) {
  const s = env.TOKEN_ENC_KEY;
  if (!s || s.length < 32) return null;              // bắt buộc, KHÔNG dùng RTDN_KEY
  const ikm = await crypto.subtle.importKey("raw", new TextEncoder().encode(s), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("solpha-billing"), info: new TextEncoder().encode("tok-aes-gcm-v2") },
    ikm, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
// encrypt/decrypt: truyền additionalData: new TextEncoder().encode(hash) để gắn bản mã với bản ghi.
// handleVerify: if (!env.TOKEN_ENC_KEY) return json({ error: "server_misconfigured" }, 500, cors);
// handleEntitlement:
const token = await decryptToken(env, rec.tokenEnc);
if (!token) log("warn", "token_decrypt_failed", { tok: shortId(hash) });
```

  Hỗ trợ xoay khoá bằng tiền tố `v2.<kid>.` và danh sách `TOKEN_ENC_KEYS` (thử lần lượt).

### F9 [TRUNG BÌNH] Rate limit trong bộ nhớ isolate bị vô hiệu

- Vị trí: `index.js:128-144`, `596`.
- Trả lời câu hỏi E:
  - **Origin so khớp đúng?** Có: `Set.has(origin)` so khớp chính xác (CONTROL-2: `solpha.pages.dev.evil.com`, `evilsolpha.pages.dev`, `http://`, cổng lạ, chữ hoa, `null` đều 403, không có `Access-Control-Allow-Origin`). Không dùng `endsWith`/`includes`.
  - **`ACAO: *` trả vô tình?** Không; chỉ phản chiếu origin được phép kèm `Vary: Origin`.
  - **Preflight?** Đúng: 204 cho origin hợp lệ, 403 cho origin lạ, kèm `max-age` 86400.
  - **Rate limit theo IP trong isolate có bị vô hiệu bởi nhiều isolate?** Có, về cấu trúc: mỗi isolate có `Map` riêng nên giới hạn thực = 10 × số isolate. Cụ thể hơn, hai cách bypass chứng minh được:
    1. **Xoay IPv6**: khoá là địa chỉ đầy đủ; một máy IPv6 có /64 = 2^64 địa chỉ, mỗi địa chỉ một bucket (`[F9a]`).
    2. **Làm tràn**: khi `store.size > 5000` và không còn khoá hết hạn thì `store.clear()` (dòng 135) xoá luôn bộ đếm của kẻ tấn công (`[F9b]`: sau 5001 khoá giả, IP đang bị chặn được mở lại).
  - **Header IP:** dùng `cf-connecting-ip` trước (Cloudflare tự đặt và ghi đè, client không giả được); `x-forwarded-for` chỉ là dự phòng khi thiếu header kia, xem F19.
  - Hậu quả: mỗi `/api/verify` token sai tốn 1 lượt đọc KV và 1 lượt gọi Google (hạn mức 200.000/ngày); `/api/entitlement` ngẫu nhiên tốn 1 lượt đọc KV (gói miễn phí 100.000 lượt/ngày). Một kẻ tấn công phân tán làm cạn hạn mức KV thì `kvGet` ném lỗi và **toàn bộ người dùng nhận 500** (từ chối dịch vụ).
- Cách vá: dùng Cloudflare Rate Limiting (binding, hoặc rule WAF) thay cho `Map`, gộp IPv6 theo /64, và đổi `clear()` thành loại bớt mục cũ nhất.

```toml
# wrangler.toml
[[unsafe.bindings]]
name = "RL_VERIFY"
type = "ratelimit"
namespace_id = "1001"
simple = { limit = 10, period = 60 }
```

```js
function ipKey(ip) {
  if (!ip.includes(":")) return ip;
  const [head, tail = ""] = ip.split("::");
  const a = head ? head.split(":") : [], b = tail ? tail.split(":") : [];
  const full = [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill("0"), ...b];
  return full.slice(0, 4).join(":"); // /64
}
// const rl = await env.RL_VERIFY.limit({ key: "v:" + ipKey(ip) });  if (!rl.success) -> 429
// rateLimit(): thay store.clear() bằng xoá phần tử đầu của Map (thứ tự chèn) cho tới khi size < 4000.
```

### F10 [TRUNG BÌNH] Quyền riêng tư và khai báo không khớp mã

- Trả lời câu hỏi H:
  - **Lưu thứ gì ngoài deviceId + băm/mã hoá token + trạng thái?** Không có thêm: `tok:<sha256>` = `{sku, deviceId, state, expiryMs, ackedAt, updatedAt, tokenEnc}`; `dev:<deviceId>` = mảng băm. Tốt. Không lưu IP, email, tên.
  - **Log lộ token/IP?** Mã Worker không log token, IP, `deviceId`; chỉ log tiền tố 8 ký tự hex của băm (`shortId`). Test cũ đã kiểm token không có trong log. Hai lưu ý: (1) `GET /api/entitlement?deviceId=` đặt `deviceId` vào URL nên nó xuất hiện trong log/analytics của Cloudflare và trong `wrangler tail`; (2) F18 (đoạn đầu input trong log lỗi). IP vẫn do Cloudflare thấy/ghi như mọi Worker.
  - **Đối chiếu với `privacy.html`/Data safety:**
    - `privacy.html:21` ("không có máy chủ riêng ... không thu thập, không lưu ... bất kỳ dữ liệu") và `:57` ("no server of its own") **sai** khi bật Pro.
    - `privacy.html:44` chỉ nói "mã xác nhận mua hàng"; thực tế còn `deviceId` (UUID) do app sinh (`billing.js:94-105`, gửi ở `billing.js:254`).
    - `POLICY-ANSWERS.md` (mục 1B) khuyến nghị "không tạo ID riêng, dùng purchase token làm khoá" và nói chỉ khai "Device or other IDs" nếu app sinh UUID: **mã có sinh**, nên phải khai.
    - Mục 1B yêu cầu "Worker phải có thao tác xoá theo purchase token thực sự dùng được": **không có endpoint xoá nào**; không dữ liệu nào có TTL (`kvPut` không bao giờ truyền `expirationTtl`, `index.js:299`), nên "Có thể yêu cầu xoá" khai trong Data safety sẽ thành khai sai.
- Bằng chứng: `[F10a]` (không TTL), `[F10b]` (mục 4 không nêu mã thiết bị/thời hạn), `[F10c]` (khẳng định "không có máy chủ riêng").
- Cách vá:

```js
const kvPut = (env, key, val, ttl) =>
  env.ENT.put(key, JSON.stringify(val), ttl ? { expirationTtl: Math.max(60, Math.floor(ttl)) } : undefined);
// tok:  còn hạn -> (expiryMs - now)/1000 + 90 ngày ; kết thúc (EXPIRED/INVALID/REVOKED/REPLACED) -> 90 ngày
// dev:  cùng TTL lớn nhất của các token trong danh sách (gia hạn mỗi lần ghi)

// Thao tác xoá (người dùng gửi deviceId + purchaseToken, hoặc xác thực bằng khoá thiết bị, xem F13)
if (path === "/api/erase" && method === "POST") { /* xoá tok:<hash>, gỡ khỏi dev:<id>, trả 204 */ }
```

  Việc phải làm trên giấy tờ trước khi phát hành bản Pro: viết lại `privacy.html` mục 4 (và các câu "không máy chủ" ở dòng 21, 57), khai Data safety "Purchase history" + "Device or other IDs", ghi rõ Cloudflare là nhà xử lý, thời hạn lưu, cách xoá. Ưu tiên chuyển `deviceId` ra header (`x-device-id`) hoặc POST thay vì query string.

### F11 [TRUNG BÌNH] Client coi lỗi 5xx/429 của backend là "không có giao dịch hiệu lực"

- Vị trí: `billing.js:262-264` (`network:false` cho mọi phản hồi HTTP), `456-474` (`restore`).
- Kịch bản: Worker trả 502 (Google quá tải/quyền SA chưa hiệu lực, đúng lỗi README nói thường gặp) hoặc 429. `restore()` không đánh dấu `network`, rơi xuống nhánh "có giao dịch nhưng không còn hiệu lực": gọi `refresh` rồi trả `{ok:true, status:"inactive"}`. Người đã trả tiền thấy "không còn hiệu lực" thay vì "thử lại".
- Bằng chứng: `[F11]` fail ("trả {ok:true,status:inactive}").
- Cách vá:

```js
// verify():
return { ok: res.ok && !!data, network: false, transient: res.status >= 500 || res.status === 429, status: res.status, data: data };
// restore():
} else if (v.network || v.transient) { anyNetworkFail = true; }
```

### F12 [THẤP] `testPurchase` được chấp nhận ở production, không đánh dấu, không cấu hình

- Vị trí: `index.js:56` (đọc), `366` (`_test` bị bỏ), `stripInternal` (369-372) loại hẳn.
- Kịch bản: mọi tài khoản trong danh sách License testing (Play Console) tạo giao dịch thử, nhận Pro ở production giống người trả tiền, và bản ghi KV không phân biệt được: số liệu doanh thu/chuyển đổi bị nhiễu, không có công tắc để tắt khi phát hành chính thức. Rủi ro thấp vì danh sách tester do nhà phát triển kiểm soát.
- Bằng chứng: `[F12a]`, `[F12b]`.
- Cách vá:

```js
// refreshRecord: rec.test = !!parsed.testPurchase;
// handleVerify: sau refreshRecord
if (rec._test && env.REJECT_TEST_PURCHASES === "1")
  return json({ error: "test_purchase_not_allowed", message: "Giao dịch thử không được chấp nhận." }, 403, cors);
```

### F13 [THẤP] `deviceId` không có bằng chứng sở hữu

- Vị trí: `index.js:301-307`, `426`; `billing.js:94-105`.
- Trả lời câu hỏi A (deviceId): biết `deviceId` của người khác **không** đủ để chiếm gói của họ (cần token hợp lệ để gắn vào). Nhưng: (1) `GET /api/entitlement?deviceId=` đọc được trạng thái gói không cần xác thực; (2) kẻ có 20 token hợp lệ (kể cả hết hạn hay token license-tester, `verify` không đòi active) gắn chúng vào `deviceId` nạn nhân thì `list.slice(-20)` đẩy token thật ra, nạn nhân mất Pro (`[F13a]`); (3) `billing.js:103` dự phòng bằng UUID hằng số công khai `00000000-0000-4000-8000-000000000000` mà worker chấp nhận (`UUID_RE` không loại UUID zero): mọi người dùng lỗi-localStorage dùng chung định danh, và ai cũng đọc được `entitlement` của nó (`[F13b]`). Đường dẫn catch đó khó chạm tới trong thực tế (mọi thao tác storage đã tự bắt lỗi), nhưng worker không nên chấp nhận.
- Cách vá:

```js
// a) loại UUID zero/hằng số
if (/^0{8}-0{4}-/.test(deviceId)) return json({ error: "bad_device", message: "Mã thiết bị không hợp lệ." }, 400, cors);
// b) khi cắt danh sách, bỏ token KẾT THÚC trước
list.push(hash);
while (list.length > MAX_TOKENS_PER_DEVICE) {
  const i = (await Promise.all(list.map((h) => kvGet(env, "tok:" + h)))).findIndex((r) => !r || !isActive(r.state, r.expiryMs));
  list.splice(i >= 0 ? i : 0, 1);
}
// c) bằng chứng sở hữu: client sinh thêm khoá ngẫu nhiên 32 byte `solpha_dkey` (localStorage), gửi qua header x-device-key.
//    Server lưu devkey:<deviceId> = sha256(khoá) ở lần dùng đầu (TOFU) và đòi khớp ở verify/entitlement/erase.
```

### F14 [THẤP] Verify ghi đè trạng thái mới hơn của RTDN bằng ảnh chụp Google cũ

- Vị trí: `index.js:437-461` (đọc `prev`, gọi Google, ghi `finalRec` cuối cùng mà không kiểm bản ghi đã đổi chưa).
- Kịch bản: verify chụp Google (ACTIVE) rồi chờ; RTDN thu hồi chen vào ghi EXPIRED; verify ghi ACTIVE đè lên. Vì F2, trạng thái sai này **không tự sửa**.
- Bằng chứng: `[F14]` fail.
- Cách vá: trước khi ghi cuối, đọc lại bản ghi; nếu `updatedAt` mới hơn thời điểm bắt đầu fetch thì giữ trạng thái/hạn của bản ghi mới (hoặc, bền hơn, serialize qua Durable Object).

```js
const fresh = await kvGet(env, "tok:" + hash);
if (fresh && fresh.updatedAt > now) { finalRec.state = fresh.state; finalRec.expiryMs = fresh.expiryMs; finalRec.ackedAt = fresh.ackedAt; }
```

### F15 [THẤP] Đọc toàn bộ body trước khi kiểm giới hạn

- Vị trí: `index.js:407-411` (`await request.text()` rồi mới `text.length > MAX_BODY`).
- Kịch bản: POST cực lớn/stream không dừng tới `/api/verify` làm Worker nạp toàn bộ body vào RAM (giới hạn 128 MB/isolate) trước khi từ chối. Bằng chứng: `[F15]`: 40 × 64 KB đã bị đọc hết.
- Cách vá:

```js
async function readJson(request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) throw new Error("too_large");
  const reader = request.body && request.body.getReader();
  if (!reader) throw new Error("empty");
  const chunks = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw new Error("too_large"); }
    chunks.push(value);
  }
  return JSON.parse(await new Blob(chunks).text());
}
```

### F16 [TRUNG BÌNH có điều kiện] Pro chỉ là cờ phía client

- Vị trí: `billing.js:140-180` (`readCache` + `cacheGrantsPro` tin localStorage), `billing.js:174` (`isPro`).
- Rủi ro cần ghi rõ: `isPro()` quyết định chỉ dựa trên `localStorage["solpha_ent"]`. Bất kỳ ai mở bản web công khai `https://solpha.pages.dev` (không cần TWA) đều có DevTools; chỉ cần `localStorage.solpha_ent = JSON.stringify({active:true, expiryMs: Date.now()+3e11, sku:"solpha_pro_yearly", fetchedAt: Date.now()})` hoặc ghi đè `SolphaBilling.isPro = () => true`. Đặt `fetchedAt` = thời điểm hiện tại cũng chặn `refresh()` gọi mạng trong 5 phút (`CACHE_TTL_MS`). TWA trong thực tế không có DevTools thuận tiện nhưng người dùng vẫn có thể mở bản web, dùng `chrome://inspect` hoặc sửa gói. Ngoài ra đồng hồ thiết bị lùi lại kéo dài cửa sổ ngoại tuyến 72 giờ.
- Mức chấp nhận được: nếu Pro chỉ mở các tiện ích trình bày/tính toán nằm sẵn trong mã JS tĩnh tải công khai thì **không thể bảo vệ bằng gating phía client**, và mọi cách ký/obfuscate cũng chỉ nâng độ khó chứ không chặn được. Đó là rủi ro doanh thu, không phải rủi ro an ninh người dùng; chấp nhận được nếu tổn thất = "người dùng tự mở khoá tính năng miễn phí".
- Bằng chứng: `[F16]` fail (`isPro()` = true với cache tự viết). Test này minh hoạ rủi ro **chấp nhận được**, không phải lỗi có cách vá hoàn toàn phía client.
- Đề xuất: bất cứ thứ gì thật sự đáng bảo vệ (ví dụ nguồn tín hiệu, tệp dữ liệu độc quyền, tổng hợp/quét nặng) phải do **Worker phục vụ có kiểm entitlement**, không nằm trong JS tĩnh:

```js
// 1) /api/entitlement trả thêm "ticket" ngắn hạn: HMAC(secret, deviceId|expiry|exp10phút) hoặc ECDSA JWT.
// 2) Endpoint dữ liệu Pro:  GET /api/pro/<resource>  với  Authorization: Bearer <ticket>  -> 402 nếu hết hạn.
// 3) Client chỉ hiển thị cờ UI từ isPro(); dữ liệu thật chỉ lấy được khi ticket hợp lệ.
```

  Thêm ràng buộc phía client nhẹ để hạn chế sửa bừa (không thay thế bảo vệ máy chủ): ký bản ghi cache bằng chữ ký của Worker và kiểm bằng khoá công khai nhúng sẵn.

### F17 [THÔNG TIN] Kiểm Origin không phải biên xác thực

- `index.js:577-578`: yêu cầu **không có** header `Origin` (curl, máy chủ, ứng dụng gốc) luôn được chấp nhận; CORS chỉ bảo vệ khỏi trang web lạ gọi bằng trình duyệt. Điều đó đúng thiết kế vì API không dùng cookie/credential môi trường nên không có CSRF; `Origin` do trình duyệt đặt và không giả được ở bối cảnh trình duyệt (CONTROL-2).
- `DEFAULT_ORIGINS` (`index.js:18`) luôn được cộng vào danh sách phép, kể cả với gói thương mại (`dist/solpha-commercial` đã thay thành `{{DOMAIN}}`). Nên cho phép tắt.
- Request `text/plain` đơn giản từ trang lạ vẫn có `Origin` nên bị 403 (`index.js:593`). `/api/entitlement` GET `no-cors` không gửi `Origin` nhưng phản hồi là opaque, chỉ gây tốn tài nguyên (đã tính trong F9).

### F18 [THÔNG TIN] Log lỗi chứa mảnh dữ liệu đầu vào

- `index.js:561-564`: `log("error","rtdn_error",{err: String(e.message)})`. Thông điệp `JSON.parse` của V8 chứa 10 ký tự đầu của chuỗi (ví dụ `Unexpected token 'S', "SECRETTOKE"... is not valid JSON`). Cần khoá RTDN hợp lệ nên rủi ro rất nhỏ, nhưng tiền lệ xấu với quy tắc "không bao giờ log token". Cách vá: ghi `e.name` (hoặc mã lỗi tự định nghĩa) thay cho `e.message` ở mọi `catch` có xử lý dữ liệu người dùng (`index.js:450`, `498`, `562`, `615` an toàn hơn vì chỉ có lỗi Google). Bằng chứng: `[F18]`.

### F19 [THÔNG TIN] Các điểm phụ

- Dự phòng IP: `request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown"` (`index.js:596`). Trên Cloudflare, `cf-connecting-ip` luôn có và client không đặt được, nên `x-forwarded-for` giả mạo không khai thác được; nhưng nếu Worker bị đặt sau proxy khác hoặc chạy ngoài Cloudflare thì mỗi request đổi `X-Forwarded-For` là một bucket mới, còn trường hợp thiếu cả hai thì mọi người dùng chung bucket `"unknown"`. Nên chỉ tin `cf-connecting-ip`.
- `billing.js` **chưa được nhúng** vào `index.html`/`app.js` (grep không tìm thấy `SolphaBilling`); chưa có UI "Khôi phục giao dịch" nên toàn bộ luồng khôi phục của F3 hiện chưa tới được người dùng. `API_BASE` còn placeholder.
- `wrangler.toml` có `workers_dev = true` (URL công khai `*.workers.dev`), `kv id` còn placeholder, không bật `observability` (xác nhận cấu hình Workers Logs theo F10).
- KV nhất quán cuối cùng: đọc ở vùng khác có thể thấy giá trị cũ vài chục giây, kể cả "không tồn tại" bị cache. Client dùng ngay phản hồi của `verify` nên mua xong vẫn thấy Pro; thu hồi có độ trễ phát tán.
- Đồng thời ack kép: hai `verify` song song cho cùng token cùng gọi acknowledge; lần hai có thể lỗi, khiến `ackedAt` bị đặt `null` và phản hồi `ackPending:true` (tự khỏi ở lần làm mới sau 10 phút).
- Mỗi ghi `tok:` chạy 2-3 lần ghi KV mỗi lần verify (`index.js:354`, `461`, `463`); gói miễn phí 1.000 lượt ghi/ngày đủ cho khoảng 300 lượt mua/khôi phục mỗi ngày.

---

## 4. Trả lời các mục kiểm tra A-I

| Mục | Câu hỏi | Kết luận | Bằng chứng |
|---|---|---|---|
| A1 | Gọi `/api/verify` với token người khác? | **Có** nếu có token (token là bearer) | F4, `[F4a]` |
| A2 | Chiếm gói thiết bị khác chỉ bằng biết deviceId? | **Không** chiếm được gói; **Có** đọc được trạng thái và đẩy token thật ra bằng 20 token hợp lệ | F13, `[F13a]` |
| A3 | Cướp gói bằng token nghe lén (chuyển quyền)? | **Có**, không giới hạn số lần | F4, `[F4a]` |
| A4 | `sku` client có được so với `lineItems[].productId` thật? | **Có**, đúng (`index.js:454`) | CONTROL-9 |
| A5 | Dùng `obfuscatedExternalAccountId`? | **Không** | `[F4b]` |
| B1 | So sánh khoá RTDN hằng-thời-gian, độ dài khác nhau? | **Đúng** (băm cả hai rồi XOR) | CONTROL-1 |
| B2 | Lộ khoá trong URL/log? | **Có rủi ro** (URL, `wrangler tail`); Worker tự không log khoá | F7 |
| B3 | Replay | **Có**: không dedupe; void bị ép vô điều kiện | F6, F7 |
| B4 | Payload khổng lồ | **Không** cho RTDN; **Có** cho `/api/verify` | F15 |
| B5 | Thông báo gói app khác | **Không bị xử lý** (đúng) | CONTROL-3 |
| C1 | Đua giữa các verify song song | **Có** | F5, F14 |
| C2 | RTDN muộn ghi đè trạng thái mới? | **Không**: RTDN luôn lấy trạng thái từ Google (CONTROL-4). Nhưng verify cũ ghi đè trạng thái RTDN mới (F14) | CONTROL-4, `[F14]` |
| C3 | `dev:<deviceId>` tăng vô hạn | **Không**: giới hạn 20 (`slice(-20)`), nhưng cắt sai thứ tự (F13) | `[F13a]` |
| C4 | Kích thước giá trị / TTL KV | Giá trị nhỏ (mỗi bản ghi < ~6 KB); **không có TTL** | F10, `[F10a]` |
| D1 | AES-GCM IV tái sử dụng? | **Không** | CONTROL-5 |
| D2 | Phân tách khoá khi thiếu `TOKEN_ENC_KEY` | **Không**; dùng chung `RTDN_KEY` | F8, `[F8a]` |
| D3 | JWT RS256 (exp, iat, scope), cache access token | **Đúng**: scope hẹp, `exp-iat ≤ 3600`, cache với đệm 60 giây, `inflight` chống bão | CONTROL-6 |
| D4 | So sánh hằng thời gian; PEM | **Đúng**; PEM xử lý bằng xoá header/khoảng trắng (khoá PKCS#1 sẽ lỗi `importKey` → 502, chấp nhận được vì khoá Google luôn PKCS#8) | CONTROL-1 |
| E1 | Origin so khớp đúng? `endsWith`/`includes`? | **Đúng**, so khớp chính xác bằng `Set` | CONTROL-2 |
| E2 | `ACAO: *` vô tình? | **Không** | CONTROL-2 |
| E3 | Rate limit bị vô hiệu bằng nhiều isolate/IPv6? | **Có** | F9 |
| E4 | XFF giả mạo | Không khai thác được trên Cloudflare; dự phòng yếu | F19 |
| F1 | Trạng thái → quyền lợi | ACTIVE, CANCELED (còn hạn), IN_GRACE_PERIOD = có; ON_HOLD, PAUSED, PENDING, EXPIRED, trạng thái lạ = không (**đúng, đóng-khi-lạ**) | CONTROL-7 |
| F2 | Hoàn tiền (voided) có thu hồi? | **Có** nhưng mong manh (F1, F2, F6) | `[F1]`, `[F2]`, `[F6]` |
| F3 | `testPurchase` ở production | Chấp nhận, không cấu hình | F12 |
| F4 | `linkedPurchaseToken` vô hiệu token cũ? | **Có** (`index.js:357-365`: đánh dấu `REPLACED`), nhưng chỉ khi token mới được verify và chỉ một bước; token cũ còn nằm trong `dev:` (vô hại vì không active) | đọc mã |
| G1 | Tin cache localStorage | **Có**, chấp nhận được nếu chỉ gating UI | F16 |
| G2 | `response.complete` đúng thời điểm? | **Có**: `success` chỉ sau khi backend xác nhận active (`billing.js:363-366`); `fail` khi từ chối/ lỗi | test cũ |
| G3 | Backend chết sau khi Google tính tiền | **Mất quyền lợi sau thanh toán**; không tự thử lại | F3, `[F3a]` |
| H | Quyền riêng tư | Dữ liệu đúng như khai về nội dung, **sai** về văn bản/khai báo/thời hạn/xoá | F10 |
| I | Chạy lại test | Bộ cũ 39/39 qua; bộ kiểm toán 26 fail / 9 control qua | mục đầu |

## 5. Những điều ĐÃ làm đúng

1. Trạng thái luôn lấy từ Google (`subscriptionsv2.get`), RTDN chỉ là "tín hiệu đánh thức", không tin loại thông báo trong payload (CONTROL-4).
2. `sku` được kiểm với danh sách phép **và** với `lineItems[].productId` thật (CONTROL-8, CONTROL-9); token vô hiệu không ghi KV.
3. Acknowledge đúng điều kiện: chỉ khi `ACTIVE/CANCELED/IN_GRACE_PERIOD` còn hạn, không ack giao dịch `PENDING`; ack thất bại trả `ackPending` và được thử lại.
4. Fail-closed với trạng thái lạ (CONTROL-7) và với `expiryTime` đã qua dù trạng thái còn ACTIVE.
5. `purchaseToken` không bao giờ nằm nguyên văn trong KV hay log; khoá KV dùng SHA-256; AES-GCM IV ngẫu nhiên 12 byte (CONTROL-5).
6. JWT service account: scope tối thiểu, `aud` đúng, thời hạn ≤ 3600 giây, cache access token, chống nhiều yêu cầu cùng lấy token (`inflight`), thử lại 1 lần khi 401 (CONTROL-6).
7. So sánh khoá RTDN hằng-thời-gian bằng băm cả hai (CONTROL-1); khoá rỗng bị từ chối.
8. CORS chặt: so khớp chính xác, không `*`, `Vary: Origin`, preflight 403 cho origin lạ (CONTROL-2); không dùng cookie nên không có CSRF.
9. RTDN của gói khác và `testNotification` được xử lý đúng; mã hoá URL (`encodeURIComponent`) cho `PACKAGE_NAME`, `sku`, `purchaseToken` nên không bị chèn đường dẫn/SSRF.
10. Làm mới tối đa 1 lần/token/10 phút khi Google lỗi (tránh dồn dập).
11. Client: `complete("success")` chỉ sau khi backend xác nhận; không ném lỗi ra ngoài; hạn offline 72 giờ có chặn hạn gói và chặn `fetchedAt` ở tương lai (>60 giây).
12. Dữ liệu cá nhân tối thiểu: không email, tên, IP trong KV; log chỉ có tiền tố băm 8 ký tự.

## 6. Giả định CHƯA xác nhận được

Lưu ý phương pháp: `WebFetch` tới `developers.google.com` thất bại (host không nằm trong danh sách mạng cho phép của phiên: `getaddrinfo ENOTFOUND`). Các đối chiếu với tài liệu Google chỉ dựa trên kết quả `WebSearch` (trích đoạn trang tài liệu và bài viết bên thứ ba), **chưa đọc nguyên văn tài liệu hiện hành**. Cần xác nhận trước khi phát hành:

1. PaymentRequest/Digital Goods trong TWA có cho truyền `obfuscatedAccountId`/`obfuscatedProfileId` khi mua không? Nếu không, F4b chỉ áp dụng được cho giải pháp khác (ví dụ client Android gốc); khi đó F4a (giới hạn chuyển quyền) là biện pháp duy nhất.
2. Với `IN_GRACE_PERIOD`, `lineItems[].expiryTime` của Google là hạn gốc đã qua hay hạn đã được kéo dài hết thời gian ân hạn? Nếu là hạn gốc đã qua thì `isActive` (`index.js:62`) làm người trong ân hạn mất quyền ngay, trái mục đích. Test cũ giả định hạn tương lai.
3. Sau hoàn tiền **không kèm revoke** (hoặc void một kỳ gia hạn), `subscriptionsv2.get` trả trạng thái gì? Quyết định F6 là lỗi hay hành vi mong muốn. Tương tự: ngữ nghĩa chính xác của `voidedPurchaseNotification` (`productType`, `refundType`, `orderId`) với đăng ký gia hạn.
4. `purchases.subscriptions.acknowledge` (v1) hiện còn là đường ack khuyến nghị cho đăng ký quản lý từ `subscriptionsv2`; phản hồi khi ack lại một giao dịch đã ack là lỗi hay 200 (ảnh hưởng ghi chú "ack kép" ở F19).
5. `response.complete("fail")` sau khi Google **đã tính tiền** có làm Play huỷ/hoàn giao dịch ngay hay chỉ đóng giao diện thanh toán (`billing.js:370`)? Nếu hoàn ngay thì F3 nhẹ hơn nhưng trải nghiệm vẫn hỏng.
6. `wrangler tail`, Workers Logs, Logpush có ghi query string `?key=` và `?deviceId=` không (F7, F10)? Cấu hình `observability` mặc định của tài khoản.
7. Cloudflare Rate Limiting binding (`type = "ratelimit"`) có sẵn ở gói đang dùng và cú pháp `wrangler.toml` hiện hành; số liệu hạn mức KV miễn phí (100.000 đọc, 1.000 ghi/ngày) theo bảng giá hiện hành.
8. Định dạng token OIDC của Pub/Sub push (các claim `iss`, `aud`, `email`, `email_verified`) và URL JWKS đúng như đoạn vá F7; bài viết bên thứ ba cho biết đó là cách thông dụng, chưa đối chiếu tài liệu Pub/Sub.
9. `listPurchases()` của Digital Goods có còn trả giao dịch đã bị void/hết hạn không (quyết định cách `restore()` hiển thị `inactive`).
10. Google trả 410/400 như thế nào cho token cũ hơn thời hạn lưu của Play (ảnh hưởng nhánh `INVALID`, `index.js:278`); khoảng thời gian ân hạn `ON_HOLD`/`PAUSED` thực tế.
11. Độ trễ nhất quán KV giữa các vùng và việc cache giá trị "không tồn tại" (F19).
12. Mức độ Cloudflare tạo nhiều isolate trên một vùng khi tải thấp (ảnh hưởng quy mô của F9: một IP đơn lẻ thường chạm cùng một isolate, nên giới hạn đúng với kẻ tấn công đơn giản, sai với kẻ có IPv6/botnet).
13. Hạn mức Data safety: Cloudflare là "service provider" nên không phải khai "chia sẻ", và IP trong log máy chủ có phải khai "Device or other IDs" hay không (đã được `POLICY-ANSWERS.md` ghi là chưa xác nhận).

## 7. Thứ tự vá đề xuất

1. **Trước khi phát hành bản Pro (chặn):** F3 (client lưu token chờ + server ack khi RTDN token lạ), F1 + F2 (RTDN trả 503 khi lỗi + thu hồi void độc lập Google + làm mới định kỳ 6 giờ), F10 (sửa `privacy.html`, Data safety, thêm TTL và thao tác xoá), F8a (bắt buộc `TOKEN_ENC_KEY`).
2. **Ngay sau đó:** F5 (một dòng lọc `rec.deviceId`), F6, F11, F7 (OIDC), F9 (Cloudflare Rate Limiting, IPv6 /64).
3. **Củng cố:** F4a/F4b, F12, F13, F14, F15, F18, F19.
4. **Quyết định kinh doanh:** F16: chọn điều gì thật sự cần bảo vệ và chuyển sang phục vụ từ Worker với `ticket`; nếu không, ghi nhận là rủi ro chấp nhận được.
5. Bổ sung test hồi quy: chuyển các test `[F#]` đã được vá từ `audit-poc.test.mjs` vào bộ test chính, giữ `CONTROL-*` làm lưới an toàn.
