import jwt from "jsonwebtoken";
import { apiErrorHandler, app, pool } from "./base.js";
import { isValidAnalyticsEvent } from "./validation.js";

const secret = process.env.JWT_SECRET || "local_only_change_this_secret";

function admin(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const user = jwt.verify(token, secret);
    if (user.role !== "admin")
      return res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "Chỉ quản trị viên" } });
    req.user = user;
    next();
  } catch {
    return res
      .status(401)
      .json({
        error: { code: "UNAUTHORIZED", message: "Cần đăng nhập quản trị" },
      });
  }
}

// Events are pseudonymous: visitorId is generated in the browser; no name, email or raw GPS is stored.
app.post("/analytics/events", async (req, res) => {
  const body = req.body || {};
  const { visitorId, eventType, attractionId, language, metadata } = body;
  if (!isValidAnalyticsEvent(body)) {
    return res
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Dữ liệu sự kiện không hợp lệ",
        },
      });
  }
  try {
    if (attractionId) {
      const exists = await pool.query(
        "SELECT id FROM attractions WHERE id = $1 AND visible = TRUE",
        [attractionId],
      );
      if (!exists.rowCount)
        return res
          .status(400)
          .json({
            error: {
              code: "INVALID_ATTRACTION",
              message: "Địa điểm không tồn tại hoặc không hiển thị",
            },
          });
    }
    let safeMetadata = "{}";
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      const serializedMetadata = JSON.stringify(metadata);
      if (serializedMetadata.length <= 2000) safeMetadata = serializedMetadata;
    }
    const result = await pool.query(
      `INSERT INTO visitor_events(visitor_id, event_type, attraction_id, language, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id, created_at`,
      [visitorId, eventType, attractionId || null, language, safeMetadata],
    );
    return res
      .status(201)
      .json({
        data: { id: result.rows[0].id, createdAt: result.rows[0].created_at },
      });
  } catch (error) {
    if (error?.code === "42P01")
      return res
        .status(503)
        .json({
          error: {
            code: "MIGRATION_REQUIRED",
            message:
              "Chưa có bảng thống kê; hãy chạy migration 002_visitor_analytics.sql hoặc khởi động lại Docker Compose.",
          },
        });
    return res
      .status(503)
      .json({
        error: {
          code: "DB_UNAVAILABLE",
          message: "Không thể lưu sự kiện thống kê",
        },
      });
  }
});

app.get("/analytics/summary", admin, async (req, res) => {
  const parsedDays = Number.parseInt(req.query.days, 10);
  const days = Number.isFinite(parsedDays)
    ? Math.min(90, Math.max(1, parsedDays))
    : 30;
  try {
    const totalsQuery = await pool.query(
      `SELECT
        COUNT(DISTINCT visitor_id)::int AS unique_visitors,
        COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= CURRENT_DATE)::int AS visitors_today,
        COUNT(DISTINCT visitor_id) FILTER (WHERE created_at >= NOW() - INTERVAL '5 minutes')::int AS active_now,
        COUNT(DISTINCT visitor_id) FILTER (WHERE event_type = 'narration_started')::int AS unique_listeners,
        COUNT(*) FILTER (WHERE event_type = 'app_opened')::int AS app_opens,
        COUNT(*) FILTER (WHERE event_type = 'qr_scan')::int AS qr_scans,
        COUNT(*) FILTER (WHERE event_type = 'place_opened')::int AS place_opens,
        COUNT(*) FILTER (WHERE event_type = 'visit_marked')::int AS confirmed_visits,
        COUNT(*) FILTER (WHERE event_type = 'narration_started')::int AS listens_started,
        COUNT(*) FILTER (WHERE event_type = 'narration_completed')::int AS listens_completed
       FROM visitor_events WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')`,
      [days],
    );

    const languageQuery = await pool.query(
      `SELECT language, COUNT(*)::int AS listens
       FROM visitor_events WHERE event_type = 'narration_started'
         AND created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY language ORDER BY listens DESC, language`,
      [days],
    );

    const attractionQuery = await pool.query(
      `SELECT e.attraction_id AS id, a.name_vi, a.name_en,
        COUNT(*) FILTER (WHERE e.event_type = 'qr_scan')::int AS qr_scans,
        COUNT(*) FILTER (WHERE e.event_type = 'visit_marked')::int AS confirmed_visits,
        COUNT(DISTINCT e.visitor_id) FILTER (WHERE e.event_type = 'narration_started')::int AS unique_listeners,
        COUNT(*) FILTER (WHERE e.event_type = 'narration_started')::int AS listens
       FROM visitor_events e JOIN attractions a ON a.id = e.attraction_id
       WHERE e.created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY e.attraction_id, a.name_vi, a.name_en
       ORDER BY listens DESC, confirmed_visits DESC, qr_scans DESC LIMIT 20`,
      [days],
    );

    const historyQuery = await pool.query(
      `SELECT e.visitor_id::text AS visitor_id, e.attraction_id AS id, a.name_vi, a.name_en,
        BOOL_OR(e.event_type = 'qr_scan') AS scanned_qr,
        BOOL_OR(e.event_type = 'visit_marked') AS marked_visited,
        BOOL_OR(e.event_type IN ('narration_started','narration_completed')) AS listened,
        MAX(e.language) FILTER (WHERE e.event_type IN ('narration_started','narration_completed')) AS language,
        MAX(e.created_at) AS last_activity
       FROM visitor_events e JOIN attractions a ON a.id = e.attraction_id
       WHERE e.created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY e.visitor_id, e.attraction_id, a.name_vi, a.name_en
       ORDER BY last_activity DESC LIMIT 100`,
      [days],
    );

    const dayQuery = await pool.query(
      `SELECT TO_CHAR(DATE_TRUNC('day', created_at), 'YYYY-MM-DD') AS day,
        COUNT(*) FILTER (WHERE event_type = 'app_opened')::int AS app_opens,
        COUNT(*) FILTER (WHERE event_type = 'qr_scan')::int AS qr_scans,
        COUNT(*) FILTER (WHERE event_type = 'narration_started')::int AS listens,
        COUNT(*) FILTER (WHERE event_type = 'visit_marked')::int AS visits
       FROM visitor_events WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY DATE_TRUNC('day', created_at) ORDER BY DATE_TRUNC('day', created_at)`,
      [days],
    );

    const languageBreakdown = languageQuery.rows;
    res.json({
      data: {
        periodDays: days,
        totals: totalsQuery.rows[0],
        languageBreakdown,
        mostUsedLanguage: languageBreakdown[0]?.language || null,
        topAttractions: attractionQuery.rows,
        visitorHistory: historyQuery.rows,
        daily: dayQuery.rows,
      },
    });
  } catch (error) {
    if (error?.code === "42P01")
      return res
        .status(503)
        .json({
          error: {
            code: "MIGRATION_REQUIRED",
            message:
              "Chưa có bảng thống kê; hãy chạy migration 002_visitor_analytics.sql.",
          },
        });
    console.error("Analytics query failed:", error?.message);
    return res
      .status(503)
      .json({
        error: {
          code: "DB_UNAVAILABLE",
          message: "Không thể tải số liệu thống kê",
        },
      });
  }
});

app.use((_req, res) => {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Không tìm thấy API" } });
});
app.use(apiErrorHandler);
app.listen(process.env.PORT || 4105, () =>
  console.log("analytics-service ready"),
);
