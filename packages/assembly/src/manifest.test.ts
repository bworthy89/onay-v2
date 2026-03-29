import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TimelineEntry, TimelineManifest } from '@onay/core';
import { buildManifest, validateManifest, getManifestStats } from './manifest';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSongEntry(overrides?: Partial<Extract<TimelineEntry, { type: 'song' }>>): TimelineEntry {
  return {
    type: 'song',
    canonical_id: 'sza-kill-bill',
    artist: 'SZA',
    title: 'Kill Bill',
    duration_ms: 210000,
    ...overrides,
  };
}

function makeSegmentEntry(overrides?: Partial<Extract<TimelineEntry, { type: 'segment' }>>): TimelineEntry {
  return {
    type: 'segment',
    segment_id: 'SEG-TR-00001',
    audio_url: 'https://cdn.onay.fm/segments/SEG-TR-00001.wav',
    duration_ms: 6000,
    ...overrides,
  };
}

/** A well-formed timeline: intro, song, segment, song, song, segment, song, outro */
function makeValidEntries(): TimelineEntry[] {
  return [
    makeSegmentEntry({ segment_id: 'SEG-SI-00001', duration_ms: 10000 }),
    makeSongEntry({ canonical_id: 'sza-kill-bill', artist: 'SZA', title: 'Kill Bill' }),
    makeSegmentEntry({ segment_id: 'SEG-TR-00001', duration_ms: 5000 }),
    makeSongEntry({ canonical_id: 'frank-ocean-nights', artist: 'Frank Ocean', title: 'Nights' }),
    makeSongEntry({ canonical_id: 'tyler-earfquake', artist: 'Tyler, the Creator', title: 'EARFQUAKE' }),
    makeSegmentEntry({ segment_id: 'SEG-TR-00002', duration_ms: 5000 }),
    makeSongEntry({ canonical_id: 'kendrick-humble', artist: 'Kendrick Lamar', title: 'HUMBLE.' }),
    makeSegmentEntry({ segment_id: 'SEG-SO-00001', duration_ms: 9000 }),
  ];
}

function makeValidManifest(): TimelineManifest {
  return {
    station_id: 'station-001',
    created_at: '2026-03-29T12:00:00.000Z',
    entries: makeValidEntries(),
  };
}

// ---------------------------------------------------------------------------
// buildManifest
// ---------------------------------------------------------------------------

