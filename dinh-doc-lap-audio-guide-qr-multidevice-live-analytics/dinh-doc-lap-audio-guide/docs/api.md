# API v1

Base URL local: `http://localhost:4000/api/v1` (hoặc qua frontend `/api/v1`).

| Method | Endpoint                     | Mục đích                                                                                                                |
| ------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| GET    | `/health`                    | Tình trạng gateway và service                                                                                           |
| POST   | `/auth/login`                | Đăng nhập, trả JWT                                                                                                      |
| GET    | `/auth/me`                   | Đọc thông tin từ JWT                                                                                                    |
| GET    | `/attractions`               | Danh sách địa điểm                                                                                                      |
| GET    | `/attractions/:id`           | Chi tiết địa điểm                                                                                                       |
| GET    | `/tours`                     | Lộ trình và các điểm                                                                                                    |
| GET    | `/narrations/:id/:language`  | Nội dung thuyết minh vi/en; xác minh điểm qua Attraction Service                                                        |
| POST   | `/feedback`                  | Gửi phản hồi; rating 1–5, message tối đa 1000 ký tự                                                                     |
| GET    | `/feedback`                  | Danh sách phản hồi, admin JWT                                                                                           |
| PATCH  | `/feedback/:id/status`       | Cập nhật trạng thái, admin JWT                                                                                          |
| GET    | `/attractions/admin/all`     | Tất cả địa điểm kể cả ẩn, admin JWT                                                                                     |
| POST   | `/attractions`               | Tạo địa điểm, admin JWT                                                                                                 |
| PUT    | `/attractions/:id`           | Cập nhật metadata/nội dung/công bố, admin JWT                                                                           |
| DELETE | `/attractions/:id`           | Ẩn mềm địa điểm, admin JWT                                                                                              |
| POST   | `/tours`                     | Tạo lộ trình với danh sách attractionIds, admin JWT                                                                     |
| PUT    | `/tours/:id`                 | Cập nhật lộ trình và thứ tự điểm, admin JWT                                                                             |
| GET    | `/narrations/admin/:id`      | Kịch bản và audio URLs, admin JWT                                                                                       |
| PUT    | `/narrations/:id`            | Cập nhật kịch bản VI/EN, audio URLs và trạng thái công bố, admin JWT                                                    |
| POST   | `/analytics/events`          | Ghi sự kiện ẩn danh `app_opened`, `qr_scan`, `place_opened`, `visit_marked`, `narration_started`, `narration_completed` |
| GET    | `/analytics/summary?days=30` | KPI, ngôn ngữ được nghe, địa điểm hoạt động và lịch sử khách ẩn danh; admin JWT; 1–90 ngày                              |

Ví dụ đăng nhập:

```json
{ "email": "admin@dinhguide.local", "password": "Admin123!" }
```

Response thành công có dạng `{"data":{"token":"...","user":{"id":"...","email":"...","role":"admin"}}}`. Lỗi nghiệp vụ có dạng `{"error":{"code":"...","message":"..."}}`. Validation trả 400, xác thực 401, phân quyền 403, không tìm thấy 404 và lỗi phụ thuộc/cơ sở dữ liệu 503. JSON sai định dạng trả 400 `INVALID_JSON`; payload vượt giới hạn trả 413 `PAYLOAD_TOO_LARGE`; route API không tồn tại trả 404. Gateway trả 502 `UPSTREAM_UNAVAILABLE` khi service phía sau không truy cập được. Endpoint health giữ response `status`/`dependencies` riêng để biểu diễn trạng thái vận hành.

## Integration verification

Run the integration suite against a disposable Compose project. The test creates a feedback row and an anonymous analytics event, so do not run it against production or a shared database.

```sh
docker compose -p dinh-guide-integration up --build -d
node --test scripts/integration.test.mjs
docker compose -p dinh-guide-integration down --volumes --remove-orphans
```

The suite waits for Gateway health and exercises Gateway → Content → Attraction/Narration → PostgreSQL, including public reads, invalid input, malformed JSON, not-found responses, admin login/JWT authorization, feedback persistence, analytics persistence, and narration update/readback. It uses only the local demo admin seeded by the database and requires no production secret.

## Analytics events

`POST /analytics/events` expects `visitorId` (browser-generated UUID), `eventType`, `language` (`vi` / `en`) and optional `metadata`. `attractionId` is required for attraction-specific events, but may be omitted for `app_opened`. Do not send names, email addresses or raw GPS coordinates.

Example:

```json
{
  "visitorId": "a1c2e3f4-1234-4123-8123-aabbccddeeff",
  "eventType": "narration_started",
  "attractionId": "main-building",
  "language": "vi",
  "metadata": { "player": "web-speech" }
}
```

The dashboard records `app_opened` once per browser tab session; it counts a `qr_scan` when an app page is opened with `source=qr`; this records opening the QR link, not physical proof that a camera scanned the code or that a visitor is on site. The QR manager creates `/place/:id?source=qr` URLs. For printed QR codes, use the actual deployed website URL or a LAN address reachable by visitors; a `localhost` URL is only reachable from the same computer.
