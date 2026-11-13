import { apiErrorHandler, app, pool } from "./base.js";
import { isSupportedLanguage } from "./validation.js";
import jwt from "jsonwebtoken";
const attractionUrl =
  process.env.ATTRACTION_SERVICE_URL || "http://localhost:4102";
const secret = process.env.JWT_SECRET;
const narrationFields = {
  vi: { title: "name_vi", description: "description_vi", text: "narration_vi", area: "area_vi" },
  en: { title: "name_en", description: "description_en", text: "narration_en", area: "area_en" },
  zh: { text: "narration_zh" },
  th: { text: "narration_th" },
};
if (!secret || secret.length < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters");
}
app.get("/narrations/admin/:id", admin, async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id,name_vi,name_en,narration_vi,narration_en,narration_zh,narration_th,source_url FROM attractions WHERE id=$1",
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
  if (!isSupportedLanguage(language))
    return res
      .status(400)
      .json({
        error: {
          code: "INVALID_LANGUAGE",
          message: "Ngôn ngữ chỉ hỗ trợ vi, en, zh hoặc th",
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
      "SELECT a.id,a.name_vi,a.name_en,a.description_vi,a.description_en,a.narration_vi,a.narration_en,a.narration_zh,a.narration_th,a.area_vi,a.area_en,a.duration_minutes,a.source_url,a.narration_published,na.audio_url FROM attractions a LEFT JOIN narration_assets na ON na.attraction_id=a.id AND na.language=$2 WHERE a.id=$1 AND a.visible=true AND a.narration_published=true",
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
    const fields = narrationFields[language];
    if (typeof a[fields.text] !== "string" || !a[fields.text].trim())
      return res.status(404).json({
        error: {
          code: "TRANSLATION_UNAVAILABLE",
          message: "Chưa có nội dung thuyết minh bằng ngôn ngữ này",
        },
      });
    res.json({
      data: {
        attractionId: a.id,
        language,
        title: fields.title ? a[fields.title] : null,
        description: fields.description ? a[fields.description] : null,
        text: a[fields.text],
        area: fields.area ? a[fields.area] : null,
        durationMinutes: a.duration_minutes,
        sourceUrl: a.source_url,
        audioUrl: a.audio_url || null,
        audioMode: a.audio_url ? "file" : "web-speech-fallback",
        translationStatus: language === "zh" || language === "th" ? "draft" : "source",
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
      secret,
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
  if (
    typeof b.narration_vi !== "string" ||
    typeof b.narration_en !== "string" ||
    (b.narration_zh !== undefined && typeof b.narration_zh !== "string") ||
    (b.narration_th !== undefined && typeof b.narration_th !== "string")
  )
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
      "UPDATE attractions SET narration_vi=$2,narration_en=$3,narration_zh=COALESCE($4,narration_zh),narration_th=COALESCE($5,narration_th),narration_published=COALESCE($6,narration_published) WHERE id=$1 RETURNING id",
      [
        req.params.id,
        b.narration_vi,
        b.narration_en,
        b.narration_zh ?? null,
        b.narration_th ?? null,
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
    for (const language of ["vi", "en", "zh", "th"]) {
      const audioUrl = b[`audio_${language}`];
      if (audioUrl !== undefined)
        await pool.query(
          "INSERT INTO narration_assets(attraction_id,language,audio_url) VALUES($1,$2,$3) ON CONFLICT(attraction_id,language) DO UPDATE SET audio_url=EXCLUDED.audio_url,updated_at=NOW()",
          [req.params.id, language, audioUrl || null],
        );
    }
    res.json({ data: { id: req.params.id, updated: true } });
  } catch {
    res
      .status(503)
      .json({
        error: { code: "DB_UNAVAILABLE", message: "Không thể lưu kịch bản" },
      });
  }
});

app.use((_req, res) => {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Không tìm thấy API" } });
});
app.use(apiErrorHandler);
app.listen(process.env.PORT || 4103, () =>
  console.log("narration-service ready"),
);
