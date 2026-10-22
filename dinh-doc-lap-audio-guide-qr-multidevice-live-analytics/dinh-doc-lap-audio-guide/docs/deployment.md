# Deploy
Local: `cp .env.example .env && docker compose up --build`.
Production: đổi secret/mật khẩu, thiết lập GitHub Secrets, cấu hình domain/TLS, database backup, firewall và giám sát. CD workflow chỉ chạy với tag `v*`, build/push GHCR; bước SSH chỉ chạy nếu đủ `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`. Trên server phải cài Docker Compose, đăng nhập GHCR nếu image private và tạo `.env` bảo mật. Sau deploy kiểm tra `/api/v1/health`. Khi lỗi, xem `docker compose logs --tail=200 <service>`, rollback về tag image trước đó và kiểm tra DB migration/backup.


## Analytics migration and QR rollout
`docker compose up --build` also runs the one-shot `analytics-migration` container after PostgreSQL becomes healthy. It applies `database/migrations/002_visitor_analytics.sql` idempotently so the new analytics table is added to an existing named volume without dropping data. If the migration fails, inspect `docker compose logs analytics-migration` before retrying.

After logging in as admin, open **Analytics** to inspect anonymous QR, visit and narration events, or open **QR codes** to choose an attraction and download its SVG QR. Before printing, set the QR base URL to the deployed HTTPS domain (or a LAN address accessible to a phone). QR codes built with `localhost` will not open the service on a different device.


For same-Wi-Fi phone tests, use the host computer's IPv4 address in the QR manager, for example `http://192.168.1.20:8080`; keep the PC and phones on the same Wi-Fi and allow the application through Windows Firewall on a Private network if necessary. For visitors using mobile data or another network, deploy to a public HTTPS domain first. Details: [`qr-real-device-testing.md`](./qr-real-device-testing.md).
