import { apiErrorHandler, app, pool } from "./base.js";
import { hasLoginCredentials } from "./validation.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters");
}
app.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!hasLoginCredentials({ email, password }))
    return res
      .status(400)
      .json({
        error: { code: "VALIDATION_ERROR", message: "Cần email và mật khẩu" },
      });
  try {
    const r = await pool.query(
      "SELECT id,email,password_hash,role FROM users WHERE email=$1",
      [String(email).toLowerCase()],
    );
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(String(password), u.password_hash)))
      return res
        .status(401)
        .json({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Email hoặc mật khẩu không đúng",
          },
        });
    const token = jwt.sign(
      { sub: u.id, email: u.email, role: u.role },
      secret,
      { expiresIn: "8h" },
    );
    res.json({
      data: { token, user: { id: u.id, email: u.email, role: u.role } },
    });
  } catch (e) {
    console.error(e);
    res
      .status(503)
      .json({ error: { code: "DB_UNAVAILABLE", message: "Không thể đăng nhập lúc này" } });
  }
});
app.get("/me", (req, res) => {
  const h = req.headers.authorization || "";
  try {
    if (!h.startsWith("Bearer ")) throw Error();
    const user = jwt.verify(h.slice(7), secret);
    res.json({ data: { user } });
  } catch {
    res
      .status(401)
      .json({ error: { code: "UNAUTHORIZED", message: "Token không hợp lệ" } });
  }
});
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD;
if (Boolean(adminEmail) !== Boolean(adminPassword)) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be configured together");
}
if (adminPassword && adminPassword.length < 12) {
  throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
}

async function seedAdmin() {
  if (!adminEmail || !adminPassword) return;
  try {
    const r = await pool.query("SELECT id FROM users WHERE email=$1", [
      adminEmail,
    ]);
    if (!r.rowCount) {
      const hash = await bcrypt.hash(adminPassword, 10);
      await pool.query(
        "INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3)",
        [adminEmail, hash, "admin"],
      );
      console.log("Created configured admin account");
    }
  } catch (e) {
    console.error("Admin seed failed", e.message);
  }
}
app.use((_req, res) => {
  res
    .status(404)
    .json({ error: { code: "NOT_FOUND", message: "Không tìm thấy API" } });
});
app.use(apiErrorHandler);
seedAdmin().finally(() =>
  app.listen(process.env.PORT || 4101, () => console.log("auth-service ready")),
);
