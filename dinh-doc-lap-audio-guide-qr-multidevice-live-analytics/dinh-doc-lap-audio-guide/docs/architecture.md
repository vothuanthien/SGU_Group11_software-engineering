# Kiến trúc

Frontend chỉ gọi API Gateway. Gateway định tuyến các nhóm endpoint tới service tương ứng. Narration Service và Feedback Service gọi Attraction Service qua HTTP nội bộ để xác minh ID địa điểm; Analytics Service ghi sự kiện ẩn danh và cung cấp số liệu tổng hợp có xác thực quản trị; có timeout và trả lỗi 503 nếu dependency lỗi. PostgreSQL dùng chung trong bản demo nhưng tách bảng theo nghiệp vụ.

Các service có endpoint `/health`, middleware Helmet/CORS/rate-limit và JSON lỗi. Trong môi trường thật nên bổ sung tracing, metrics, secret manager, migration versioning riêng và network policy.

Các màn hình quản trị được bảo vệ ở backend bằng JWT và role `admin`, không dựa vào việc ẩn nút phía client. Attraction Service quản lý metadata/route; Narration Service cập nhật kịch bản, URL audio và trạng thái công bố; Feedback Service cập nhật trạng thái xử lý. Bản demo dùng một PostgreSQL instance nhưng mỗi service chỉ thực hiện logic nghiệp vụ thuộc phạm vi của mình.

## Analytics and QR flow

The visitor browser stores a pseudonymous UUID in localStorage and sends discrete events to the API Gateway. The gateway proxies `/api/v1/analytics/*` to Analytics Service. Analytics Service validates event type, language and visitor UUID (plus visible attraction when the event is tied to a location), then writes to `visitor_events`. App sessions open from separate phones use distinct browser UUIDs. The admin dashboard polls its summary API every five seconds. Administrative summary APIs require the same signed admin JWT used by the other services. The QR manager generates a URL that resolves directly to `/place/:id?source=qr`; the app records the scan and continues to the normal attraction detail page.
