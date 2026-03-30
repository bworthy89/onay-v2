import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import {
  selectSegments,
  buildManifest,
  validateManifest,
  getManifestStats,
  StubLLMProvider,
  StubTTSProvider,
} from '@onay/assembly';
import type { Station, Segment, TracklistEntry } from '@onay/core';

export const assembleRouter = Router();

interface StationRow {
  id: string;
  name: string;
  description: string | null;
  genre_tags: string | null;
  mood_tags: string | null;
  cover_art_url: string | null;
  rotation_schedule: string | null;
}

interface TrackRow {
  canonical_id: string;
  artist: string;
  title: string;
  isrc: string | null;
  duration_ms: number;
}

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
  created_at: string;
}

// POST /api/stations/:id/assemble
assembleRouter.post('/api/stations/:id/assemble', async (req: Request, res: Response) => {
  try {
    // 1. Fetch station
    const stationRow = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id) as StationRow | undefined;
    if (!stationRow) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }

    // 2. Fetch tracklist
    const trackRows = db.prepare(
      'SELECT canonical_id, artist, title, isrc, duration_ms FROM station_tracks WHERE station_id = ? ORDER BY position'
    ).all(req.params.id) as TrackRow[];

    if (trackRows.length === 0) {
      res.status(400).json({ error: 'Station has no tracks' });
      return;
    }

    const tracklist: TracklistEntry[] = trackRows.map((r) => ({
      canonical_id: r.canonical_id,
      artist: r.artist,
      title: r.title,
      ...(r.isrc ? { isrc: r.isrc } : {}),
      duration_ms: r.duration_ms,
    }));

    // Build Station object for assembly
    const station: Station = {
      station_id: stationRow.id,
      name: stationRow.name,
      description: stationRow.description ?? '',
      genre_tags: JSON.parse(stationRow.genre_tags || '[]'),
      mood_tags: JSON.parse(stationRow.mood_tags || '[]'),
      cover_art_url: stationRow.cover_art_url ?? '',
      rotation_schedule: stationRow.rotation_schedule
        ? JSON.parse(stationRow.rotation_schedule)
        : { frequency: 'daily', time_of_day_target: 'evening', days: [] },
      tracklist,
      provider_availability: { apple_music: {}, spotify: {} },
    };

    // 3. Fetch approved segments
    const segmentRows = db.prepare(
      "SELECT * FROM segments WHERE status = 'approved'"
    ).all() as SegmentRow[];

    const library: Segment[] = segmentRows.map((r) => ({
      segment_id: r.segment_id,
      type: r.type as Segment['type'],
      genre_tags: JSON.parse(r.genre_tags || '[]'),
      mood_tags: JSON.parse(r.mood_tags || '[]'),
      artist_refs: JSON.parse(r.artist_refs || '[]'),
      energy_level: r.energy_level,
      duration_ms: r.duration_ms,
      quality_score: r.quality_score,
      exaggeration_level: r.exaggeration_level,
      usage_count: r.usage_count,
      audio_url: r.audio_url ?? '',
      script_text: r.script_text,
      created_at: r.created_at,
    }));

    // 4. Run assembly
    const timeOfDay = typeof req.body?.timeOfDay === 'string' && req.body.timeOfDay.trim()
      ? req.body.timeOfDay.trim()
      : 'evening';
    const rawSeed = req.body?.seed;
    const seed = typeof rawSeed === 'number' && Number.isFinite(rawSeed) ? rawSeed : Date.now();

    const entries = await selectSegments(station, library, {
      timeOfDay,
      variationSeed: seed,
      llmProvider: new StubLLMProvider(),
      ttsProvider: new StubTTSProvider(),
      allowStubs: true,
    });

    const manifest = buildManifest(station.station_id, entries);
    const validation = validateManifest(manifest);

    if (!validation.valid) {
      res.status(500).json({ error: 'Assembly produced invalid manifest', details: validation.errors });
      return;
    }

    // 5. Save timeline
    const timelineId = crypto.randomUUID();
    const historyId = crypto.randomUUID();

    db.transaction(() => {
      db.prepare(
        'INSERT INTO timelines (id, station_id, entries) VALUES (?, ?, ?)'
      ).run(timelineId, station.station_id, JSON.stringify(manifest.entries));

      db.prepare(
        'INSERT INTO timeline_history (id, timeline_id, station_id) VALUES (?, ?, ?)'
      ).run(historyId, timelineId, station.station_id);
    })();

    // 6. Return the saved timeline with enriched segment data
    const stats = getManifestStats(manifest);

    // Build segment lookup for enriching response
    const segmentMap = new Map(library.map((s) => [s.segment_id, s]));
    const enrichedEntries = manifest.entries.map((entry) => {
      if (entry.type === 'segment') {
        const seg = segmentMap.get(entry.segment_id);
        return {
          ...entry,
          segment_type: seg?.type ?? 'unknown',
          script_text: seg?.script_text ?? '',
        };
      }
      return entry;
    });

    res.status(201).json({
      id: timelineId,
      station_id: station.station_id,
      created_at: manifest.created_at,
      entries: enrichedEntries,
      stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Assembly failed';
    res.status(500).json({ error: message });
  }
});
