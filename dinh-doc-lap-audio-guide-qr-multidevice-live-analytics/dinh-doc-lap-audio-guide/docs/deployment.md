# Deploy

Local: `cp .env.example .env && docker compose up --build`.
Production: dùng secret ngẫu nhiên riêng cho `JWT_SECRET` (tối thiểu 32 ký tự), `POSTGRES_PASSWORD` và tài khoản admin; không dùng lại giá trị demo hoặc secret giữa các môi trường. Cấu hình SQL Server sync với mã hóa TLS bật và chỉ tin cậy chứng chỉ hợp lệ. Thiết lập GitHub Secrets, cấu hình domain/TLS, database backup, firewall và giám sát. CD workflow chỉ chạy với tag `v*`, build/push GHCR; bước SSH chỉ chạy nếu đủ `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`. Trên server phải cài Docker Compose, đăng nhập GHCR nếu image private và tạo `.env` bảo mật. Sau deploy kiểm tra `/api/v1/health`. Khi lỗi, xem `docker compose logs --tail=200 <service>`, rollback về tag image trước đó và kiểm tra DB migration/backup.

## PostgreSQL backup and restore test

Create and verify a custom-format backup without stopping the application:

```powershell
.\scripts\backup-postgres.ps1
```

The dump is written under the ignored `backups/` directory. Test that it can actually be restored into an isolated temporary database; the script refuses to target the application database and removes the temporary database afterward:

```powershell
.\scripts\test-postgres-restore.ps1 -BackupFile .\backups\dinhguide-YYYYMMDD-HHMMSS.dump
```

## Database migrations and QR rollout

`docker compose up --build` also runs the one-shot `database-migration` container after PostgreSQL becomes healthy. It applies migrations `001`–`003` idempotently so existing named volumes gain the required columns, analytics table, and vi/en/zh/th language constraints without dropping existing data. The multilingual narration migration seeds Chinese and Thai translations for the eight existing attractions only where those fields are null. If a migration fails, inspect `docker compose logs database-migration` before retrying.

The zh/th narration text is translated from the existing Vietnamese/English sample text and is marked as a draft for content-team review. No Chinese or Thai audio files are included; playback uses browser speech synthesis until reviewed recordings are added through the admin audio URL fields. Available voices depend on the visitor's device and browser.

After logging in as admin, open **Analytics** to inspect anonymous QR, visit and narration events, or open **QR codes** to choose an attraction and download its SVG QR. Before printing, set the QR base URL to the deployed HTTPS domain (or a LAN address accessible to a phone). QR codes built with `localhost` will not open the service on a different device.

For same-Wi-Fi phone tests, use the host computer's IPv4 address in the QR manager, for example `http://192.168.1.20:8080`; keep the PC and phones on the same Wi-Fi and allow the application through Windows Firewall on a Private network if necessary. For visitors using mobile data or another network, deploy to a public HTTPS domain first. Details: [`qr-real-device-testing.md`](./qr-real-device-testing.md).

## SQL Server mirror

The application continues to use PostgreSQL as its primary database. To mirror website content, feedback, narration assets and anonymous visitor events into a local SQL Server instance, follow [`../database/sqlserver/README.md`](../database/sqlserver/README.md), set its connection values in the untracked `.env` file, then enable the `sqlserver-sync` Compose profile. The sync container retries connection failures and logs each successful cycle. Do not commit SQL Server credentials.
