import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pg from 'pg';

const { Pool } = pg;
export const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use(rateLimit({ windowMs: 60_000, max: 180, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => (req.get('x-real-ip') || req.ip) }));
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'analytics-service' });
  } catch {
    res.status(503).json({ status: 'error', service: 'analytics-service' });
  }
});
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Đã xảy ra lỗi máy chủ' } });
});
