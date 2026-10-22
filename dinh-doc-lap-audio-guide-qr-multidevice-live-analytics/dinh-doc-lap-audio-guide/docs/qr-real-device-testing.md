# Kiểm thử QR bằng điện thoại thật

## A. Thử nghiệm trong cùng mạng Wi-Fi

1. Mở Docker Desktop và chạy từ thư mục có `docker-compose.yml`:

   ```cmd
   docker compose up --build --force-recreate -d
   docker compose ps
   ```

Lệnh `--force-recreate` thay thế container nhưng vẫn giữ named volume database; không thêm `-v` vào lệnh `docker compose down`.

2. Trên máy tính chạy Windows, mở CMD và chạy `ipconfig`. Tìm `IPv4 Address` của card Wi-Fi/Ethernet đang dùng, ví dụ `192.168.1.20`. Không dùng địa chỉ `127.0.0.1`, `localhost`, `0.0.0.0` hoặc địa chỉ của adapter không nối mạng.
3. Dùng máy tính mở `http://localhost:8080`, đăng nhập quản trị, mở tab **Mã QR**. Nhập `http://192.168.1.20:8080` bằng địa chỉ IPv4 thật của máy tính, chọn địa điểm và tải/in mã.
4. Kết nối điện thoại và máy tính vào cùng Wi-Fi. Quét QR bằng camera mặc định của điện thoại rồi bấm mở liên kết. Điện thoại sẽ mở route `/place/<id>?source=qr` trong cùng ứng dụng. Không cần cài app và không cần tài khoản khách.
5. Bấm **Nghe thuyết minh**. Trình duyệt di động sẽ đọc nội dung bằng Web Speech API (giọng đọc tùy thiết bị); nếu có audio URL đã công bố thì trình phát ưu tiên tệp audio. Bấm đánh dấu tham quan nếu muốn ghi nhận sự kiện đó.
6. Mở dashboard quản trị ở máy tính. Dữ liệu được làm mới mỗi 5 giây; các số liệu được truy vấn từ bảng PostgreSQL `visitor_events`. Quét cùng mã bằng nhiều điện thoại tạo các sự kiện riêng cho UUID ẩn danh của từng trình duyệt.

### Nếu điện thoại không mở được URL LAN

- Kiểm tra IP bằng `ipconfig` lại vì IP có thể thay đổi khi đổi Wi-Fi/router.
- Xác nhận ứng dụng đang chạy và `docker compose ps` cho thấy `frontend`, `api-gateway`, `analytics-service`, `postgres` đang hoạt động; `analytics-migration` ở trạng thái `Exited (0)` là bình thường sau khi migration xong.
- Cho phép Windows Defender Firewall nhận kết nối trên **Private network** cho Docker Desktop/port TCP 8080 nếu Windows đang chặn. Không tắt firewall hoàn toàn.
- Tắt VPN trên một trong hai thiết bị nếu VPN cô lập kết nối LAN, và đảm bảo router không bật AP/client isolation cho các thiết bị cùng Wi-Fi.
- Không mở port 8080 trên router Internet để kiểm thử nội bộ.

## B. Sử dụng với khách tham quan ngoài mạng Wi-Fi

Địa chỉ LAN chỉ chạy trong mạng nội bộ. Muốn in QR để khách tại địa điểm tham quan dùng bằng mạng di động hoặc mạng khác, cần triển khai frontend/API/database lên máy chủ có thể truy cập công khai, cấu hình domain + HTTPS, sao lưu database và bảo vệ tài khoản quản trị. Sau đó nhập `https://ten-mien-cong-khai` trong phần **Mã QR** và tạo QR mới. Bản ZIP không tự cung cấp hosting, domain hoặc chứng chỉ TLS.

## C. Ý nghĩa thống kê

- `app_opened`: phiên tab mở ứng dụng, tối đa một lần trong sessionStorage của tab.
- `qr_scan`: người dùng mở đường dẫn có `source=qr`; không đo được việc camera đọc mã nhưng khách chưa bấm mở link.
- `place_opened`: trang một địa điểm được mở.
- `narration_started` / `narration_completed`: phát hiện khi trình đọc/âm thanh bắt đầu hoặc kết thúc.
- `visit_marked`: khách bấm đánh dấu đã tham quan.
- `unique_visitors` và `unique_listeners` tính từ UUID ẩn danh do trình duyệt tạo. Đây là số trình duyệt/thiết bị ước tính, không phải danh tính thật; cùng một người trên 2 thiết bị có thể được tính 2 khách.
