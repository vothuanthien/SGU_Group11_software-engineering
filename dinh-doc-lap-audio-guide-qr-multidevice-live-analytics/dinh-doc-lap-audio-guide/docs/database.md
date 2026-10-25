# Database

`database/init.sql` tạo bảng `users`, `attractions`, `tours`, `tour_stops`, `feedback`, `narration_assets`, `visitor_events` và chỉ mục. `tour_stops` có khóa chính ghép (tour_id, attraction_id) và lưu thứ tự dừng. `feedback.attraction_id` là khóa ngoại có thể null để nhận phản hồi chung. Schema init chạy tự động trên volume PostgreSQL mới; thay đổi schema về sau nên chuyển sang migration có phiên bản thay vì sửa init file.

## Visitor analytics

`visitor_events` ghi `visitor_id` UUID ẩn danh, `event_type`, `attraction_id` (có thể null riêng cho sự kiện mở ứng dụng), `language`, metadata đã giới hạn và thời điểm server. Các event được phép: `app_opened`, `qr_scan`, `place_opened`, `visit_marked`, `narration_started`, `narration_completed`. Không ghi tên/email hoặc tọa độ GPS. Migration `002_visitor_analytics.sql` có thể chạy lặp an toàn và được Docker Compose thực thi trên cả database volume đã tồn tại.
