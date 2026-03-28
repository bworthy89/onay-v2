import express from 'express';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'onay-api', version: '0.1.0' });
});

app.listen(PORT, () => {
  console.log(`ONAY API listening on port ${PORT}`);
});

export default app;
