import 'dotenv/config';
import app from './app.js';
import { migrate } from './migrate.js';

migrate();

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`ONAY API listening on port ${PORT}`);
});