describe('buildManifest', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('wraps entries with station_id and created_at', () => {
    const entries = makeValidEntries();
    const manifest = buildManifest('station-001', entries);

    expect(manifest.station_id).toBe('station-001');
    expect(manifest.created_at).toBe('2026-03-29T12:00:00.000Z');
    expect(manifest.entries).toBe(entries);
  });

  it('creates a valid TimelineManifest shape', () => {
    const manifest = buildManifest('station-002', []);

    expect(manifest).toHaveProperty('station_id');
    expect(manifest).toHaveProperty('created_at');
    expect(manifest).toHaveProperty('entries');
  });

  it('uses the current timestamp for created_at', () => {
    vi.setSystemTime(new Date('2026-06-15T08:30:00.000Z'));
    const manifest = buildManifest('station-001', []);
    expect(manifest.created_at).toBe('2026-06-15T08:30:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// validateManifest
// ---------------------------------------------------------------------------

describe('validateManifest', () => {
  it('returns valid for a well-formed manifest', () => {
    const result = validateManifest(makeValidManifest());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects an empty entries array', () => {
    const manifest = makeValidManifest();
    manifest.entries = [];
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Manifest has no entries');
  });

  it('rejects when first entry is not a segment', () => {
    const manifest = makeValidManifest();
    manifest.entries[0] = makeSongEntry();
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('First entry must be a segment (expected show_intro)');
  });

  it('rejects when last entry is not a segment', () => {
    const manifest = makeValidManifest();
    manifest.entries[manifest.entries.length - 1] = makeSongEntry({ canonical_id: 'last', artist: 'Last', title: 'Last' });
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Last entry must be a segment (expected show_outro)');
  });

  describe('consecutive segments', () => {
    it('allows segment at start followed by another segment (intro pair)', () => {
      const manifest = makeValidManifest();
      // Insert a second segment right after the intro (position 1)
      manifest.entries.splice(1, 0, makeSegmentEntry({ segment_id: 'SEG-EXTRA-01' }));
      const result = validateManifest(manifest);
      // The start pair (positions 0,1) is allowed
      expect(result.errors.filter((e) => e.includes('Consecutive segments'))).toHaveLength(0);
    });

    it('allows segment at end preceded by another segment (outro pair)', () => {
      const manifest = makeValidManifest();
      // Insert a segment just before the last entry
      const lastIdx = manifest.entries.length - 1;
      manifest.entries.splice(lastIdx, 0, makeSegmentEntry({ segment_id: 'SEG-EXTRA-02' }));
      const result = validateManifest(manifest);
      expect(result.errors.filter((e) => e.includes('Consecutive segments'))).toHaveLength(0);
    });

    it('rejects consecutive segments in the middle', () => {
      const manifest = makeValidManifest();
      // Replace song at position 3 with a segment to create consecutive segments at 2,3
      manifest.entries = [
        makeSegmentEntry({ segment_id: 'SEG-SI-00001' }),  // 0: intro
        makeSongEntry(),                                      // 1: song
        makeSegmentEntry({ segment_id: 'SEG-TR-00001' }),  // 2: segment
        makeSegmentEntry({ segment_id: 'SEG-TR-00002' }),  // 3: segment (consecutive!)
        makeSongEntry({ canonical_id: 'b', artist: 'B', title: 'B' }),  // 4: song
        makeSegmentEntry({ segment_id: 'SEG-SO-00001' }),  // 5: outro
      ];
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Consecutive segments at positions 2 and 3'))).toBe(true);
    });
  });

  describe('segment audio_url validation', () => {
    it('rejects a segment with empty audio_url', () => {
      const manifest = makeValidManifest();
      manifest.entries[0] = makeSegmentEntry({ segment_id: 'SEG-SI-00001', audio_url: '' });
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Segment at position 0 has no audio_url');
    });

    it('catches multiple segments with missing audio_url', () => {
      const manifest = makeValidManifest();
      manifest.entries[0] = makeSegmentEntry({ segment_id: 'SEG-SI-00001', audio_url: '' });
      manifest.entries[2] = makeSegmentEntry({ segment_id: 'SEG-TR-00001', audio_url: '' });
      const result = validateManifest(manifest);
      expect(result.errors.filter((e) => e.includes('no audio_url'))).toHaveLength(2);
    });
  });

  describe('song field validation', () => {
    it('rejects a song with empty canonical_id', () => {
      const manifest = makeValidManifest();
      manifest.entries[1] = makeSongEntry({ canonical_id: '' });
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Song at position 1 has no canonical_id');
    });

    it('rejects a song with empty artist', () => {
      const manifest = makeValidManifest();
      manifest.entries[1] = makeSongEntry({ artist: '' });
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Song at position 1 has no artist');
    });

    it('rejects a song with empty title', () => {
      const manifest = makeValidManifest();
      manifest.entries[1] = makeSongEntry({ title: '' });
      const result = validateManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Song at position 1 has no title');
    });

    it('reports all missing fields on a single song', () => {
      const manifest = makeValidManifest();
      manifest.entries[1] = makeSongEntry({ canonical_id: '', artist: '', title: '' });
      const result = validateManifest(manifest);
      expect(result.errors.filter((e) => e.includes('position 1'))).toHaveLength(3);
    });
  });

  it('collects multiple errors at once', () => {
    const manifest: TimelineManifest = {
      station_id: 'station-001',
      created_at: '2026-03-29T12:00:00.000Z',
      entries: [
        makeSongEntry({ canonical_id: '', artist: '', title: '' }), // not a segment + missing fields
        makeSegmentEntry({ audio_url: '' }),                         // missing audio_url
      ],
    };
    const result = validateManifest(manifest);
    expect(result.valid).toBe(false);
    // First entry not segment + 3 missing song fields + 1 missing audio_url
    expect(result.errors.length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// getManifestStats
// ---------------------------------------------------------------------------

describe('getManifestStats', () => {
  it('computes correct stats for a valid manifest', () => {
    const manifest = makeValidManifest();
    const stats = getManifestStats(manifest);

    expect(stats.song_count).toBe(4);
    expect(stats.segment_count).toBe(4);
    // 4 songs × 210000 + 10000 + 5000 + 5000 + 9000 = 840000 + 29000 = 869000
    expect(stats.total_duration_ms).toBe(869000);
    // segment_ratio = 4 / (4-1) = 4/3 ≈ 1.333
    expect(stats.segment_ratio).toBeCloseTo(4 / 3);
  });

  it('returns zero segment_ratio for a single song', () => {
    const manifest: TimelineManifest = {
      station_id: 'station-001',
      created_at: '2026-03-29T12:00:00.000Z',
      entries: [
        makeSegmentEntry({ duration_ms: 10000 }),
        makeSongEntry({ duration_ms: 200000 }),
        makeSegmentEntry({ duration_ms: 9000 }),
      ],
    };
    const stats = getManifestStats(manifest);
    expect(stats.song_count).toBe(1);
    expect(stats.segment_count).toBe(2);
    // transitions = 1 - 1 = 0, so ratio = 0
    expect(stats.segment_ratio).toBe(0);
  });

  it('returns zero counts for an empty manifest', () => {
    const manifest: TimelineManifest = {
      station_id: 'station-001',
      created_at: '2026-03-29T12:00:00.000Z',
      entries: [],
    };
    const stats = getManifestStats(manifest);
    expect(stats.total_duration_ms).toBe(0);
    expect(stats.song_count).toBe(0);
    expect(stats.segment_count).toBe(0);
    expect(stats.segment_ratio).toBe(0);
  });

  it('handles a songs-only manifest (no segments)', () => {
    const manifest: TimelineManifest = {
      station_id: 'station-001',
      created_at: '2026-03-29T12:00:00.000Z',
      entries: [
        makeSongEntry({ duration_ms: 200000 }),
        makeSongEntry({ canonical_id: 'b', artist: 'B', title: 'B', duration_ms: 180000 }),
        makeSongEntry({ canonical_id: 'c', artist: 'C', title: 'C', duration_ms: 220000 }),
      ],
    };
    const stats = getManifestStats(manifest);
    expect(stats.song_count).toBe(3);
    expect(stats.segment_count).toBe(0);
    expect(stats.segment_ratio).toBe(0);
    expect(stats.total_duration_ms).toBe(600000);
  });

  it('includes segment durations in total', () => {
    const manifest: TimelineManifest = {
      station_id: 'station-001',
      created_at: '2026-03-29T12:00:00.000Z',
      entries: [
        makeSegmentEntry({ duration_ms: 5000 }),
        makeSongEntry({ duration_ms: 100000 }),
        makeSegmentEntry({ duration_ms: 3000 }),
      ],
    };
    const stats = getManifestStats(manifest);
    expect(stats.total_duration_ms).toBe(108000);
  });
});
