import Database, { type Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createTestDb(): DatabaseType {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  const migrationsDir = path.resolve(__dirname, '../migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf-8'));
  }

  return db;
}
