# Deploy

PostgreSQL in Docker is the primary database. SQL Server is an optional reporting
mirror, not a replacement for timestamped PostgreSQL backups. Leave the
`sqlserver-sync` profile disabled when it is not being demonstrated.

GitHub discovers workflows in `.github/workflows` at the repository root.
After pushing changes, check the Actions tab for a successful CI run.
CD publishes images for tags matching `v*`; deployment requires the SSH secrets
documented below.

For a fresh-machine rehearsal, clone the repository, open the application folder,
copy `.env.example` to `.env`, configure private credentials, then run
`docker compose up --build -d`. Confirm `docker compose ps` reports healthy
services and open `http://localhost:8080`. Test QR links from another device
using the public domain, not localhost.

Do not change POSTGRES_PASSWORD on an existing volume by editing .env alone:
the database role retains its old password. Rotate the database role and update
the connection configuration together. Changing JWT_SECRET invalidates existing
login tokens. Never commit .env or print its contents in demonstration material.

Migration `003_source_url.sql` updates legacy attraction source URLs without
replacing custom administrator references. It runs on the next Compose startup.

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

`docker compose up --build` also runs the one-shot `database-migration` container after PostgreSQL becomes healthy. It applies `001_narration_publication.sql` and `002_visitor_analytics.sql` idempotently so existing named volumes gain the required columns and analytics table without dropping data. If a migration fails, inspect `docker compose logs database-migration` before retrying.

After logging in as admin, open **Analytics** to inspect anonymous QR, visit and narration events, or open **QR codes** to choose an attraction and download its SVG QR. Before printing, set the QR base URL to the deployed HTTPS domain (or a LAN address accessible to a phone). QR codes built with `localhost` will not open the service on a different device.

For same-Wi-Fi phone tests, use the host computer's IPv4 address in the QR manager, for example `http://192.168.1.20:8080`; keep the PC and phones on the same Wi-Fi and allow the application through Windows Firewall on a Private network if necessary. For visitors using mobile data or another network, deploy to a public HTTPS domain first. Details: [`qr-real-device-testing.md`](./qr-real-device-testing.md).

## SQL Server mirror

The application continues to use PostgreSQL as its primary database. To mirror website content, feedback, narration assets and anonymous visitor events into a local SQL Server instance, follow [`../database/sqlserver/README.md`](../database/sqlserver/README.md), set its connection values in the untracked `.env` file, then enable the `sqlserver-sync` Compose profile. The sync container retries connection failures and logs each successful cycle. Do not commit SQL Server credentials.
