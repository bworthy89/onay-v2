import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { stationsRouter } from './routes/stations.js';
import { segmentsRouter } from './routes/segments.js';

interface HttpError extends Error {
  status?: number;
}

const app = express();

app.use(cors());
app.use(express.json());

app.use(healthRouter);
app.use(stationsRouter);
app.use(segmentsRouter);

app.use((err: HttpError, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? 500;
  res.status(status).json({ error: err.message });
});

export default app;
