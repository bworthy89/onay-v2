import type { TimelineEntry, TimelineManifest } from '@onay/core';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ManifestStats {
  total_duration_ms: number;
  song_count: number;
  segment_count: number;
  segment_ratio: number;
}

// ---------------------------------------------------------------------------
// buildManifest
// ---------------------------------------------------------------------------

export function buildManifest(
  stationId: string,
  entries: TimelineEntry[],
): TimelineManifest {
  return {
    station_id: stationId,
    created_at: new Date().toISOString(),
    entries,
  };
}

// ---------------------------------------------------------------------------
// validateManifest
// ---------------------------------------------------------------------------

export function validateManifest(manifest: TimelineManifest): ValidationResult {
  const errors: string[] = [];

  // 1. Non-empty entries
  if (manifest.entries.length === 0) {
    errors.push('Manifest has no entries');
    return { valid: false, errors };
  }

  // 2. First entry should be a segment (show_intro)
  if (manifest.entries[0].type !== 'segment') {
    errors.push('First entry must be a segment (expected show_intro)');
  }

  // 2b. Last entry should be a segment (show_outro)
  if (manifest.entries[manifest.entries.length - 1].type !== 'segment') {
    errors.push('Last entry must be a segment (expected show_outro)');
  }

  // 3. No two consecutive segments (except first entry and last entry)
  for (let i = 1; i < manifest.entries.length; i++) {
    if (
      manifest.entries[i].type === 'segment' &&
      manifest.entries[i - 1].type === 'segment'
    ) {
      // Allow: first entry (intro) followed by... actually intro is index 0,
      // so i=1 being a segment after index 0 segment is consecutive at the start.
      // Allow the first pair (intro can be followed by a song, but if both 0 and 1
      // are segments that's a problem unless index 0 is the intro start).
      // Per option A: allow first entry and last entry to be segments,
      // but no consecutive segments in the middle.
      const isStartPair = i === 1;
      const isEndPair = i === manifest.entries.length - 1;
      if (!isStartPair && !isEndPair) {
        errors.push(
          `Consecutive segments at positions ${i - 1} and ${i}`,
        );
      }
    }
  }

  // 4. All segment entries must have a non-empty audio_url
  for (let i = 0; i < manifest.entries.length; i++) {
    const entry = manifest.entries[i];
    if (entry.type === 'segment' && !entry.audio_url) {
      errors.push(`Segment at position ${i} has no audio_url`);
    }
  }

  // 5. All song entries must have canonical_id, artist, and title
  for (let i = 0; i < manifest.entries.length; i++) {
    const entry = manifest.entries[i];
    if (entry.type === 'song') {
      if (!entry.canonical_id) {
        errors.push(`Song at position ${i} has no canonical_id`);
      }
      if (!entry.artist) {
        errors.push(`Song at position ${i} has no artist`);
      }
      if (!entry.title) {
        errors.push(`Song at position ${i} has no title`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// getManifestStats
// ---------------------------------------------------------------------------

export function getManifestStats(manifest: TimelineManifest): ManifestStats {
  let total_duration_ms = 0;
  let song_count = 0;
  let segment_count = 0;

  for (const entry of manifest.entries) {
    total_duration_ms += entry.duration_ms;
    if (entry.type === 'song') song_count++;
    else segment_count++;
  }

  const transitions = song_count - 1;
  const segment_ratio = transitions > 0 ? segment_count / transitions : 0;

  return {
    total_duration_ms,
    song_count,
    segment_count,
    segment_ratio,
  };
}
