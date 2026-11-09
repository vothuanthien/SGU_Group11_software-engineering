import { apiErrorHandler, app, pool } from "./base.js";
import { hasRequiredAttractionFields } from "./validation.js";
import jwt from "jsonwebtoken";
const secret = process.env.JWT_SECRET || "local_only_change_this_secret";
function admin(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const u = jwt.verify(h.replace(/^Bearer /, ""), secret);
    if (u.role !== "admin")
      return res
        .status(403)
        .json({ error: { code: "FORBIDDEN", message: "Chỉ quản trị viên" } });
    req.user = u;
    next();
  } catch {
    return res
      .status(401)
      .json({
        error: { code: "UNAUTHORIZED", message: "Cần đăng nhập quản trị" },
      });
  }
}
app.get("/attractions", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id,name_vi,name_en,description_vi,description_en,area_vi,area_en,latitude,longitude,sort_order,duration_minutes,image_url,source_url,narration_published FROM attractions WHERE visible=true ORDER BY sort_order",
    );
    res.json({ data: r.rows });
  } catch {
    res
      .status(503)
      .json({
        error: {
          code: "DB_UNAVAILABLE",
          message: "Không lấy được danh sách địa điểm",
        },
      });
  }
});
app.get("/attractions/:id", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id,name_vi,name_en,description_vi,description_en,area_vi,area_en,latitude,longitude,sort_order,duration_minutes,image_url,source_url,narration_published FROM attractions WHERE id=$1 AND visible=true",
      [req.params.id],
    );
    if (!r.rowCount)
      return res
        .status(404)
        .json({
          error: { code: "NOT_FOUND", message: "Không tìm thấy địa điểm" },
        });
    res.json({ data: r.rows[0] });
  } catch {
    res
      .status(503)
      .json({
        error: { code: "DB_UNAVAILABLE", message: "Không lấy được địa điểm" },
      });
  }
});
app.get("/tours", async (_req, res) => {
  try {
    const tours = await pool.query("SELECT * FROM tours");
    const stops = await pool.query(
      "SELECT ts.tour_id,ts.stop_order,a.id,a.name_vi,a.name_en FROM tour_stops ts JOIN attractions a ON a.id=ts.attraction_id ORDER BY ts.stop_order",
    );
    res.json({
      data: tours.rows.map((t) => ({
        ...t,
        stops: stops.rows.filter((s) => s.tour_id === t.id),
      })),
    });
  } catch {
    res
      .status(503)
      .json({
        error: { code: "DB_UNAVAILABLE", message: "Không lấy được lộ trình" },
      });
  }
});
app.get("/internal/attractions/:id/exists", async (req, res) => {
  try {
    const r = await pool.query(
      "SELECT id FROM attractions WHERE id=$1 AND visible=true",
      [req.params.id],
    );
    res.json({ exists: !!r.rowCount, id: req.params.id });
  } catch {
    res
      .status(503)
      .json({
        error: {
          code: "DB_UNAVAILABLE",
          message: "Không thể xác minh địa điểm",
        },
      });
  }
});
app.post("/attractions", admin, async (req, res) => {
  const b = req.body || {};
  if (!hasRequiredAttractionFields(b))
    return res
      .status(400)
      .json({
        error: { code: "VALIDATION_ERROR", message: "Thiếu trường bắt buộc" },
      });
  try {
    const r = await pool.query(
      "INSERT INTO attractions(id,name_vi,name_en,description_vi,description_en,narration_vi,narration_en,area_vi,area_en,latitude,longitude,sort_order,duration_minutes,source_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,name_vi,name_en",
      [
        b.id,
        b.name_vi,
        b.name_en,
        b.description_vi,
        b.description_en,
        b.narration_vi,
        b.narration_en,
        b.area_vi || "Khuôn viên",
        b.area_en || "Grounds",
        b.latitude ?? null,
        b.longitude ?? null,
        b.sort_order || 99,
        b.duration_minutes || 2,
        b.source_url || null,
      ],
    );
    res.status(201).json({ data: r.rows[0] });
  } catch (e) {
    res
      .status(400)
      .json({
        error: {
          code: "CREATE_FAILED",
          message: "Không tạo được địa điểm (ID có thể đã tồn tại)",
        },
      });
  }
});

