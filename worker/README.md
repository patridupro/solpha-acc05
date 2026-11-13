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

Quyền riêng tư: chỉ lưu `deviceId` (UUID ngẫu nhiên do app sinh), băm SHA-256 của `purchaseToken`, và `purchaseToken` đã mã hoá AES-GCM (để làm mới trạng thái về sau). Không log token hay secret.

## Chi phí dự kiến

| Hạng mục | Gói miễn phí | Ghi chú |
|---|---|---|
| Cloudflare Workers | 100.000 yêu cầu/ngày | Đủ cho hàng nghìn người dùng |
| Cloudflare KV | 100.000 lượt đọc, 1.000 lượt ghi/ngày | Mỗi lần mua mới ghi ~3 lần. Nếu vượt: Workers Paid 5 USD/tháng |
| Google Cloud Pub/Sub | 10 GB/tháng | RTDN rất nhẹ, thực tế 0 đồng |
| Google Play Developer API | Hạn mức mặc định 200.000 lượt/ngày | Worker chỉ gọi khi mua mới, RTDN, hoặc làm mới (tối đa 1 lần/token/10 phút) |
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

# Chuỗi ngẫu nhiên dài, dùng cho URL RTDN. Sinh bằng: openssl rand -hex 32
npx wrangler secret put RTDN_KEY

# (Tuỳ chọn) khoá mã hoá purchaseToken trong KV; bỏ qua thì dùng RTDN_KEY
npx wrangler secret put TOKEN_ENC_KEY

npx wrangler deploy
```

Sau khi deploy, Wrangler in ra URL dạng `https://solpha-billing.<subdomain>.workers.dev`. Kiểm tra:

```bash
curl https://solpha-billing.<subdomain>.workers.dev/api/health
# {"ok":true,"service":"solpha-billing",...}
```

Sau đó mở `billing.js` ở gốc repo, sửa hằng `API_BASE` thành URL trên, rồi thêm `<script src="billing.js"></script>` vào `index.html` trước `app.js` (việc này nằm ngoài phạm vi thư mục `worker/`, làm riêng).

> Lưu ý: đừng đổi `RTDN_KEY` hoặc `TOKEN_ENC_KEY` sau khi đã có người mua, vì token đã lưu được mã hoá bằng khoá cũ (người dùng vẫn dùng được, nhưng Worker không làm mới được các token cũ cho tới khi họ "Khôi phục giao dịch").

## Bước 5. Real-time Developer Notifications (RTDN)

RTDN giúp quyền lợi cập nhật gần như tức thì khi gia hạn, huỷ, hết hạn, tạm dừng hoặc hoàn tiền.

1. Google Cloud → **Pub/Sub → Topics → Create topic**, ID ví dụ `play-rtdn`.
2. Trong topic, tab **Permissions → Add principal**: `google-play-developer-notifications@system.gserviceaccount.com`, role **Pub/Sub Publisher**.
3. **Subscriptions → Create subscription** cho topic đó:
   - Delivery type: **Push**
   - Endpoint URL: `https://solpha-billing.<subdomain>.workers.dev/api/rtdn?key=<RTDN_KEY>` (đúng giá trị secret `RTDN_KEY`)
   - Acknowledgement deadline: 30 giây; Retry policy: exponential backoff.
4. Play Console → chọn app → **Monetize with Play → Monetization setup → Real-time developer notifications**:
   - Topic name: `projects/<project-id>/topics/play-rtdn`
   - Notification content: **Subscriptions, voided purchases and all one-time products** (hoặc tối thiểu Subscriptions và voided purchases).
   - Bấm **Send test notification**. Worker trả 200 và ghi log `rtdn_test` (xem bằng `npx wrangler tail`).
5. Nếu chưa thấy thông báo, kiểm tra `npx wrangler tail`: sai key sẽ thấy 401; Pub/Sub sẽ gửi lại cho tới khi thành công.

## Bước 6. Kiểm thử bằng license tester

1. Play Console → **Settings → License testing** → thêm email Gmail của bạn vào danh sách tester.
2. Phát hành bản app (TWA) lên **Internal testing** hoặc Closed testing, và tạo hai gói `solpha_pro_monthly`, `solpha_pro_yearly` ở **Monetize with Play → Products → Subscriptions** (kích hoạt base plan; thêm offer dùng thử 7 ngày nếu muốn). Gói phải ở trạng thái **Active**.
3. Cài app từ link Internal testing bằng tài khoản tester, bấm nâng cấp. Giao dịch tester không bị tính tiền và chu kỳ được rút ngắn (ví dụ gói tháng gia hạn mỗi 5 phút, tối đa 6 lần) nên thấy ngay vòng đời gia hạn, hết hạn.
4. Theo dõi `npx wrangler tail` để xem `verify`, `rtdn_refreshed`. Kiểm tra bằng:

