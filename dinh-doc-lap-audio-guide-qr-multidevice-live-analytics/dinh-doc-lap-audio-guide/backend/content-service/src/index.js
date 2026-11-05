import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import { CONTENT_ROUTES, rewriteContentPath } from "./routing.js";

const app = express();
const dependencies = {
  attraction:
    process.env.ATTRACTION_SERVICE_URL || "http://localhost:4102",
  narration: process.env.NARRATION_SERVICE_URL || "http://localhost:4103",
};

app.use(helmet());
app.use(cors());
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", async (_req, res) => {
  const results = await Promise.all(
    Object.entries(dependencies).map(async ([name, url]) => {
      try {
        const response = await fetch(`${url}/health`, {
          signal: AbortSignal.timeout(1800),
        });
        return [name, response.ok ? "ok" : "unavailable"];
      } catch {
        return [name, "unavailable"];
      }
    }),
  );
  const services = Object.fromEntries(results);
  const healthy = Object.values(services).every((status) => status === "ok");
  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "degraded",
    service: "content-service",
    dependencies: services,
  });
});

for (const route of CONTENT_ROUTES) {
  const target = dependencies[route.target];
  app.use(
    route.prefix,
    createProxyMiddleware({
      target,
      changeOrigin: true,
      timeout: 7000,
      proxyTimeout: 7000,
      pathRewrite: (path) => rewriteContentPath(route.resource, path),
      on: {
        error: (_error, _req, res) => {
          if (!res.headersSent) {
            res.writeHead(502, { "Content-Type": "application/json" });
          }
          res.end(
            JSON.stringify({
              error: {
                code: "CONTENT_DEPENDENCY_UNAVAILABLE",
                message: "Dịch vụ nội dung tạm thời không khả dụng",
              },
            }),
          );
        },
      },
    }),
  );
}

app.get("/", (_req, res) => {
  res.json({ service: "content-service", status: "ready" });
});

const port = Number(process.env.PORT) || 4106;
app.listen(port, () => console.log(`content-service ready on ${port}`));
