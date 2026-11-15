import pg from "pg";
import sql from "mssql";

const required = ["DATABASE_URL", "SQLSERVER_USER", "SQLSERVER_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

const intervalMs = Math.max(5000, Number(process.env.SYNC_INTERVAL_MS) || 10000);
const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const sqlPool = await sql.connect({
  server: process.env.SQLSERVER_HOST || "host.docker.internal",
  port: Number(process.env.SQLSERVER_PORT) || 1433,
  database: process.env.SQLSERVER_DATABASE || "DinhGuide",
  user: process.env.SQLSERVER_USER,
  password: process.env.SQLSERVER_PASSWORD,
  options: {
    encrypt: String(process.env.SQLSERVER_ENCRYPT || "true").toLowerCase() === "true",
    trustServerCertificate:
      String(process.env.SQLSERVER_TRUST_CERT || "false").toLowerCase() === "true",
  },
  pool: { min: 0, max: 5, idleTimeoutMillis: 30000 },
  connectionTimeout: 10000,
  requestTimeout: 30000,
});

const nv = (length = sql.MAX) => sql.NVarChar(length);
const bind = (request, values, specs) => {
  for (const [name, type] of Object.entries(specs)) request.input(name, type, values[name]);
  return request;
};

async function ensureSyncState() {
  await sqlPool.request().query(`
    IF OBJECT_ID(N'dbo.sync_state', N'U') IS NULL
    BEGIN
      CREATE TABLE dbo.sync_state (
        sync_name NVARCHAR(100) NOT NULL PRIMARY KEY,
        last_visitor_event_id BIGINT NOT NULL CONSTRAINT DF_sync_state_event_id DEFAULT 0,
        updated_at DATETIME2(3) NOT NULL CONSTRAINT DF_sync_state_updated_at DEFAULT SYSUTCDATETIME()
      );
    END;
    IF NOT EXISTS (SELECT 1 FROM dbo.sync_state WHERE sync_name=N'postgres-to-sqlserver')
      INSERT INTO dbo.sync_state(sync_name,last_visitor_event_id) VALUES(N'postgres-to-sqlserver',0);
  `);
}

async function upsertAttraction(tx, row) {
  const v = {
    id: row.id, name_vi: row.name_vi, name_en: row.name_en,
    description_vi: row.description_vi, description_en: row.description_en,
    narration_vi: row.narration_vi, narration_en: row.narration_en,
    narration_zh: row.narration_zh, narration_th: row.narration_th,
    area_vi: row.area_vi, area_en: row.area_en, latitude: row.latitude,
    longitude: row.longitude, sort_order: row.sort_order,
    duration_minutes: row.duration_minutes, image_url: row.image_url,
    source_url: row.source_url, visible: row.visible,
    narration_published: row.narration_published, created_at: row.created_at,
  };
  const specs = {
    id: nv(100), name_vi: nv(300), name_en: nv(300),
    description_vi: nv(), description_en: nv(), narration_vi: nv(), narration_en: nv(),
    narration_zh: nv(), narration_th: nv(),
    area_vi: nv(200), area_en: nv(200), latitude: sql.Float, longitude: sql.Float,
    sort_order: sql.Int, duration_minutes: sql.Int, image_url: nv(2048), source_url: nv(2048),
    visible: sql.Bit, narration_published: sql.Bit, created_at: sql.DateTime2(3),
  };
  const request = bind(new sql.Request(tx), v, specs);
  await request.query(`
    IF EXISTS (SELECT 1 FROM dbo.attractions WHERE id=@id)
      UPDATE dbo.attractions SET name_vi=@name_vi,name_en=@name_en,
        description_vi=@description_vi,description_en=@description_en,
        narration_vi=@narration_vi,narration_en=@narration_en,
        narration_zh=@narration_zh,narration_th=@narration_th,
        area_vi=@area_vi,area_en=@area_en,latitude=@latitude,longitude=@longitude,
        sort_order=@sort_order,duration_minutes=@duration_minutes,image_url=@image_url,
        source_url=@source_url,visible=@visible,narration_published=@narration_published,
        created_at=@created_at WHERE id=@id;
    ELSE
      INSERT INTO dbo.attractions(id,name_vi,name_en,description_vi,description_en,
        narration_vi,narration_en,narration_zh,narration_th,area_vi,area_en,latitude,longitude,sort_order,
        duration_minutes,image_url,source_url,visible,narration_published,created_at)
      VALUES(@id,@name_vi,@name_en,@description_vi,@description_en,@narration_vi,
        @narration_en,@narration_zh,@narration_th,@area_vi,@area_en,@latitude,@longitude,@sort_order,
        @duration_minutes,@image_url,@source_url,@visible,@narration_published,@created_at);
  `);
}

async function upsertTour(tx, row) {
  const v = { id: row.id, name_vi: row.name_vi, name_en: row.name_en,
    description_vi: row.description_vi, description_en: row.description_en };
  const request = bind(new sql.Request(tx), v, {
    id: nv(100), name_vi: nv(300), name_en: nv(300),
    description_vi: nv(), description_en: nv(),
  });
  await request.query(`
    IF EXISTS (SELECT 1 FROM dbo.tours WHERE id=@id)
      UPDATE dbo.tours SET name_vi=@name_vi,name_en=@name_en,
        description_vi=@description_vi,description_en=@description_en WHERE id=@id;
    ELSE INSERT INTO dbo.tours(id,name_vi,name_en,description_vi,description_en)
      VALUES(@id,@name_vi,@name_en,@description_vi,@description_en);
  `);
}

async function upsertFeedback(tx, row) {
  const v = { id: row.id, attraction_id: row.attraction_id, rating: row.rating,
    message: row.message, type: row.type, status: row.status, created_at: row.created_at };
  const request = bind(new sql.Request(tx), v, {
    id: sql.UniqueIdentifier, attraction_id: nv(100), rating: sql.TinyInt,
    message: nv(1000), type: nv(20), status: nv(20), created_at: sql.DateTime2(3),
  });
  await request.query(`
    IF EXISTS (SELECT 1 FROM dbo.feedback WHERE id=@id)
      UPDATE dbo.feedback SET attraction_id=@attraction_id,rating=@rating,
        message=@message,type=@type,status=@status,created_at=@created_at WHERE id=@id;
    ELSE INSERT INTO dbo.feedback(id,attraction_id,rating,message,type,status,created_at)
      VALUES(@id,@attraction_id,@rating,@message,@type,@status,@created_at);
  `);
}

async function upsertNarrationAsset(tx, row) {
  const v = { id: row.id, attraction_id: row.attraction_id, language: row.language,
    audio_url: row.audio_url, updated_at: row.updated_at };
  const request = bind(new sql.Request(tx), v, {
    id: sql.UniqueIdentifier, attraction_id: nv(100), language: nv(2),
    audio_url: nv(2048), updated_at: sql.DateTime2(3),
  });
  await request.query(`
    IF EXISTS (SELECT 1 FROM dbo.narration_assets WHERE id=@id)
      UPDATE dbo.narration_assets SET attraction_id=@attraction_id,language=@language,
        audio_url=@audio_url,updated_at=@updated_at WHERE id=@id;
    ELSE INSERT INTO dbo.narration_assets(id,attraction_id,language,audio_url,updated_at)
      VALUES(@id,@attraction_id,@language,@audio_url,@updated_at);
  `);
}

async function syncOnce() {
  const [attractions, tours, stops, feedback, assets, state] = await Promise.all([
    pgPool.query("SELECT * FROM attractions ORDER BY id"),
    pgPool.query("SELECT * FROM tours ORDER BY id"),
    pgPool.query("SELECT * FROM tour_stops ORDER BY tour_id,stop_order"),
    pgPool.query("SELECT * FROM feedback ORDER BY id"),
    pgPool.query("SELECT * FROM narration_assets ORDER BY id"),
    sqlPool.request().query("SELECT last_visitor_event_id FROM dbo.sync_state WHERE sync_name=N'postgres-to-sqlserver'"),
  ]);
  const lastEventId = Number(state.recordset[0]?.last_visitor_event_id || 0);
  const events = await pgPool.query(
    "SELECT id,visitor_id,event_type,attraction_id,language,metadata,created_at FROM visitor_events WHERE id > $1 ORDER BY id LIMIT 5000",
    [lastEventId],
  );

  const tx = new sql.Transaction(sqlPool);
  await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
  try {
    for (const row of attractions.rows) await upsertAttraction(tx, row);
    for (const row of tours.rows) await upsertTour(tx, row);

    await new sql.Request(tx).query("DELETE FROM dbo.tour_stops");
    for (const row of stops.rows) {
      await bind(new sql.Request(tx), {
        tour_id: row.tour_id, attraction_id: row.attraction_id, stop_order: row.stop_order,
      }, { tour_id: nv(100), attraction_id: nv(100), stop_order: sql.Int })
        .query("INSERT INTO dbo.tour_stops(tour_id,attraction_id,stop_order) VALUES(@tour_id,@attraction_id,@stop_order)");
    }
    for (const row of assets.rows) await upsertNarrationAsset(tx, row);
    for (const row of feedback.rows) await upsertFeedback(tx, row);

    if (events.rows.length) {
      await new sql.Request(tx).query("SET IDENTITY_INSERT dbo.visitor_events ON");
      for (const row of events.rows) {
        await bind(new sql.Request(tx), {
          id: row.id, visitor_id: row.visitor_id, event_type: row.event_type,
          attraction_id: row.attraction_id, language: row.language,
          metadata: JSON.stringify(row.metadata ?? {}), created_at: row.created_at,
        }, {
          id: sql.BigInt, visitor_id: sql.UniqueIdentifier, event_type: nv(40),
          attraction_id: nv(100), language: nv(2), metadata: nv(), created_at: sql.DateTime2(3),
        }).query(`INSERT INTO dbo.visitor_events(id,visitor_id,event_type,attraction_id,language,metadata,created_at)
          VALUES(@id,@visitor_id,@event_type,@attraction_id,@language,@metadata,@created_at)`);
      }
      await new sql.Request(tx).query("SET IDENTITY_INSERT dbo.visitor_events OFF");
    }
    if (events.rows.length) {
      const highestId = events.rows.at(-1).id;
      await bind(new sql.Request(tx), { id: highestId }, { id: sql.BigInt })
        .query("UPDATE dbo.sync_state SET last_visitor_event_id=@id,updated_at=SYSUTCDATETIME() WHERE sync_name=N'postgres-to-sqlserver'");
    }
    await tx.commit();
    console.log(`Sync OK: ${attractions.rowCount} attractions, ${tours.rowCount} tours, ${feedback.rowCount} feedback, ${events.rowCount} new events.`);
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

await ensureSyncState();
console.log(`PostgreSQL → SQL Server sync started; interval=${intervalMs}ms.`);
while (true) {
  try {
    await syncOnce();
  } catch (error) {
    console.error("Sync failed; will retry:", error.message);
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
