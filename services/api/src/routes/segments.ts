import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import db from '../db.js';
import { generateSegmentId, type SegmentType } from '@onay/core';

const SEGMENT_AUDIO_DIR = process.env.SEGMENT_AUDIO_DIR ?? 'data/segments';

if (!fs.existsSync(SEGMENT_AUDIO_DIR)) {
  fs.mkdirSync(SEGMENT_AUDIO_DIR, { recursive: true });
}

const VALID_SEGMENT_TYPES: SegmentType[] = [
  'show_intro', 'show_outro', 'song_intro', 'transition',
  'artist_shoutout', 'genre_vibe', 'fun_fact', 'hot_take',
  'time_of_day', 'ad_lib', 'seasonal',
];

const upload = multer({
  storage: multer.diskStorage({
    destination: SEGMENT_AUDIO_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.wav', '.mp3'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      const err: Error & { status?: number } = new Error('Only .wav and .mp3 files are allowed');
      err.status = 400;
      cb(err);
    }
  },
});

export const segmentsRouter = Router();

interface SegmentRow {
  segment_id: string;
  type: string;
  genre_tags: string | null;
  mood_tags: string | null;
  artist_refs: string | null;
  energy_level: number;
  duration_ms: number;
  quality_score: number;
  exaggeration_level: number;
  usage_count: number;
  audio_url: string | null;
  script_text: string;
  status: string;
  created_at: string;
}

function rowToSegment(row: SegmentRow) {
  return {
    segment_id: row.segment_id,
    type: row.type,
    genre_tags: JSON.parse(row.genre_tags || '[]'),
    mood_tags: JSON.parse(row.mood_tags || '[]'),
    artist_refs: JSON.parse(row.artist_refs || '[]'),
    energy_level: row.energy_level,
    duration_ms: row.duration_ms,
    quality_score: row.quality_score,
    exaggeration_level: row.exaggeration_level,
    usage_count: row.usage_count,
    audio_url: row.audio_url,
    script_text: row.script_text,
    status: row.status,
    created_at: row.created_at,
  };
}

function validateStringArray(value: unknown, fieldName: string): string[] | { error: string } {
  if (value === undefined || value === null || value === '') return [];

  let arr: unknown;
  if (typeof value === 'string') {
    try {
      arr = JSON.parse(value);
    } catch {
      return { error: `${fieldName} must be a valid JSON array of strings` };
    }
  } else {
    arr = value;
  }

  if (!Array.isArray(arr)) {
    return { error: `${fieldName} must be an array of strings` };
  }

  if (!arr.every((item) => typeof item === 'string')) {
    return { error: `${fieldName} must contain only strings` };
  }

  return arr;
}

