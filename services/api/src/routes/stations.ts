import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';

export const stationsRouter = Router();

interface StationRow {
  id: string;
  name: string;
  description: string | null;
  genre_tags: string | null;
  mood_tags: string | null;
  cover_art_url: string | null;
  rotation_schedule: string | null;
  is_published: number;
  created_at: string;
  updated_at: string;
}

interface TrackRow {
  id: string;
  station_id: string;
  position: number;
  canonical_id: string;
  artist: string;
  title: string;
  isrc: string | null;
  duration_ms: number;
  apple_music_id: string | null;
  spotify_id: string | null;
}

function rowToStation(row: StationRow) {
  return {
    station_id: row.id,
    name: row.name,
    description: row.description,
    genre_tags: JSON.parse(row.genre_tags || '[]'),
    mood_tags: JSON.parse(row.mood_tags || '[]'),
    cover_art_url: row.cover_art_url,
    rotation_schedule: row.rotation_schedule ? JSON.parse(row.rotation_schedule) : null,
    is_published: Boolean(row.is_published),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToTrack(row: TrackRow) {
  return {
    id: row.id,
    canonical_id: row.canonical_id,
    artist: row.artist,
    title: row.title,
    isrc: row.isrc,
    duration_ms: row.duration_ms,
    position: row.position,
    apple_music_id: row.apple_music_id,
    spotify_id: row.spotify_id,
  };
}

function validateStringArray(value: unknown, fieldName: string): string[] | { error: string } {
  if (value === undefined || value === null) return [];

  if (!Array.isArray(value)) {
    return { error: `${fieldName} must be an array of strings` };
  }

  if (!value.every((item) => typeof item === 'string')) {
    return { error: `${fieldName} must contain only strings` };
  }

  return value;
}

// POST /api/stations
stationsRouter.post('/api/stations', (req: Request, res: Response) => {
  const { name, description, genre_tags, mood_tags, cover_art_url, rotation_schedule } = req.body;

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'name is required and must be a string' });
    return;
  }

  const parsedGenre = validateStringArray(genre_tags, 'genre_tags');
  if ('error' in parsedGenre) { res.status(400).json(parsedGenre); return; }

  const parsedMood = validateStringArray(mood_tags, 'mood_tags');
  if ('error' in parsedMood) { res.status(400).json(parsedMood); return; }

  if (rotation_schedule !== undefined && rotation_schedule !== null && typeof rotation_schedule !== 'object') {
    res.status(400).json({ error: 'rotation_schedule must be an object' });
    return;
  }

  const id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO stations (id, name, description, genre_tags, mood_tags, cover_art_url, rotation_schedule)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    name,
    description ?? null,
    JSON.stringify(parsedGenre),
    JSON.stringify(parsedMood),
    cover_art_url ?? null,
    rotation_schedule ? JSON.stringify(rotation_schedule) : null
  );

  const row = db.prepare('SELECT * FROM stations WHERE id = ?').get(id) as StationRow;
  res.status(201).json(rowToStation(row));
});

// GET /api/stations
stationsRouter.get('/api/stations', (req: Request, res: Response) => {
  const { published } = req.query;

  let rows: StationRow[];
  if (published === 'true') {
    rows = db.prepare('SELECT * FROM stations WHERE is_published = 1 ORDER BY created_at DESC').all() as StationRow[];
  } else {
    rows = db.prepare('SELECT * FROM stations ORDER BY created_at DESC').all() as StationRow[];
  }

  res.json(rows.map(rowToStation));
});

// GET /api/stations/:id
stationsRouter.get('/api/stations/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id) as StationRow | undefined;

  if (!row) {
    res.status(404).json({ error: 'Station not found' });
    return;
  }

  const tracks = db.prepare(
    'SELECT * FROM station_tracks WHERE station_id = ? ORDER BY position'
  ).all(req.params.id) as TrackRow[];

  const station = rowToStation(row);
  res.json({ ...station, tracklist: tracks.map(rowToTrack) });
});

