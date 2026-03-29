import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';

export const timelinesRouter = Router();

interface TimelineRow {
  id: string;
  station_id: string;
  entries: string;
  created_at: string;
}

function rowToManifest(row: TimelineRow) {
  return {
    id: row.id,
    station_id: row.station_id,
    created_at: row.created_at,
    entries: JSON.parse(row.entries),
  };
}

function validateEntries(entries: unknown): string | null {
  if (!Array.isArray(entries) || entries.length === 0) {
    return 'entries must be a non-empty array';
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry || typeof entry !== 'object') {
      return `entries[${i}] must be an object`;
    }

    if (entry.type === 'song') {
      if (!entry.canonical_id || typeof entry.canonical_id !== 'string') {
        return `entries[${i}]: song entry requires canonical_id (string)`;
      }
      if (!entry.artist || typeof entry.artist !== 'string') {
        return `entries[${i}]: song entry requires artist (string)`;
      }
      if (!entry.title || typeof entry.title !== 'string') {
        return `entries[${i}]: song entry requires title (string)`;
      }
      if (typeof entry.duration_ms !== 'number' || entry.duration_ms <= 0) {
        return `entries[${i}]: song entry requires duration_ms (positive number)`;
      }
    } else if (entry.type === 'segment') {
      if (!entry.segment_id || typeof entry.segment_id !== 'string') {
        return `entries[${i}]: segment entry requires segment_id (string)`;
      }
      if (!entry.audio_url || typeof entry.audio_url !== 'string') {
        return `entries[${i}]: segment entry requires audio_url (string)`;
      }
      if (typeof entry.duration_ms !== 'number' || entry.duration_ms <= 0) {
        return `entries[${i}]: segment entry requires duration_ms (positive number)`;
      }
    } else {
      return `entries[${i}]: type must be "song" or "segment"`;
    }
  }

  return null;
}

// POST /api/timelines
timelinesRouter.post('/api/timelines', (req: Request, res: Response) => {
  const { station_id, entries } = req.body;

  if (!station_id || typeof station_id !== 'string') {
    res.status(400).json({ error: 'station_id is required and must be a string' });
    return;
  }

  const station = db.prepare('SELECT id FROM stations WHERE id = ?').get(station_id);
  if (!station) {
    res.status(404).json({ error: 'Station not found' });
    return;
  }

  const validationError = validateEntries(entries);
  if (validationError) {
    res.status(400).json({ error: validationError });
    return;
  }

  const timelineId = crypto.randomUUID();
  const historyId = crypto.randomUUID();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO timelines (id, station_id, entries) VALUES (?, ?, ?)`
    ).run(timelineId, station_id, JSON.stringify(entries));

    db.prepare(
      `INSERT INTO timeline_history (id, timeline_id, station_id) VALUES (?, ?, ?)`
    ).run(historyId, timelineId, station_id);
  })();

  const row = db.prepare('SELECT * FROM timelines WHERE id = ?').get(timelineId) as TimelineRow;
  res.status(201).json(rowToManifest(row));
});

// GET /api/stations/:id/timeline
timelinesRouter.get('/api/stations/:id/timeline', (req: Request, res: Response) => {
  const station = db.prepare('SELECT id FROM stations WHERE id = ?').get(req.params.id);
  if (!station) {
    res.status(404).json({ error: 'Station not found' });
    return;
  }

  const row = db.prepare(
    'SELECT * FROM timelines WHERE station_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(req.params.id) as TimelineRow | undefined;

  if (!row) {
    res.status(404).json({ error: 'No timeline found for this station' });
    return;
  }

  res.json(rowToManifest(row));
});

// GET /api/stations/:id/timeline/history
timelinesRouter.get('/api/stations/:id/timeline/history', (req: Request, res: Response) => {
  const station = db.prepare('SELECT id FROM stations WHERE id = ?').get(req.params.id);
  if (!station) {
    res.status(404).json({ error: 'Station not found' });
    return;
  }

  const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

  const rows = db.prepare(
    'SELECT * FROM timelines WHERE station_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(req.params.id, limit, offset) as TimelineRow[];

  const result = rows.map((row) => {
    const entries = JSON.parse(row.entries) as Array<{ duration_ms: number }>;
    return {
      id: row.id,
      created_at: row.created_at,
      entry_count: entries.length,
      total_duration_ms: entries.reduce((sum, e) => sum + (e.duration_ms || 0), 0),
    };
  });

  res.json(result);
});

// GET /api/timelines/:id
timelinesRouter.get('/api/timelines/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM timelines WHERE id = ?').get(req.params.id) as TimelineRow | undefined;

  if (!row) {
    res.status(404).json({ error: 'Timeline not found' });
    return;
  }

  res.json(rowToManifest(row));
});
