# SOLPHA Billing - backend xác minh Google Play Billing

Cloudflare Worker xác minh giao dịch gói SOLPHA Pro (`solpha_pro_monthly`, `solpha_pro_yearly`) với Google Play Developer API, acknowledge giao dịch và lưu quyền lợi (entitlement) trong KV. Client là `billing.js` ở gốc repo (`window.SolphaBilling`).

```
App (TWA app.solpha.desk) --Digital Goods + PaymentRequest--> Google Play
        |  purchaseToken
        v
POST /api/verify  --->  Worker  --->  Google Play Developer API (subscriptionsv2.get + acknowledge)
GET  /api/entitlement   Worker  <---  KV "ENT"
POST /api/rtdn   <---  Pub/Sub push <--- Google Play (gia hạn, huỷ, hết hạn, hoàn tiền...)
```

Quyền riêng tư: chỉ lưu `deviceId` (UUID ngẫu nhiên do app sinh), băm SHA-256 của `purchaseToken`, và `purchaseToken` đã mã hoá AES-GCM (để làm mới trạng thái về sau). Không log token hay secret. Chi tiết, thời hạn lưu và cách xoá: xem mục [Dữ liệu lưu và cách xoá](#dữ-liệu-lưu-và-cách-xoá).

## Chi phí dự kiến

| Hạng mục | Gói miễn phí | Ghi chú |
|---|---|---|
| Cloudflare Workers | 100.000 yêu cầu/ngày | Đủ cho hàng nghìn người dùng |
| Cloudflare KV | 100.000 lượt đọc, 1.000 lượt ghi/ngày | Mỗi lần mua mới ghi ~3 lần. Nếu vượt: Workers Paid 5 USD/tháng |
| Google Cloud Pub/Sub | 10 GB/tháng | RTDN rất nhẹ, thực tế 0 đồng |
| Google Play Developer API | Hạn mức mặc định 200.000 lượt/ngày | Worker chỉ gọi khi mua mới, RTDN, hoặc làm mới (token cần gấp: tối đa 1 lần/10 phút; token đang active: tối đa 1 lần/6 giờ khi thiết bị hỏi `entitlement`) |
| Phí Google Play | 15% doanh thu gói thuê bao | Theo chính sách Google, ngoài chi phí hạ tầng |

Tổng chi phí hạ tầng ở quy mô nhỏ: 0 đồng.

## Bước 1. Tạo Google Cloud project và bật API

1. Vào https://console.cloud.google.com, tạo project mới (ví dụ `solpha-billing`).
2. Menu **APIs & Services → Library**, tìm **Google Play Android Developer API** và bấm **Enable**.
3. Cũng trong project này, bật **Cloud Pub/Sub API** (cho bước RTDN).

## Bước 2. Tạo service account và cấp quyền trong Play Console

1. Google Cloud: **IAM & Admin → Service Accounts → Create service account** (tên `solpha-billing`). Không cần gán role Cloud nào.
2. Mở service account vừa tạo → tab **Keys → Add key → Create new key → JSON**. File JSON tải về là bí mật, **không commit vào git**.
3. Ghi lại email service account (dạng `solpha-billing@<project>.iam.gserviceaccount.com`).
4. Play Console (https://play.google.com/console) → **Users and permissions → Invite new users**:
   - Email: email service account ở trên.
   - Mục **Account permissions**, tích hai quyền:
     - **View financial data, orders, and cancellation survey responses**
     - **Manage orders and subscriptions**
   - Bấm **Invite user**. (Có thể giới hạn ở riêng app SOLPHA ở tab **App permissions**.)
5. Quyền mới có thể mất **vài giờ** (đôi khi tới ~24 giờ) mới có hiệu lực. Trong lúc chờ, Google trả lỗi 401/403 `The caller does not have permission` - đây là bình thường.

## Bước 3. Tạo KV và cấu hình Worker

Cần Node 18+ và tài khoản Cloudflare (miễn phí).

```bash
cd worker
npx wrangler login
npx wrangler kv namespace create ENT
```

Lệnh trả về `id`. Dán vào `wrangler.toml`, thay `THAY_BANG_ID_KV_NAMESPACE`. Kiểm tra lại `PACKAGE_NAME = "app.solpha.desk"` và `ALLOWED_ORIGINS` (mặc định `https://solpha.pages.dev` luôn được phép; thêm origin khác cách nhau bằng dấu phẩy).

## Bước 4. Đặt secret và triển khai

```bash
# Dán nguyên nội dung file JSON của service account khi được hỏi
npx wrangler secret put GOOGLE_SA_JSON

# BẮT BUỘC. Khoá mã hoá purchaseToken trong KV, >= 32 ký tự ngẫu nhiên, KHÁC RTDN_KEY. Sinh bằng: openssl rand -hex 32
# Thiếu hoặc ngắn hơn 32 ký tự: /api/verify trả 500 server_misconfigured, /api/rtdn trả 500, /api/health báo "configured": false.
# (Bản cũ dùng RTDN_KEY thay thế khi thiếu khoá này: đã bỏ vì RTDN_KEY nằm trong URL đăng ký Pub/Sub.)
npx wrangler secret put TOKEN_ENC_KEY

# Chỉ khi KHÔNG dùng OIDC (xem Bước 5): chuỗi ngẫu nhiên >= 32 ký tự cho ?key= của RTDN. Sinh bằng: openssl rand -hex 32
# Ngắn hơn 32 ký tự: Worker từ chối mọi RTDN (401, log rtdn_key_missing_or_weak).
npx wrangler secret put RTDN_KEY

npx wrangler deploy
```

Kiểm tra cấu hình sau khi deploy: `curl .../api/health` phải trả `"configured": true` (chỉ cho biết khoá mã hoá đã đặt đúng, không lộ giá trị nào).

Sau khi deploy, Wrangler in ra URL dạng `https://solpha-billing.<subdomain>.workers.dev`. Kiểm tra:

```bash
curl https://solpha-billing.<subdomain>.workers.dev/api/health
# {"ok":true,"service":"solpha-billing",...}
```

Sau đó mở `billing.js` ở gốc repo, sửa hằng `API_BASE` thành URL trên, rồi thêm `<script src="billing.js"></script>` vào `index.html` trước `app.js` (việc này nằm ngoài phạm vi thư mục `worker/`, làm riêng).

### Xoay khoá

- `RTDN_KEY` đổi tuỳ ý bất cứ lúc nào (nhớ cập nhật URL của Pub/Sub subscription); nó không còn liên quan tới mã hoá. Nếu khoá từng bị lộ qua URL/log, đổi ngay.
- `TOKEN_ENC_KEY` xoay không mất dữ liệu: bản mã có dạng `v2.<kid>.<...>` (AES-256-GCM, khoá dẫn xuất bằng HKDF, gắn với băm token nên không tráo được giữa các bản ghi). Để xoay: đặt `TOKEN_ENC_KEY_ID` (biến trong `wrangler.toml`) sang id mới (ví dụ `k2`), `wrangler secret put TOKEN_ENC_KEY` bằng khoá mới, và `wrangler secret put TOKEN_ENC_KEYS_OLD` với giá trị `k1:<khoá cũ>`. Worker giải mã bằng khoá cũ khi cần và tự mã hoá lại bằng khoá mới lần làm mới kế tiếp; khi mọi bản ghi đã ghi lại (tối đa hết hạn gói), có thể xoá `TOKEN_ENC_KEYS_OLD`.
- Nếu một bản ghi không giải mã được (khoá sai/mất), Worker KHÔNG im lặng: log cảnh báo `token_decrypt_failed` kèm `reason` (`unknown_kid`, `auth_failed`...). Theo dõi log này sau mỗi lần đổi khoá.

## Bước 5. Real-time Developer Notifications (RTDN)

RTDN giúp quyền lợi cập nhật gần như tức thì khi gia hạn, huỷ, hết hạn, tạm dừng hoặc hoàn tiền, và là đường dự phòng để Worker tự acknowledge giao dịch nếu app (client) chết trước khi gọi `/api/verify`.

1. Google Cloud → **Pub/Sub → Topics → Create topic**, ID ví dụ `play-rtdn`.
2. Trong topic, tab **Permissions → Add principal**: `google-play-developer-notifications@system.gserviceaccount.com`, role **Pub/Sub Publisher**.
3. Tạo một **dead-letter topic** (ví dụ `play-rtdn-dead`) để giữ thông báo hỏng kéo dài (Worker trả 503 khi có lỗi tạm thời và Pub/Sub sẽ gửi lại; xem bên dưới).
4. **Subscriptions → Create subscription** cho topic đó:
   - Delivery type: **Push**
   - Acknowledgement deadline: 30 giây; Retry policy: **exponential backoff** (ví dụ tối thiểu 10 giây, tối đa 10 phút); bật **dead-letter** với `play-rtdn-dead`, số lần gửi tối đa khoảng 20.
   - Xác thực, **chọn MỘT** trong hai (khuyến nghị OIDC):
     - **OIDC (khuyến nghị bật)**: tạo service account riêng cho việc push (ví dụ `pubsub-push@<project>.iam.gserviceaccount.com`), cấp cho Pub/Sub quyền tạo token cho nó. Khi tạo subscription bật *Enable authentication*, chọn service account đó, **Audience** = `https://solpha-billing.<subdomain>.workers.dev/api/rtdn`, Endpoint URL = đúng URL đó, KHÔNG có `?key=`. Bằng CLI: `gcloud pubsub subscriptions create play-rtdn-push --topic=play-rtdn --push-endpoint=<URL> --push-auth-service-account=<SA> --push-auth-token-audience=<URL>` (kiểm tra cờ theo tài liệu gcloud hiện hành). Rồi trong `wrangler.toml` bỏ comment `RTDN_AUDIENCE` (= Audience ở trên) và `PUSH_SA_EMAIL` (= email service account) và `wrangler deploy`. Worker kiểm chữ ký RS256 theo khoá công khai của Google, `iss`, `aud`, `email`, `email_verified`, `exp`; khi bật OIDC thì `?key=` không còn được chấp nhận. Nếu Worker không lấy được khoá công khai của Google, nó trả 503 để Pub/Sub gửi lại.
     - **Khoá trong URL**: Endpoint URL = `https://solpha-billing.<subdomain>.workers.dev/api/rtdn?key=<RTDN_KEY>`. Khoá phải >= 32 ký tự; nó nằm trong URL nên người xem cấu hình subscription hoặc `wrangler tail` thấy được: **hãy bật OIDC khi có thể**, và đổi khoá nếu nghi lộ.
5. Play Console → chọn app → **Monetize with Play → Monetization setup → Real-time developer notifications**:
   - Topic name: `projects/<project-id>/topics/play-rtdn`
   - Notification content: **Subscriptions, voided purchases and all one-time products** (hoặc tối thiểu Subscriptions và voided purchases).
   - Bấm **Send test notification**. Worker trả 200 và ghi log `rtdn_test` (xem bằng `npx wrangler tail`).
6. Nếu chưa thấy thông báo, kiểm tra `npx wrangler tail`: sai key/OIDC thấy 401 (và Pub/Sub sẽ gửi lại).

Mã trả về cho Pub/Sub (chủ ý):

| Mã | Khi nào | Pub/Sub làm gì |
|---|---|---|
| 200 | Đã xử lý; `testNotification`; gói app khác; sku không thuộc app; payload hỏng/quá lớn (lỗi vĩnh viễn); token Google báo không tồn tại | Coi như xong |
| 401 | Sai khoá / sai OIDC / `RTDN_KEY` ngắn hơn 32 ký tự | Gửi lại (sửa cấu hình rồi thông báo sẽ qua) |
| 500 | `TOKEN_ENC_KEY` thiếu/yếu | Gửi lại |
| 503 | Lỗi tạm thời: Google API/OAuth lỗi, KV lỗi, không lấy được khoá OIDC | Gửi lại với backoff; sau số lần tối đa vào dead-letter topic: **hãy giám sát topic này** |

Hai điều chủ ý: thông báo hoàn tiền (`voidedPurchaseNotification`) được ghi `REVOKED` NGAY, không cần gọi Google (nên không bị mất khi Google lỗi); và thông báo của token chưa từng được app xác minh khiến Worker tự hỏi Google, acknowledge nếu hợp lệ rồi lưu bản ghi chưa gắn thiết bị (để người dùng đã trả tiền không bị Google tự hoàn sau 3 ngày dù app không gọi được `/api/verify`).

## Bước 6. Kiểm thử bằng license tester

1. Play Console → **Settings → License testing** → thêm email Gmail của bạn vào danh sách tester.
2. Phát hành bản app (TWA) lên **Internal testing** hoặc Closed testing, và tạo hai gói `solpha_pro_monthly`, `solpha_pro_yearly` ở **Monetize with Play → Products → Subscriptions** (kích hoạt base plan; thêm offer dùng thử 7 ngày nếu muốn). Gói phải ở trạng thái **Active**.
3. **Đặt `ALLOW_TEST_PURCHASES = "true"`** trong `wrangler.toml` rồi `wrangler deploy` (mặc định `"false"`: giao dịch của license tester bị từ chối với `403 test_purchase_not_allowed`; bản ghi vẫn được lưu kèm `test: true`). Nhớ đặt lại `"false"` khi phát hành chính thức. Cài app từ link Internal testing bằng tài khoản tester, bấm nâng cấp. Giao dịch tester không bị tính tiền và chu kỳ được rút ngắn (ví dụ gói tháng gia hạn mỗi 5 phút, tối đa 6 lần) nên thấy ngay vòng đời gia hạn, hết hạn.
4. Theo dõi `npx wrangler tail` để xem `verify`, `rtdn_refreshed`. Kiểm tra bằng:

```bash
curl "https://solpha-billing.<subdomain>.workers.dev/api/entitlement?deviceId=<UUID trong localStorage solpha_device>"
```

Kiểm thử chỉ chạy được trong TWA cài từ Google Play (hoặc bản cài từ internal test). Chạy thường trong trình duyệt sẽ không có Digital Goods API và app hiện "Mở bằng app trên Google Play để nâng cấp".

## Chạy test cục bộ

```bash
node --test worker/test/*.test.mjs
```

Các file test: `worker.test.mjs` và `billing-client.test.mjs` (đường thuận), `hardening.test.mjs` (hành vi sau kiểm toán), `audit-poc.test.mjs` (bằng chứng khai thác của đợt kiểm toán, xem `docs/audit/BILLING-AUDIT.md`). Node 22: tham số thư mục (`node --test worker/test/`) không được nhận nữa, hãy dùng glob như trên (hoặc chạy `node --test` từ thư mục `worker/`). Test dùng `fetch` giả của Google, KV giả trong bộ nhớ và khoá RSA sinh tại chỗ, không cần mạng hay tài khoản.

## Hành vi cần biết

- Một `purchaseToken` thuộc một thiết bị tại một thời điểm. Bấm "Khôi phục giao dịch" trên máy mới sẽ chuyển quyền sang máy đó (máy cũ mất Pro: `entitlement` chỉ tính token mà bản ghi `tok:` đang ghi là của thiết bị hỏi). Chuyển tối đa **3 lần / 30 ngày / token**, sau đó `429 transfer_limited` (chống chia sẻ/cướp gói bằng token bị lộ).
- Gắn tài khoản (tuỳ chọn): nếu Google trả `externalAccountIdentifiers.obfuscatedExternalAccountId` thì Worker yêu cầu nó bằng `sha256(deviceId)` (hex), sai thì `403 account_mismatch`; client cũng có thể gửi `obfuscatedExternalAccountId` trong `/api/verify` và phải khớp. Phía client, `SolphaBilling.config.bindAccount = true` thêm `obfuscatedAccountId` vào PaymentRequest. **CHƯA XÁC NHẬN trên thiết bị thật** (TWA/Digital Goods có chấp nhận trường này không) nên mặc định TẮT; hãy thử trên bản Internal testing trước khi bật. Đánh đổi: khi bật, đổi sang thiết bị mới (deviceId khác) sẽ bị `account_mismatch`, vì Google gắn tài khoản lúc mua; cần có kế hoạch hỗ trợ trước khi bật.
- Active = trạng thái `ACTIVE`, `CANCELED` (đã huỷ gia hạn nhưng chưa hết kỳ) hoặc `IN_GRACE_PERIOD`, và chưa quá `expiryTime`. `ON_HOLD`, `PAUSED`, `PENDING`, `EXPIRED` không có quyền lợi.
- Giao dịch bị hoàn tiền/thu hồi (voided) mất quyền lợi ngay khi nhận RTDN và trạng thái `REVOKED` là "dính": `/api/verify` hay RTDN gia hạn sau đó chỉ hồi sinh nếu Google báo một `latestOrderId` MỚI khác đơn hàng bị void.
- Đối chiếu định kỳ: ngoài RTDN, mỗi lần thiết bị hỏi `entitlement`, token đang active được hỏi lại Google nếu quá 6 giờ (token chưa acknowledge hoặc hết hạn cục bộ: 10 phút). Nhờ đó RTDN bị lỡ chỉ kéo dài quyền tối đa khoảng 6 giờ sau lần mở app kế tiếp, không phải tới hết kỳ.
- Một `verify` cũ không ghi đè trạng thái mới hơn do RTDN ghi trong lúc nó chờ Google (KV không nguyên tử nên đây là giảm thiểu, không phải đảm bảo tuyệt đối; xem Giới hạn đã biết).
- Giới hạn tốc độ: `/api/verify` và `/api/delete` 10 lần/phút, `/api/entitlement` 60 lần/phút, theo IP (IPv6 gộp theo /64); chỉ tin `cf-connecting-ip`. Bộ đếm nằm trong bộ nhớ từng isolate, có giới hạn kích thước (khi đầy chỉ loại khoá hết hạn/ít nguy hiểm, không bao giờ xoá toàn bộ). Muốn chặt hơn: bật Cloudflare Rate Limiting và khai báo binding `RL_VERIFY`/`RL_ENTITLEMENT` (xem `wrangler.toml`; Worker tự dùng nếu có).
- Body yêu cầu tối đa 16 KB, đọc dạng stream và dừng ngay khi vượt (413).
- Client giữ cache `solpha_ent` 5 phút; nếu mất mạng vẫn tin cache tối đa 72 giờ kể từ lần xác nhận thành công cuối.
- **Giao dịch chờ xác minh (client)**: `purchaseToken` được lưu vào `localStorage["solpha_pending"]` TRƯỚC khi gọi `/api/verify` (tối đa 5 token, hạn 3 ngày). Nếu backend lỗi/mạng rớt sau khi Google đã tính tiền, `purchase()` trả `{ok:false, status:"pending_verification", pending:true}` (app nên hiện "đang xác minh", dùng `SolphaBilling.pending()` và sự kiện `solpha:entitlement` có `pending`), báo `complete("success")` cho Play (không báo fail vì tiền đã bị trừ), và tự thử lại khi mở app, khi mạng về (`online`), khi quay lại tab và định kỳ (1 → 15 phút) tới khi `/api/verify` thành công; lúc đó Pro được bật và hàng chờ xoá. Chỉ khi backend từ chối hẳn (400/403, hết hạn) mới bỏ token. `restore()` cũng giữ token vào hàng chờ khi gặp 5xx/429/mạng, và báo lỗi tạm thời thay vì `inactive`.

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
|---|---|
| Giao dịch bị Google tự hoàn tiền sau 3 ngày | Không acknowledge kịp. Worker acknowledge ngay khi `/api/verify` thành công và thử lại ở lần `entitlement` hoặc RTDN kế tiếp (nếu thất bại sẽ có `ackPending: true`). Kiểm tra quyền service account và log `acknowledge_failed`. Phải xong trong 3 ngày. |
| `/api/verify` trả 502 `upstream`, log `google_oauth_*` hoặc `google_api_401/403` | Service account chưa có quyền hoặc quyền chưa hiệu lực (có thể mất vài giờ), hoặc chưa bật Google Play Android Developer API trong đúng project, hoặc dán sai `GOOGLE_SA_JSON`. |
| `/api/verify` trả 400 `invalid_token` | Token sai/đã bị xoá, hoặc `PACKAGE_NAME` không khớp app. Với tester, đảm bảo giao dịch tạo từ đúng app. |
| `/api/verify` trả 400 `sku_mismatch` | Client gửi sku khác với gói trong giao dịch (không ghi KV, không acknowledge). |
| `/api/verify` trả 500 `server_misconfigured` | Thiếu hoặc ngắn hơn 32 ký tự `TOKEN_ENC_KEY` (log `server_misconfigured`). |
| RTDN không đến | Sai `?key=` hoặc sai OIDC (401 trong `wrangler tail`), chưa cấp quyền Publisher cho `google-play-developer-notifications@system.gserviceaccount.com`, hoặc nhập sai tên topic trong Play Console. |
| Pub/Sub gửi lại | Chủ ý: Worker trả 503 khi Google/KV lỗi tạm thời, 401 khi sai xác thực, 500 khi `TOKEN_ENC_KEY` thiếu. Dữ liệu hỏng vĩnh viễn vẫn trả 200. Đặt Retry policy exponential backoff và dead-letter topic, giám sát topic đó. |
| `403 test_purchase_not_allowed` | Giao dịch của license tester bị từ chối vì `ALLOW_TEST_PURCHASES` không phải `"true"` (Bước 6). |
| `429 transfer_limited` | Token đã chuyển thiết bị quá 3 lần trong 30 ngày. Người dùng liên hệ hỗ trợ; có thể xoá bản ghi bằng `wrangler kv key delete` sau khi xác minh chủ sở hữu. |
| Log `token_decrypt_failed` | Khoá mã hoá đã đổi mà không giữ khoá cũ trong `TOKEN_ENC_KEYS_OLD`, hoặc bản ghi hỏng (xem `reason`). Người dùng đó cần "Khôi phục giao dịch". |
| Trình duyệt báo CORS | Origin chưa nằm trong `ALLOWED_ORIGINS`. Thêm rồi `wrangler deploy` lại. |
| Hết hạn gói nhưng app vẫn Pro một lúc | Bình thường: cache client 5 phút và RTDN có độ trễ vài giây đến vài phút. |
| Đổi gói (nâng/hạ) | Google tạo token mới có `linkedPurchaseToken`. App gọi `restore()` hoặc mua mới sẽ verify token mới, token cũ được đánh dấu `REPLACED`. |

## Dữ liệu lưu và cách xoá

Mọi dữ liệu nằm trong KV `ENT`. Worker không lưu email, tên, số điện thoại, IP hay nội dung dữ liệu tài chính của app.

| Khoá KV | Nội dung | Thời hạn lưu (TTL) |
|---|---|---|
| `tok:<sha256(purchaseToken)>` | `sku`, `deviceId` (hoặc `null` nếu chưa gắn thiết bị), trạng thái Google (`state`, `expiryMs`, `ackedAt`, `latestOrderId`...), cờ `test`, thông tin thu hồi (`voidedAt`, `voidedOrderId`), thời điểm chuyển thiết bị, `purchaseToken` đã mã hoá AES-256-GCM (`tokenEnc`) | Hạn gói + 90 ngày; bản ghi đã kết thúc (hết hạn, thu hồi, vô hiệu, thay thế): 90 ngày |
| `dev:<deviceId>` | Danh sách băm token của thiết bị (tối đa 20) | Bằng TTL lớn nhất của các token trong danh sách (không bao giờ ngắn hơn); gia hạn khi token được gia hạn |

- `deviceId` là UUID v4 ngẫu nhiên do app sinh và lưu trong `localStorage`; nó xuất hiện trong URL của `GET /api/entitlement?deviceId=...`, nên có thể nằm trong nhật ký truy cập của Cloudflare (và trong `wrangler tail`). Log của Worker không ghi token, deviceId hay IP, chỉ tiền tố 8 ký tự của băm token và mã trạng thái. Địa chỉ IP vẫn do Cloudflare nhìn thấy như mọi Worker.
- Không bật Workers Logs/Logpush ghi URL đầy đủ nếu không cần; nếu bật, coi `deviceId` trong log là dữ liệu cần xoá theo cùng chính sách.
- **Xoá theo yêu cầu**: `POST /api/delete` với JSON `{"deviceId": "<UUID>", "proof": "<bằng chứng>"}`. `proof` là MỘT trong:
  1. một `purchaseToken` đang gắn với thiết bị đó (hoặc chưa gắn thiết bị nào): chứng minh sở hữu giao dịch;
  2. chính `deviceId` (phải là UUID v4): `deviceId` đóng vai bí mật mang theo (122 bit ngẫu nhiên), cùng mức tin cậy với việc biết nó để đọc `entitlement`. Chấp nhận được vì lệnh xoá chỉ làm người dùng mất quyền (có thể khôi phục) chứ không lộ dữ liệu; đây là điểm yếu đã biết: ai biết `deviceId` của người khác xoá được liên kết Pro của họ (họ phục hồi bằng "Khôi phục giao dịch").
  Worker xoá `dev:<deviceId>` và thay mọi `tok:` thuộc thiết bị bằng dấu xoá không chứa dữ liệu cá nhân (chỉ băm, giữ 90 ngày để RTDN muộn không tạo lại bản ghi; người dùng verify lại thì dấu xoá bị ghi đè). Token đã chuyển sang thiết bị khác không bị xoá. Client gọi bằng `SolphaBilling.deleteData()` (xoá luôn cache cục bộ và sinh `deviceId` mới).
- Người dùng mất cả `deviceId` lẫn token (gỡ app, xoá dữ liệu): bản ghi tự hết hạn theo TTL ở trên; nếu cần xoá sớm, chủ dự án tìm theo băm token (`sha256`) và `wrangler kv key delete`.

## Giới hạn đã biết

- **F16: Pro hiện chỉ là cờ phía client cho giao diện.** `SolphaBilling.isPro()` tin `localStorage["solpha_ent"]`; ai mở DevTools (kể cả bản web công khai `solpha.pages.dev`) có thể tự bật. Worker chỉ xác minh và cấp "bằng chứng" cho phía client để hiển thị đúng; nó không (và không thể) ép buộc quyền ở nơi dữ liệu là JS tĩnh tải công khai. Chấp nhận được nếu Pro chỉ mở các tiện ích nằm sẵn trong mã tĩnh (rủi ro doanh thu, không phải rủi ro an ninh người dùng). Đề xuất kiến trúc nếu sau này có nội dung thật sự cần bảo vệ (nguồn tín hiệu, dữ liệu độc quyền, tính toán nặng): đặt nội dung đó sau Worker; `GET /api/entitlement` cấp thêm một `ticket` ngắn hạn (HMAC hoặc JWT ECDSA ký bằng bí mật của Worker, gắn `deviceId` và hạn 10 phút); các endpoint `GET /api/pro/<tài-nguyên>` đòi `Authorization: Bearer <ticket>` và trả 402 khi hết hạn; client chỉ dùng `isPro()` để hiện/ẩn giao diện. Chưa xây vì chưa có nội dung cần bảo vệ.
- **Định danh thiết bị yếu (F13c)**: chưa có khoá sở hữu thiết bị (TOFU `x-device-key`); `deviceId` chỉ là UUID ngẫu nhiên (xem mục xoá dữ liệu). Cách giảm thiểu hiện có: giới hạn 20 token, loại token vô dụng trước, giới hạn chuyển token theo token, kiểm một-token-một-thiết-bị khi đọc.
- **KV không nguyên tử**: hai `verify`/RTDN cùng lúc cho một token vẫn có cửa sổ đua rất hẹp (đã giảm bằng cách đọc lại trước khi ghi và kiểm `rec.deviceId` khi đọc: kết quả là "người ghi sau thắng", không bao giờ hai thiết bị cùng active). Nếu cần chặt tuyệt đối, chuyển trạng thái sang Durable Object/D1.
- **Giả định chưa xác nhận trên hệ thống thật** (xem mục 6 của báo cáo kiểm toán): `obfuscatedAccountId` trong TWA; `expiryTime` của `IN_GRACE_PERIOD`; trạng thái Google sau hoàn tiền không kèm revoke; cú pháp Rate Limiting binding; cờ `gcloud` cho OIDC/dead-letter.
