import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const MIGRATIONS_DIR = path.resolve(import.meta.dirname, '..', 'migrations');

function runMigrations(db: InstanceType<typeof Database>): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.pragma('foreign_keys = ON');

  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name)
  );

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    })();
  }
}

function getTableNames(db: InstanceType<typeof Database>): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

function getIndexNames(db: InstanceType<typeof Database>): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

describe('migrations', () => {
  let db: InstanceType<typeof Database>;

  beforeEach(() => {
    db = new Database(':memory:');
    runMigrations(db);
  });

  it('creates all expected tables', () => {
    const tables = getTableNames(db);
    expect(tables).toContain('_migrations');
    expect(tables).toContain('stations');
    expect(tables).toContain('station_tracks');
    expect(tables).toContain('segments');
    expect(tables).toContain('timelines');
    expect(tables).toContain('timeline_history');
  });

  it('creates all expected indexes', () => {
    const indexes = getIndexNames(db);
    expect(indexes).toContain('idx_segments_type');
    expect(indexes).toContain('idx_segments_quality_score');
    expect(indexes).toContain('idx_segments_energy_level');
    expect(indexes).toContain('idx_station_tracks_station_position');
    expect(indexes).toContain('idx_timelines_station_id');
    expect(indexes).toContain('idx_timeline_history_station_id');
  });

  it('records migration in _migrations table', () => {
    const rows = db.prepare('SELECT name FROM _migrations').all() as { name: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].name).toBe('001-initial-schema.sql');
  });

  it('is idempotent — running twice does not throw', () => {
    const beforeCount = (db.prepare('SELECT COUNT(*) as count FROM _migrations').get() as { count: number }).count;
    // Already ran once in beforeEach; running again should skip all
    expect(() => runMigrations(db)).not.toThrow();
    const afterCount = (db.prepare('SELECT COUNT(*) as count FROM _migrations').get() as { count: number }).count;
    expect(afterCount).toBe(beforeCount);
  });

  it('enforces foreign keys on station_tracks', () => {
    expect(() => {
      db.prepare(
        "INSERT INTO station_tracks (id, station_id, position, canonical_id, artist, title, duration_ms) VALUES ('t1', 'nonexistent', 1, 'c1', 'Artist', 'Song', 200000)"
      ).run();
    }).toThrow();
  });

  it('cascades deletes from stations to station_tracks', () => {
    db.prepare(
      "INSERT INTO stations (id, name) VALUES ('s1', 'Test Station')"
    ).run();
    db.prepare(
      "INSERT INTO station_tracks (id, station_id, position, canonical_id, artist, title, duration_ms) VALUES ('t1', 's1', 1, 'c1', 'Artist', 'Song', 200000)"
    ).run();

    db.prepare("DELETE FROM stations WHERE id = 's1'").run();

    const tracks = db.prepare("SELECT * FROM station_tracks WHERE station_id = 's1'").all();
    expect(tracks).toHaveLength(0);
  });
});
