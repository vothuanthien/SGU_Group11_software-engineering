import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import { buildGatewayRoutes } from "./routes.js";
const app = express();
app.use(helmet());
app.use(cors());
app.use(
  rateLimit({
    windowMs: 60000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.get("x-real-ip") || req.ip,
  }),
);
app.get("/api/v1/health", async (_req, res) => {
  const services = {};
  for (const [name, url] of Object.entries({
    auth: process.env.AUTH_SERVICE_URL,
    content: process.env.CONTENT_SERVICE_URL,
    navigation: process.env.NAVIGATION_SERVICE_URL,
    feedback: process.env.FEEDBACK_SERVICE_URL,
    analytics: process.env.ANALYTICS_SERVICE_URL,
  })) {
    try {
      const r = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(1800),
      });
      services[name] = r.ok ? "ok" : "unavailable";
    } catch {
      services[name] = "unavailable";
    }
  }
  const ok = Object.values(services).every((x) => x === "ok");
  res.status(ok ? 200 : 503).json({ status: ok ? "ok" : "degraded", services });
});
const routes = buildGatewayRoutes();
for (const { prefix, target, resource } of routes) {
  app.use(
    prefix,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      timeout: 5000,
      proxyTimeout: 5000,
      pathRewrite: (path) => resource + (path === "/" ? "" : path),
      on: {
        error: (_err, _req, res) => {
          if (!res.headersSent)
            res.writeHead(502, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: {
                code: "UPSTREAM_UNAVAILABLE",
                message: "Dịch vụ phía sau tạm thời không khả dụng",
              },
            }),
          );
        },
      },
    }),
  );
}
app.get("/api/v1", (_req, res) =>
  res.json({ name: "Dinh Doc Lap Audio Guide API", version: "1.0.0" }),
);
app.use((_req, res) => {
  res
    .status(404)
    .json({ error: { code: "ROUTE_NOT_FOUND", message: "Không tìm thấy API" } });
});
app.listen(process.env.PORT || 4000, () => console.log("API Gateway ready"));