```bash
curl "https://solpha-billing.<subdomain>.workers.dev/api/entitlement?deviceId=<UUID trong localStorage solpha_device>"
```

Kiểm thử chỉ chạy được trong TWA cài từ Google Play (hoặc bản cài từ internal test). Chạy thường trong trình duyệt sẽ không có Digital Goods API và app hiện "Mở bằng app trên Google Play để nâng cấp".

## Chạy test cục bộ

```bash
node --test worker/test/*.test.mjs
```

Node 22: tham số thư mục (`node --test worker/test/`) không được nhận nữa, hãy dùng glob như trên (hoặc chạy `node --test` từ thư mục `worker/`). Test dùng `fetch` giả của Google, KV giả trong bộ nhớ và khoá RSA sinh tại chỗ, không cần mạng hay tài khoản.

## Hành vi cần biết

- Một `purchaseToken` thuộc một thiết bị tại một thời điểm. Bấm "Khôi phục giao dịch" trên máy mới sẽ chuyển quyền sang máy đó (máy cũ mất Pro sau lần làm mới kế tiếp).
- Active = trạng thái `ACTIVE`, `CANCELED` (đã huỷ gia hạn nhưng chưa hết kỳ) hoặc `IN_GRACE_PERIOD`, và chưa quá `expiryTime`. `ON_HOLD`, `PAUSED`, `PENDING`, `EXPIRED` không có quyền lợi.
- Giao dịch bị hoàn tiền/thu hồi (voided) mất quyền lợi ngay khi nhận RTDN.
- Giới hạn tốc độ: `/api/verify` 10 lần/phút/IP, `/api/entitlement` 60 lần/phút/IP (bộ nhớ từng isolate, mang tính tương đối; muốn chặt hơn dùng Cloudflare Rate Limiting rule).
- Client giữ cache `solpha_ent` 5 phút; nếu mất mạng vẫn tin cache tối đa 72 giờ kể từ lần xác nhận thành công cuối.

## Lỗi thường gặp

| Triệu chứng | Nguyên nhân và cách xử lý |
|---|---|
| Giao dịch bị Google tự hoàn tiền sau 3 ngày | Không acknowledge kịp. Worker acknowledge ngay khi `/api/verify` thành công và thử lại ở lần `entitlement` hoặc RTDN kế tiếp (nếu thất bại sẽ có `ackPending: true`). Kiểm tra quyền service account và log `acknowledge_failed`. Phải xong trong 3 ngày. |
| `/api/verify` trả 502 `upstream`, log `google_oauth_*` hoặc `google_api_401/403` | Service account chưa có quyền hoặc quyền chưa hiệu lực (có thể mất vài giờ), hoặc chưa bật Google Play Android Developer API trong đúng project, hoặc dán sai `GOOGLE_SA_JSON`. |
| `/api/verify` trả 400 `invalid_token` | Token sai/đã bị xoá, hoặc `PACKAGE_NAME` không khớp app. Với tester, đảm bảo giao dịch tạo từ đúng app. |
| `/api/verify` trả 400 `sku_mismatch` | Client gửi sku khác với gói trong giao dịch. |
| RTDN không đến | Sai `?key=` (401 trong `wrangler tail`), chưa cấp quyền Publisher cho `google-play-developer-notifications@system.gserviceaccount.com`, hoặc nhập sai tên topic trong Play Console. |
| Pub/Sub gửi lại mãi | Worker trả non-2xx: chỉ xảy ra khi sai key (401) hoặc Worker lỗi nặng. Các lỗi xử lý khác đều trả 200 và chỉ ghi log. |
| Trình duyệt báo CORS | Origin chưa nằm trong `ALLOWED_ORIGINS`. Thêm rồi `wrangler deploy` lại. |
| Hết hạn gói nhưng app vẫn Pro một lúc | Bình thường: cache client 5 phút và RTDN có độ trễ vài giây đến vài phút. |
| Đổi gói (nâng/hạ) | Google tạo token mới có `linkedPurchaseToken`. App gọi `restore()` hoặc mua mới sẽ verify token mới, token cũ được đánh dấu `REPLACED`. |
