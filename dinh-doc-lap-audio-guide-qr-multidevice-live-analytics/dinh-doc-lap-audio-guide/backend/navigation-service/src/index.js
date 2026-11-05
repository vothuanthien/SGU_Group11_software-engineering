import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { buildEstimatedRoute } from "./route.js";

const app = express();
const attractionServiceUrl =
  process.env.ATTRACTION_SERVICE_URL || "http://localhost:4102";

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "32kb" }));
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

async function getAttractions() {
  const response = await fetch(`${attractionServiceUrl}/attractions`, {
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) throw new Error("ATTRACTION_SERVICE_UNAVAILABLE");
  const payload = await response.json();
  return Array.isArray(payload.data) ? payload.data : [];
}

app.get("/health", async (_req, res) => {
  try {
    const response = await fetch(`${attractionServiceUrl}/health`, {
      signal: AbortSignal.timeout(1800),
    });
    if (!response.ok) throw new Error("dependency unavailable");
    res.json({ status: "ok", service: "navigation-service", dependencies: { attraction: "ok" } });
  } catch {
    res.status(503).json({
      status: "degraded",
      service: "navigation-service",
      dependencies: { attraction: "unavailable" },
    });
  }
});

app.post("/navigation/route", async (req, res) => {
  const { destinationId, origin, originAttractionId } = req.body || {};
  if (typeof destinationId !== "string" || destinationId.trim().length === 0) {
    return res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "Cần cung cấp destinationId" },
    });
  }

  try {
    const attractions = await getAttractions();
    const result = buildEstimatedRoute({
      attractions,
      destinationId: destinationId.trim(),
      origin,
      originAttractionId,
    });
    if (result.error) {
      const status = result.error === "DESTINATION_NOT_FOUND" ? 404 : 400;
      return res.status(status).json({
        error: { code: result.error, message: result.message },
      });
    }
    return res.json(result);
  } catch {
    return res.status(503).json({
      error: {
        code: "ATTRACTION_SERVICE_UNAVAILABLE",
        message: "Không thể lấy tọa độ từ Attraction Service",
      },
    });
  }
});

const port = Number(process.env.PORT) || 4107;
app.listen(port, () => console.log(`navigation-service ready on ${port}`));