app.get("/attractions/admin/all", admin, async (_req, res) => {
  try {
    const r = await pool.query("SELECT * FROM attractions ORDER BY sort_order");
    res.json({ data: r.rows });
  } catch {
    res
      .status(503)
      .json({
        error: { code: "DB_UNAVAILABLE", message: "Không tải được địa điểm" },
      });
  }
});
app.put("/attractions/:id", admin, async (req, res) => {
  const b = req.body || {};
  try {
    const r = await pool.query(
      `UPDATE attractions SET name_vi=COALESCE($2,name_vi),name_en=COALESCE($3,name_en),description_vi=COALESCE($4,description_vi),description_en=COALESCE($5,description_en),area_vi=COALESCE($6,area_vi),area_en=COALESCE($7,area_en),latitude=$8,longitude=$9,sort_order=COALESCE($10,sort_order),duration_minutes=COALESCE($11,duration_minutes),image_url=$12,source_url=$13,visible=COALESCE($14,visible),narration_vi=COALESCE($15,narration_vi),narration_en=COALESCE($16,narration_en),narration_published=COALESCE($17,narration_published) WHERE id=$1 RETURNING *`,
      [
        req.params.id,
        b.name_vi ?? null,
        b.name_en ?? null,
        b.description_vi ?? null,
        b.description_en ?? null,
        b.area_vi ?? null,
        b.area_en ?? null,
        b.latitude ?? null,
        b.longitude ?? null,
        b.sort_order ?? null,
        b.duration_minutes ?? null,
        b.image_url ?? null,
        b.source_url ?? null,
        b.visible ?? null,
        b.narration_vi ?? null,
        b.narration_en ?? null,
        b.narration_published ?? null,
      ],
    );
    if (!r.rowCount)
      return res
        .status(404)
        .json({
          error: { code: "NOT_FOUND", message: "Không tìm thấy địa điểm" },
        });
    res.json({ data: r.rows[0] });
  } catch (e) {
    res
      .status(400)
      .json({
        error: {
          code: "UPDATE_FAILED",
          message: "Dữ liệu cập nhật không hợp lệ",
        },
      });
  }
});
app.delete("/attractions/:id", admin, async (req, res) => {
  try {
    const r = await pool.query(
      "UPDATE attractions SET visible=false WHERE id=$1 RETURNING id",
      [req.params.id],
    );
    if (!r.rowCount)
      return res
        .status(404)
        .json({
          error: { code: "NOT_FOUND", message: "Không tìm thấy địa điểm" },
        });
    res.json({ data: { id: r.rows[0].id, visible: false } });
  } catch {
    res
      .status(503)
      .json({
        error: { code: "DB_UNAVAILABLE", message: "Không thể ẩn địa điểm" },
      });
  }
});
app.post("/tours", admin, async (req, res) => {
  const b = req.body || {};
  if (!b.id || !b.name_vi || !b.name_en)
    return res
      .status(400)
      .json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Cần ID và tên lộ trình ở hai ngôn ngữ",
        },
      });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO tours(id,name_vi,name_en,description_vi,description_en) VALUES($1,$2,$3,$4,$5)",
      [
        b.id,
        b.name_vi,
        b.name_en,
        b.description_vi || "",
        b.description_en || "",
      ],
    );
    for (let i = 0; i < (b.attractionIds || []).length; i++)
      await client.query(
        "INSERT INTO tour_stops(tour_id,attraction_id,stop_order) VALUES($1,$2,$3)",
        [b.id, b.attractionIds[i], i + 1],
      );
    await client.query("COMMIT");
    res.status(201).json({ data: { id: b.id } });
  } catch {
    await client.query("ROLLBACK");
    res
      .status(400)
      .json({
        error: {
          code: "TOUR_SAVE_FAILED",
          message: "Không thể tạo lộ trình; kiểm tra ID và các điểm tham quan",
        },
      });
  } finally {
    client.release();
  }
});
app.put("/tours/:id", admin, async (req, res) => {
  const b = req.body || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const r = await client.query(
      "UPDATE tours SET name_vi=COALESCE($2,name_vi),name_en=COALESCE($3,name_en),description_vi=COALESCE($4,description_vi),description_en=COALESCE($5,description_en) WHERE id=$1 RETURNING id",
      [
        req.params.id,
        b.name_vi ?? null,
        b.name_en ?? null,
        b.description_vi ?? null,
        b.description_en ?? null,
      ],
    );
    if (!r.rowCount) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({
          error: { code: "NOT_FOUND", message: "Không tìm thấy lộ trình" },
        });
    }
    if (Array.isArray(b.attractionIds)) {
      await client.query("DELETE FROM tour_stops WHERE tour_id=$1", [
        req.params.id,
      ]);
      for (let i = 0; i < b.attractionIds.length; i++)
        await client.query(
          "INSERT INTO tour_stops(tour_id,attraction_id,stop_order) VALUES($1,$2,$3)",
          [req.params.id, b.attractionIds[i], i + 1],
        );
    }
    await client.query("COMMIT");
    res.json({ data: { id: req.params.id } });
  } catch {
    await client.query("ROLLBACK");
    res
      .status(400)
      .json({
        error: {
          code: "TOUR_SAVE_FAILED",
          message: "Không thể cập nhật lộ trình",
        },
      });
  } finally {
    client.release();
  }
});

app.use((_req, res) => {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Không tìm thấy API" } });
});
app.use(apiErrorHandler);
app.listen(process.env.PORT || 4102, () =>
  console.log("attraction-service ready"),
);
