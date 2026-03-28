import { describe, it, expect } from 'vitest';
import { generateSegmentId, filterSegments } from './utils';
import type { Segment, SegmentType } from './types';

// --- Helper ---

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    segment_id: 'SEG-TR-00001',
    type: 'transition',
    genre_tags: ['hip-hop'],
    mood_tags: ['chill'],
    artist_refs: ['SZA'],
    energy_level: 3,
    duration_ms: 5000,
    quality_score: 0.85,
    exaggeration_level: 0.5,
    created_at: '2025-01-01T00:00:00Z',
    usage_count: 0,
    audio_url: 'https://cdn.onay.app/segments/SEG-TR-00001.wav',
    script_text: 'Smooth transition into the next track.',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// generateSegmentId
// ---------------------------------------------------------------------------

describe('generateSegmentId', () => {
  const typeAbbreviations: [SegmentType, string][] = [
    ['show_intro', 'SI'],
    ['show_outro', 'SO'],
    ['song_intro', 'SN'],
    ['transition', 'TR'],
    ['artist_shoutout', 'AS'],
    ['genre_vibe', 'GV'],
    ['fun_fact', 'FF'],
    ['hot_take', 'HT'],
    ['time_of_day', 'TD'],
    ['ad_lib', 'AL'],
    ['seasonal', 'SE'],
  ];

  it.each(typeAbbreviations)(
    'generates correct format for %s (SEG-%s-NNNNN)',
    (type, abbrev) => {
      const id = generateSegmentId(type);
      const regex = new RegExp(`^SEG-${abbrev}-\\d{5}$`);
      expect(id).toMatch(regex);
    },
  );

  it('generates IDs with 5-digit numbers in range 10000-99999', () => {
    for (let i = 0; i < 50; i++) {
      const id = generateSegmentId('transition');
      const num = parseInt(id.split('-')[2], 10);
      expect(num).toBeGreaterThanOrEqual(10000);
      expect(num).toBeLessThanOrEqual(99999);
    }
  });

  it('generates unique IDs (statistical check)', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSegmentId('transition'));
    }
    // With 90,000 possible values, 100 draws should be nearly all unique
    expect(ids.size).toBeGreaterThan(90);
  });
});

// ---------------------------------------------------------------------------
// filterSegments
// ---------------------------------------------------------------------------

describe('filterSegments', () => {
  const library: Segment[] = [
    makeSegment({
      segment_id: 'SEG-TR-00001',
      type: 'transition',
      genre_tags: ['hip-hop', 'r&b'],
      mood_tags: ['chill', 'late-night'],
      artist_refs: ['SZA', 'Frank Ocean'],
      energy_level: 2,
      quality_score: 0.9,
      script_text: 'Smooth vibes coming your way.',
    }),
    makeSegment({
      segment_id: 'SEG-SI-00002',
      type: 'show_intro',
      genre_tags: ['hip-hop'],
      mood_tags: ['hype'],
      artist_refs: [],
      energy_level: 5,
      quality_score: 0.95,
      script_text: 'Welcome to the show!',
    }),
    makeSegment({
      segment_id: 'SEG-FF-00003',
      type: 'fun_fact',
      genre_tags: ['r&b'],
      mood_tags: ['chill'],
      artist_refs: ['Frank Ocean'],
      energy_level: 2,
      quality_score: 0.7,
      script_text: 'Did you know Frank Ocean recorded this in a closet?',
    }),
    makeSegment({
      segment_id: 'SEG-HT-00004',
      type: 'hot_take',
      genre_tags: ['pop'],
      mood_tags: ['energetic'],
      artist_refs: ['Beyonce'],
      energy_level: 4,
      quality_score: 0.6,
      script_text: 'Hot take: Beyonce is the greatest performer alive.',
    }),
  ];

  // --- Single filters ---

  it('filters by type', () => {
    const result = filterSegments(library, { type: 'transition' });
    expect(result).toHaveLength(1);
    expect(result[0].segment_id).toBe('SEG-TR-00001');
  });

  it('filters by genre', () => {
    const result = filterSegments(library, { genre: 'r&b' });
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.segment_id)).toEqual(['SEG-TR-00001', 'SEG-FF-00003']);
  });

  it('filters by mood', () => {
    const result = filterSegments(library, { mood: 'chill' });
    expect(result).toHaveLength(2);
  });

  it('filters by artist', () => {
    const result = filterSegments(library, { artist: 'Frank Ocean' });
    expect(result).toHaveLength(2);
  });

  it('filters by energyMin', () => {
    const result = filterSegments(library, { energyMin: 4 });
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.energy_level >= 4)).toBe(true);
  });

  it('filters by energyMax', () => {
    const result = filterSegments(library, { energyMax: 2 });
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.energy_level <= 2)).toBe(true);
  });

  it('filters by qualityMin', () => {
    const result = filterSegments(library, { qualityMin: 0.9 });
    expect(result).toHaveLength(2);
  });

  it('filters by search (case-insensitive)', () => {
    const result = filterSegments(library, { search: 'frank ocean' });
    expect(result).toHaveLength(1);
    expect(result[0].segment_id).toBe('SEG-FF-00003');
  });

  it('search is case-insensitive', () => {
    const result = filterSegments(library, { search: 'SMOOTH VIBES' });
    expect(result).toHaveLength(1);
    expect(result[0].segment_id).toBe('SEG-TR-00001');
  });

  // --- Combined filters ---

  it('combines type + genre', () => {
    const result = filterSegments(library, { type: 'transition', genre: 'hip-hop' });
    expect(result).toHaveLength(1);
    expect(result[0].segment_id).toBe('SEG-TR-00001');
  });

  it('combines energy range (min + max)', () => {
    const result = filterSegments(library, { energyMin: 2, energyMax: 4 });
    expect(result).toHaveLength(3);
  });

  it('combines genre + mood + qualityMin', () => {
    const result = filterSegments(library, { genre: 'r&b', mood: 'chill', qualityMin: 0.8 });
    expect(result).toHaveLength(1);
    expect(result[0].segment_id).toBe('SEG-TR-00001');
  });

  // --- Edge cases ---

  it('returns all segments with empty filter', () => {
    const result = filterSegments(library, {});
    expect(result).toHaveLength(library.length);
  });

  it('returns empty array for no matches', () => {
    const result = filterSegments(library, { genre: 'country' });
    expect(result).toEqual([]);
  });

  it('returns empty array for empty library', () => {
    const result = filterSegments([], { type: 'transition' });
    expect(result).toEqual([]);
  });

  it('handles search with no match', () => {
    const result = filterSegments(library, { search: 'nonexistent text' });
    expect(result).toEqual([]);
  });
});
