-- 001-initial-schema.sql
-- Core tables for ONAY: stations, tracks, segments, timelines

-- Stations
CREATE TABLE stations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  genre_tags  TEXT,  -- JSON array
  mood_tags   TEXT,  -- JSON array
  cover_art_url TEXT,
  rotation_schedule TEXT,  -- JSON object
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Station tracks (normalized from Station.tracklist + provider_availability)
CREATE TABLE station_tracks (
  id            TEXT PRIMARY KEY,
  station_id    TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  canonical_id  TEXT NOT NULL,
  artist        TEXT NOT NULL,
  title         TEXT NOT NULL,
  isrc          TEXT,
  duration_ms   INTEGER NOT NULL,
  apple_music_id TEXT,
  spotify_id    TEXT
);

-- Segments (Onay voice library)
CREATE TABLE segments (
  segment_id        TEXT PRIMARY KEY,
  type              TEXT NOT NULL,
  genre_tags        TEXT,  -- JSON array
  mood_tags         TEXT,  -- JSON array
  artist_refs       TEXT,  -- JSON array
  energy_level      INTEGER NOT NULL,
  duration_ms       INTEGER NOT NULL,
  quality_score     REAL NOT NULL DEFAULT 0,
  exaggeration_level REAL NOT NULL DEFAULT 0,
  usage_count       INTEGER NOT NULL DEFAULT 0,
  audio_url         TEXT,
  script_text       TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Assembled show timelines
CREATE TABLE timelines (
  id          TEXT PRIMARY KEY,
  station_id  TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  entries     TEXT NOT NULL,  -- JSON array of TimelineEntry
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Published timeline history
CREATE TABLE timeline_history (
  id           TEXT PRIMARY KEY,
  timeline_id  TEXT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  station_id   TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_segments_type ON segments(type);
CREATE INDEX idx_segments_quality_score ON segments(quality_score);
CREATE INDEX idx_segments_energy_level ON segments(energy_level);
CREATE INDEX idx_station_tracks_station_position ON station_tracks(station_id, position);
CREATE INDEX idx_timelines_station_id ON timelines(station_id);
CREATE INDEX idx_timeline_history_station_id ON timeline_history(station_id);
