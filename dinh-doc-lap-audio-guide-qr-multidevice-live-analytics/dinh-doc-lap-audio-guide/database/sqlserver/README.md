# PostgreSQL to SQL Server mirror

PostgreSQL remains the application's source of truth. The optional `sqlserver-sync` service copies attractions, tours, narrations, feedback, and anonymous visitor events to SQL Server for reporting or classroom demonstration.

## Prepare SQL Server

1. Enable TCP/IP and SQL authentication in SQL Server Configuration Manager, then restart SQL Server.
2. Open `01_create_schema.sql` in SQL Server Management Studio and execute it against the target database.
3. Optionally execute `02_seed_data.sql` for standalone sample data.
4. Use `03_sample_queries.sql` to demonstrate the mirrored tables.

## Configure the sync service

Copy `.env.example` to the untracked `.env` file and set:

```dotenv
COMPOSE_PROFILES=sqlserver-sync
SQLSERVER_HOST=host.docker.internal
SQLSERVER_PORT=1433
SQLSERVER_DATABASE=DinhGuide
SQLSERVER_USER=dinhguide_sync
SQLSERVER_PASSWORD=replace-with-a-private-password
SQLSERVER_ENCRYPT=true
SQLSERVER_TRUST_CERT=false
SYNC_INTERVAL_MS=10000
```

For a local development certificate only, `SQLSERVER_TRUST_CERT=true` can be used temporarily. Do not use it for production and never commit real credentials.

Start and inspect the mirror:

```powershell
docker compose --profile sqlserver-sync up -d --build sqlserver-sync
docker compose logs -f sqlserver-sync
```

The website continues operating when this optional profile is disabled or SQL Server is offline.
