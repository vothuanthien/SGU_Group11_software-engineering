import { apiErrorHandler, app, pool } from "./base.js";
import { isValidFeedback } from "./validation.js";
import jwt from "jsonwebtoken";
const attractionUrl =
  process.env.ATTRACTION_SERVICE_URL || "http://localhost:4102";
const secret = process.env.JWT_SECRET || "local_only_change_this_secret";
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
app.post("/feedback", async (req, res) => {
  const b = req.body || {};
  if (!isValidFeedback(b))
    return res
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message:
            "Đánh giá phải từ 1–5 sao; nội dung 1–1000 ký tự; loại phản hồi không hợp lệ",
        },
      });
  if (b.attractionId) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    try {
      const r = await fetch(
        `${attractionUrl}/internal/attractions/${encodeURIComponent(b.attractionId)}/exists`,
        { signal: ctl.signal },
      );
      if (!r.ok)
        return res
          .status(503)
          .json({
            error: {
              code: "DEPENDENCY_UNAVAILABLE",
              message: "Không thể xác minh địa điểm",
            },
          });
      if (!(await r.json()).exists)
        return res
          .status(400)
          .json({
            error: {
              code: "INVALID_ATTRACTION",
              message: "Địa điểm không tồn tại",
            },
          });
    } catch {
      return res
        .status(503)
        .json({
          error: {
            code: "DEPENDENCY_UNAVAILABLE",
            message: "Attraction Service không khả dụng",
          },
        });
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    const r = await pool.query(
      "INSERT INTO feedback(attraction_id,rating,message,type) VALUES($1,$2,$3,$4) RETURNING id,attraction_id,rating,message,type,status,created_at",
      [b.attractionId || null, b.rating, b.message.trim(), b.type || "review"],
    );
    res.status(201).json({ data: r.rows[0] });
  } catch {
    res
      .status(503)
      .json({
        error: { code: "DB_UNAVAILABLE", message: "Không lưu được phản hồi" },
      });
  }
});
app.get("/feedback", admin, async (_req, res) => {
  try {
    const r = await pool.query(
      "SELECT * FROM feedback ORDER BY created_at DESC LIMIT 200",
    );
    res.json({ data: r.rows });
  } catch {
    res
      .status(503)
      .json({
        error: { code: "DB_UNAVAILABLE", message: "Không lấy được phản hồi" },
      });
  }
});
app.patch("/feedback/:id/status", admin, async (req, res) => {
  if (!["new", "reviewing", "resolved"].includes(req.body?.status))
    return res
      .status(400)
      .json({
        error: { code: "VALIDATION_ERROR", message: "Trạng thái không hợp lệ" },
      });
  try {
    const r = await pool.query(
      "UPDATE feedback SET status=$1 WHERE id=$2 RETURNING *",
      [req.body.status, req.params.id],
    );
    if (!r.rowCount)
      return res
        .status(404)
        .json({
          error: { code: "NOT_FOUND", message: "Không tìm thấy phản hồi" },
        });
    res.json({ data: r.rows[0] });
  } catch {
    res
      .status(503)
      .json({
        error: {
          code: "DB_UNAVAILABLE",
          message: "Không cập nhật được phản hồi",
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
app.listen(process.env.PORT || 4104, () =>
  console.log("feedback-service ready"),
);
