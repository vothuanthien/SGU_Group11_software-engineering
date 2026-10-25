import { app, pool } from "./base.js";
import jwt from "jsonwebtoken";
const attractionUrl =
  process.env.ATTRACTION_SERVICE_URL || "http://localhost:4102";
app.get("/narrations/admin/:id", admin, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id,name_vi,name_en,narration_vi,narration_en,source_url FROM attractions WHERE id=$1",
      [req.params.id],
    );
    if (!r.rowCount)
      return res
        .status(404)
        .json({
          error: { code: "NOT_FOUND", message: "Không tìm thấy địa điểm" },
        });
    const assets = await pool.query(
      "SELECT language,audio_url FROM narration_assets WHERE attraction_id=$1",
      [req.params.id],
    );
    res.json({ data: { ...r.rows[0], audio: assets.rows } });
  } catch {
    res
      .status(503)
      .json({
        error: {
          code: "DB_UNAVAILABLE",
          message: "Không tải được thuyết minh",
        },
      });
  }
});
app.get("/narrations/:id/:language", async (req, res) => {
  const { id, language } = req.params;
  if (!["vi", "en"].includes(language))
    return res
      .status(400)
      .json({
        error: {
          code: "INVALID_LANGUAGE",
          message: "Ngôn ngữ chỉ hỗ trợ vi hoặc en",
        },
      });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const check = await fetch(
      `${attractionUrl}/internal/attractions/${encodeURIComponent(id)}/exists`,
      { signal: controller.signal },
    );
    if (!check.ok)
      return res
        .status(503)
        .json({
          error: {
            code: "DEPENDENCY_UNAVAILABLE",
            message: "Attraction Service tạm thời không khả dụng",
          },
        });
    const exists = await check.json();
    if (!exists.exists)
      return res
        .status(404)
        .json({
          error: { code: "NOT_FOUND", message: "Không tìm thấy địa điểm" },
        });
    const r = await pool.query(
      "SELECT a.id,a.name_vi,a.name_en,a.description_vi,a.description_en,a.narration_vi,a.narration_en,a.area_vi,a.area_en,a.duration_minutes,a.source_url,a.narration_published,na.audio_url FROM attractions a LEFT JOIN narration_assets na ON na.attraction_id=a.id AND na.language=$2 WHERE a.id=$1 AND a.visible=true AND a.narration_published=true",
      [id, language],
    );
    const a = r.rows[0];
    if (!a)
      return res
        .status(404)
        .json({
          error: {
            code: "NOT_FOUND",
            message: "Không tìm thấy hoặc nội dung chưa được công bố",
          },
        });
    res.json({
      data: {
        attractionId: a.id,
        language,
        title: language === "vi" ? a.name_vi : a.name_en,
        description: language === "vi" ? a.description_vi : a.description_en,
        text: language === "vi" ? a.narration_vi : a.narration_en,
        area: language === "vi" ? a.area_vi : a.area_en,
        durationMinutes: a.duration_minutes,
        sourceUrl: a.source_url,
        audioUrl: a.audio_url || null,
        audioMode: a.audio_url ? "file" : "web-speech-fallback",
      },
    });
  } catch (e) {
    res
      .status(503)
      .json({
        error: {
          code: "DEPENDENCY_UNAVAILABLE",
          message: "Không thể kết nối Attraction Service",
        },
      });
  } finally {
    clearTimeout(timer);
  }
});

function admin(req, res, next) {
  try {
    const u = jwt.verify(
      (req.headers.authorization || "").replace(/^Bearer /, ""),
      process.env.JWT_SECRET || "local_only_change_this_secret",
    );
    if (u.role !== "admin")
      return res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "Chỉ quản trị viên" } });
    next();
  } catch {
    return res
      .status(401)
      .json({
        error: { code: "UNAUTHORIZED", message: "Cần đăng nhập quản trị" },
      });
  }
}

app.put("/narrations/:id", admin, async (req, res) => {
  const b = req.body || {};
  if (typeof b.narration_vi !== "string" || typeof b.narration_en !== "string")
    return res
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Cần kịch bản tiếng Việt và tiếng Anh",
        },
      });
  try {
    const r = await pool.query(
      "UPDATE attractions SET narration_vi=$2,narration_en=$3,narration_published=COALESCE($4,narration_published) WHERE id=$1 RETURNING id",
      [
        req.params.id,
        b.narration_vi,
        b.narration_en,
        typeof b.narration_published === "boolean"
          ? b.narration_published
          : null,
      ],
    );
    if (!r.rowCount)
      return res
        .status(404)
        .json({
          error: { code: "NOT_FOUND", message: "Không tìm thấy địa điểm" },
        });
    for (const language of ["vi", "en"]) {
      const audioUrl = language === "vi" ? b.audio_vi : b.audio_en;
      if (audioUrl !== undefined)
        await pool.query(
          "INSERT INTO narration_assets(attraction_id,language,audio_url) VALUES($1,$2,$3) ON CONFLICT(attraction_id,language) DO UPDATE SET audio_url=EXCLUDED.audio_url,updated_at=NOW()",
          [req.params.id, language, audioUrl || null],
        );
    }
    res.json({ data: { id: req.params.id, updated: true } });
  } catch {
    res
      .status(400)
      .json({
        error: { code: "UPDATE_FAILED", message: "Không thể lưu kịch bản" },
      });
  }
});

app.listen(process.env.PORT || 4103, () =>
  console.log("narration-service ready"),
);
