import db from './db.js';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '..', 'migrations');

function ensureMigrationsTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function getAppliedMigrations(): Set<string> {
  const rows = db.prepare('SELECT name FROM _migrations').all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function getMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

export function migrate(): void {
  ensureMigrationsTable();

  const applied = getAppliedMigrations();
  const files = getMigrationFiles();

  if (files.length === 0) {
    console.log('[migrate] No migration files found');
    return;
  }

  let count = 0;

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    })();

    console.log(`[migrate] Applied: ${file}`);
    count++;
  }

  if (count === 0) {
    console.log('[migrate] All migrations already applied');
  } else {
    console.log(`[migrate] Done — ${count} migration(s) applied`);
  }
}