// PUT /api/stations/:id
stationsRouter.put('/api/stations/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id) as StationRow | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Station not found' });
    return;
  }

  const { name, description, genre_tags, mood_tags, cover_art_url, rotation_schedule, is_published } = req.body;

  if (name !== undefined && typeof name !== 'string') {
    res.status(400).json({ error: 'name must be a string' });
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

  if (rotation_schedule !== undefined && rotation_schedule !== null && typeof rotation_schedule !== 'object') {
    res.status(400).json({ error: 'rotation_schedule must be an object' });
    return;
  }

  if (is_published !== undefined && typeof is_published !== 'boolean') {
    res.status(400).json({ error: 'is_published must be a boolean' });
    return;
  }

  db.prepare(
    `UPDATE stations SET
       name = ?,
       description = ?,
       genre_tags = ?,
       mood_tags = ?,
       cover_art_url = ?,
       rotation_schedule = ?,
       is_published = ?,
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    name ?? existing.name,
    description !== undefined ? description : existing.description,
    genreJson,
    moodJson,
    cover_art_url !== undefined ? cover_art_url : existing.cover_art_url,
    rotation_schedule ? JSON.stringify(rotation_schedule) : existing.rotation_schedule,
    is_published !== undefined ? (is_published ? 1 : 0) : existing.is_published,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id) as StationRow;
  res.json(rowToStation(updated));
});

// DELETE /api/stations/:id
stationsRouter.delete('/api/stations/:id', (req: Request, res: Response) => {
  const result = db.prepare('DELETE FROM stations WHERE id = ?').run(req.params.id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Station not found' });
    return;
  }

  res.status(204).end();
});

// POST /api/stations/:id/tracks
stationsRouter.post('/api/stations/:id/tracks', (req: Request, res: Response) => {
  const station = db.prepare('SELECT id FROM stations WHERE id = ?').get(req.params.id);

  if (!station) {
    res.status(404).json({ error: 'Station not found' });
    return;
  }

  const { canonical_id, artist, title, isrc, duration_ms, apple_music_id, spotify_id } = req.body;

  if (!canonical_id || !artist || !title || !duration_ms) {
    res.status(400).json({ error: 'canonical_id, artist, title, and duration_ms are required' });
    return;
  }

  const lastTrack = db.prepare(
    'SELECT MAX(position) as max_pos FROM station_tracks WHERE station_id = ?'
  ).get(req.params.id) as { max_pos: number | null };

  const position = (lastTrack.max_pos ?? -1) + 1;
  const id = crypto.randomUUID();

  db.prepare(
    `INSERT INTO station_tracks (id, station_id, position, canonical_id, artist, title, isrc, duration_ms, apple_music_id, spotify_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, req.params.id, position, canonical_id, artist, title, isrc ?? null, duration_ms, apple_music_id ?? null, spotify_id ?? null);

  const row = db.prepare('SELECT * FROM station_tracks WHERE id = ?').get(id) as TrackRow;
  res.status(201).json(rowToTrack(row));
});

// PUT /api/stations/:id/tracks
stationsRouter.put('/api/stations/:id/tracks', (req: Request, res: Response) => {
  const station = db.prepare('SELECT id FROM stations WHERE id = ?').get(req.params.id);

  if (!station) {
    res.status(404).json({ error: 'Station not found' });
    return;
  }

  const tracks = req.body;

  if (!Array.isArray(tracks)) {
    res.status(400).json({ error: 'Body must be an array of tracks' });
    return;
  }

  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    if (!t.canonical_id || !t.artist || !t.title || !t.duration_ms) {
      res.status(400).json({ error: `Track at index ${i} is missing required fields (canonical_id, artist, title, duration_ms)` });
      return;
    }
  }

  db.transaction(() => {
    db.prepare('DELETE FROM station_tracks WHERE station_id = ?').run(req.params.id);

    const insert = db.prepare(
      `INSERT INTO station_tracks (id, station_id, position, canonical_id, artist, title, isrc, duration_ms, apple_music_id, spotify_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      insert.run(
        crypto.randomUUID(),
        req.params.id,
        i,
        track.canonical_id,
        track.artist,
        track.title,
        track.isrc ?? null,
        track.duration_ms,
        track.apple_music_id ?? null,
        track.spotify_id ?? null
      );
    }
  })();

  const updatedTracks = db.prepare(
    'SELECT * FROM station_tracks WHERE station_id = ? ORDER BY position'
  ).all(req.params.id) as TrackRow[];

  res.json(updatedTracks.map(rowToTrack));
});

// DELETE /api/stations/:id/tracks/:trackId
stationsRouter.delete('/api/stations/:id/tracks/:trackId', (req: Request, res: Response) => {
  const track = db.prepare(
    'SELECT * FROM station_tracks WHERE id = ? AND station_id = ?'
  ).get(req.params.trackId, req.params.id) as TrackRow | undefined;

  if (!track) {
    res.status(404).json({ error: 'Track not found' });
    return;
  }

  db.transaction(() => {
    db.prepare('DELETE FROM station_tracks WHERE id = ?').run(req.params.trackId);
    db.prepare(
      'UPDATE station_tracks SET position = position - 1 WHERE station_id = ? AND position > ?'
    ).run(req.params.id, track.position);
  })();

  res.status(204).end();
});