function validateFiniteNumber(value: unknown, defaultValue: number): number | null {
  if (value === undefined || value === null || value === '') return defaultValue;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

// GET /api/segments/stats — must be before /:id
segmentsRouter.get('/api/segments/stats', (_req: Request, res: Response) => {
  const total = (db.prepare('SELECT COUNT(*) as count FROM segments').get() as { count: number }).count;

  const byType = db.prepare(
    'SELECT type, COUNT(*) as count FROM segments GROUP BY type'
  ).all() as { type: string; count: number }[];

  const by_type: Record<string, number> = {};
  for (const row of byType) {
    by_type[row.type] = row.count;
  }

  const avgRow = db.prepare('SELECT AVG(quality_score) as avg FROM segments').get() as { avg: number | null };
  const totalDurRow = db.prepare('SELECT SUM(duration_ms) as total FROM segments').get() as { total: number | null };

  res.json({
    total,
    by_type,
    avg_quality: Math.round((avgRow.avg ?? 0) * 1000) / 1000,
    total_duration_ms: totalDurRow.total ?? 0,
  });
});

// POST /api/segments/bulk-approve — must be before /:id
segmentsRouter.post('/api/segments/bulk-approve', (req: Request, res: Response) => {
  const { quality_threshold } = req.body;

  if (quality_threshold === undefined || typeof quality_threshold !== 'number') {
    res.status(400).json({ error: 'quality_threshold is required and must be a number' });
    return;
  }

  const result = db.prepare(
    "UPDATE segments SET status = 'approved' WHERE quality_score >= ? AND status = 'pending'"
  ).run(quality_threshold);

  res.json({ approved_count: result.changes });
});

// POST /api/segments
segmentsRouter.post('/api/segments', upload.single('audio'), (req: Request, res: Response) => {
  const { type, genre_tags, mood_tags, artist_refs, energy_level, duration_ms, quality_score, exaggeration_level, script_text } = req.body;

  if (!type || !VALID_SEGMENT_TYPES.includes(type)) {
    res.status(400).json({ error: `type is required and must be one of: ${VALID_SEGMENT_TYPES.join(', ')}` });
    return;
  }

  if (!script_text) {
    res.status(400).json({ error: 'script_text is required' });
    return;
  }

  const durationNum = validateFiniteNumber(duration_ms, 0);
  if (durationNum === null || durationNum <= 0) {
    res.status(400).json({ error: 'duration_ms is required and must be a positive number' });
    return;
  }

  const energyNum = validateFiniteNumber(energy_level, 3);
  if (energyNum === null || !Number.isInteger(energyNum) || energyNum < 1 || energyNum > 5) {
    res.status(400).json({ error: 'energy_level must be an integer between 1 and 5' });
    return;
  }

  const qualityNum = validateFiniteNumber(quality_score, 0);
  if (qualityNum === null) {
    res.status(400).json({ error: 'quality_score must be a finite number' });
    return;
  }

  const exaggerationNum = validateFiniteNumber(exaggeration_level, 0);
  if (exaggerationNum === null) {
    res.status(400).json({ error: 'exaggeration_level must be a finite number' });
    return;
  }

  const parsedGenre = validateStringArray(genre_tags, 'genre_tags');
  if ('error' in parsedGenre) { res.status(400).json(parsedGenre); return; }

  const parsedMood = validateStringArray(mood_tags, 'mood_tags');
  if ('error' in parsedMood) { res.status(400).json(parsedMood); return; }

  const parsedArtists = validateStringArray(artist_refs, 'artist_refs');
  if ('error' in parsedArtists) { res.status(400).json(parsedArtists); return; }

  const segmentId = req.body.segment_id || generateSegmentId(type as SegmentType);
  const audioUrl = req.file ? path.relative(process.cwd(), req.file.path) : null;

  db.prepare(
    `INSERT INTO segments (segment_id, type, genre_tags, mood_tags, artist_refs, energy_level, duration_ms, quality_score, exaggeration_level, audio_url, script_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    segmentId,
    type,
    JSON.stringify(parsedGenre),
    JSON.stringify(parsedMood),
    JSON.stringify(parsedArtists),
    energyNum,
    durationNum,
    qualityNum,
    exaggerationNum,
    audioUrl,
    script_text
  );

  const row = db.prepare('SELECT * FROM segments WHERE segment_id = ?').get(segmentId) as SegmentRow;
  res.status(201).json(rowToSegment(row));
});

// GET /api/segments
segmentsRouter.get('/api/segments', (req: Request, res: Response) => {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (req.query.type) {
    conditions.push('type = ?');
    params.push(req.query.type);
  }

  if (req.query.genre) {
    conditions.push("genre_tags LIKE ?");
    params.push(`%${req.query.genre}%`);
  }

  if (req.query.mood) {
    conditions.push("mood_tags LIKE ?");
    params.push(`%${req.query.mood}%`);
  }

  if (req.query.artist) {
    conditions.push("artist_refs LIKE ?");
    params.push(`%${req.query.artist}%`);
  }

  if (req.query.energyMin) {
    conditions.push('energy_level >= ?');
    params.push(Number(req.query.energyMin));
  }

  if (req.query.energyMax) {
    conditions.push('energy_level <= ?');
    params.push(Number(req.query.energyMax));
  }

  if (req.query.qualityMin) {
    conditions.push('quality_score >= ?');
    params.push(Number(req.query.qualityMin));
  }

  if (req.query.search) {
    conditions.push('script_text LIKE ?');
    params.push(`%${req.query.search}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const offset = Number(req.query.offset) || 0;

  const total = (
    db.prepare(`SELECT COUNT(*) as count FROM segments ${where}`).get(...params) as { count: number }
  ).count;

  const rows = db.prepare(
    `SELECT * FROM segments ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset) as SegmentRow[];

  res.json({ segments: rows.map(rowToSegment), total });
});

// GET /api/segments/:id
segmentsRouter.get('/api/segments/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM segments WHERE segment_id = ?').get(req.params.id) as SegmentRow | undefined;

  if (!row) {
    res.status(404).json({ error: 'Segment not found' });
    return;
  }

  res.json(rowToSegment(row));
});

// PUT /api/segments/:id
segmentsRouter.put('/api/segments/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM segments WHERE segment_id = ?').get(req.params.id) as SegmentRow | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Segment not found' });
    return;
  }

  const { type, genre_tags, mood_tags, artist_refs, energy_level, duration_ms, quality_score, exaggeration_level, script_text, status } = req.body;

  if (type !== undefined && !VALID_SEGMENT_TYPES.includes(type)) {
    res.status(400).json({ error: `type must be one of: ${VALID_SEGMENT_TYPES.join(', ')}` });
    return;
  }

  if (energy_level !== undefined) {
    const e = Number(energy_level);
    if (!Number.isFinite(e) || !Number.isInteger(e) || e < 1 || e > 5) {
      res.status(400).json({ error: 'energy_level must be an integer between 1 and 5' });
      return;
    }
  }

  if (duration_ms !== undefined) {
    const d = Number(duration_ms);
    if (!Number.isFinite(d) || d <= 0) {
      res.status(400).json({ error: 'duration_ms must be a positive number' });
      return;
    }
  }

  if (quality_score !== undefined && !Number.isFinite(Number(quality_score))) {
    res.status(400).json({ error: 'quality_score must be a finite number' });
    return;
  }

  if (exaggeration_level !== undefined && !Number.isFinite(Number(exaggeration_level))) {
    res.status(400).json({ error: 'exaggeration_level must be a finite number' });
    return;
  }

  if (status !== undefined && !['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'status must be one of: pending, approved, rejected' });
    return;
  }

  let genreJson = existing.genre_tags;
  if (genre_tags !== undefined) {
    const parsed = validateStringArray(genre_tags, 'genre_tags');
    if ('error' in parsed) { res.status(400).json(parsed); return; }
    genreJson = JSON.stringify(parsed);
  }

  let moodJson = existing.mood_tags;
  if (mood_tags !== undefined) {
    const parsed = validateStringArray(mood_tags, 'mood_tags');
    if ('error' in parsed) { res.status(400).json(parsed); return; }
    moodJson = JSON.stringify(parsed);
  }

  let artistJson = existing.artist_refs;
  if (artist_refs !== undefined) {
    const parsed = validateStringArray(artist_refs, 'artist_refs');
    if ('error' in parsed) { res.status(400).json(parsed); return; }
    artistJson = JSON.stringify(parsed);
  }

  db.prepare(
    `UPDATE segments SET
       type = ?,
       genre_tags = ?,
       mood_tags = ?,
       artist_refs = ?,
       energy_level = ?,
       duration_ms = ?,
       quality_score = ?,
       exaggeration_level = ?,
       script_text = ?,
       status = ?
     WHERE segment_id = ?`
  ).run(
    type ?? existing.type,
    genreJson,
    moodJson,
    artistJson,
    energy_level ?? existing.energy_level,
    duration_ms ?? existing.duration_ms,
    quality_score ?? existing.quality_score,
    exaggeration_level ?? existing.exaggeration_level,
    script_text ?? existing.script_text,
    status ?? existing.status,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM segments WHERE segment_id = ?').get(req.params.id) as SegmentRow;
  res.json(rowToSegment(updated));
});

// DELETE /api/segments/:id
segmentsRouter.delete('/api/segments/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT audio_url FROM segments WHERE segment_id = ?').get(req.params.id) as { audio_url: string | null } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Segment not found' });
    return;
  }

  if (row.audio_url) {
    const fullPath = path.resolve(row.audio_url);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  db.prepare('DELETE FROM segments WHERE segment_id = ?').run(req.params.id);
  res.status(204).end();
});
