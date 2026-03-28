import { describe, it, expect } from 'vitest';
import { validateSegment } from './validation';
import type { Segment } from './types';

const validSegment: Segment = {
  segment_id: 'SEG-TR-00042',
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
  audio_url: 'https://cdn.onay.app/segments/SEG-TR-00042.wav',
  script_text: 'Smooth transition into the next track.',
};

describe('validateSegment', () => {
  it('returns valid for a complete, correct segment', () => {
    const result = validateSegment(validSegment);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  // --- Required fields ---

  it('requires segment_id', () => {
    const { segment_id, ...rest } = validSegment;
    const result = validateSegment(rest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('segment_id is required');
  });

  it('requires type', () => {
    const { type, ...rest } = validSegment;
    const result = validateSegment(rest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('type is required');
  });

  it('requires genre_tags (missing)', () => {
    const { genre_tags, ...rest } = validSegment;
    const result = validateSegment(rest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('genre_tags is required');
  });

  it('requires genre_tags (empty array)', () => {
    const result = validateSegment({ ...validSegment, genre_tags: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('genre_tags is required');
  });

  it('requires mood_tags (missing)', () => {
    const { mood_tags, ...rest } = validSegment;
    const result = validateSegment(rest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('mood_tags is required');
  });

  it('requires mood_tags (empty array)', () => {
    const result = validateSegment({ ...validSegment, mood_tags: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('mood_tags is required');
  });

  it('requires duration_ms', () => {
    const { duration_ms, ...rest } = validSegment;
    const result = validateSegment(rest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('duration_ms is required');
  });

  it('requires audio_url', () => {
    const { audio_url, ...rest } = validSegment;
    const result = validateSegment(rest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('audio_url is required');
  });

  it('requires script_text', () => {
    const { script_text, ...rest } = validSegment;
    const result = validateSegment(rest);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('script_text is required');
  });

  // --- Range checks ---

  it('rejects energy_level below 1', () => {
    const result = validateSegment({ ...validSegment, energy_level: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('energy_level must be between 1 and 5');
  });

  it('rejects energy_level above 5', () => {
    const result = validateSegment({ ...validSegment, energy_level: 6 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('energy_level must be between 1 and 5');
  });

  it('accepts energy_level at boundaries (1 and 5)', () => {
    expect(validateSegment({ ...validSegment, energy_level: 1 }).valid).toBe(true);
    expect(validateSegment({ ...validSegment, energy_level: 5 }).valid).toBe(true);
  });

  it('rejects quality_score below 0', () => {
    const result = validateSegment({ ...validSegment, quality_score: -0.1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('quality_score must be between 0.0 and 1.0');
  });

  it('rejects quality_score above 1', () => {
    const result = validateSegment({ ...validSegment, quality_score: 1.1 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('quality_score must be between 0.0 and 1.0');
  });

  it('accepts quality_score at boundaries (0 and 1)', () => {
    expect(validateSegment({ ...validSegment, quality_score: 0 }).valid).toBe(true);
    expect(validateSegment({ ...validSegment, quality_score: 1 }).valid).toBe(true);
  });

  it('rejects duration_ms of 0', () => {
    const result = validateSegment({ ...validSegment, duration_ms: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('duration_ms must be greater than 0');
  });

  it('rejects negative duration_ms', () => {
    const result = validateSegment({ ...validSegment, duration_ms: -100 });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('duration_ms must be greater than 0');
  });

  // --- Type validation ---

  it('rejects invalid segment type', () => {
    const result = validateSegment({ ...validSegment, type: 'invalid_type' as any });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid segment type: invalid_type');
  });

  it('accepts all valid segment types', () => {
    const types = [
      'show_intro', 'show_outro', 'song_intro', 'transition',
      'artist_shoutout', 'genre_vibe', 'fun_fact', 'hot_take',
      'time_of_day', 'ad_lib', 'seasonal',
    ] as const;
    for (const type of types) {
      const result = validateSegment({ ...validSegment, type });
      expect(result.valid).toBe(true);
    }
  });

  // --- Edge cases ---

  it('returns all errors for empty input', () => {
    const result = validateSegment({});
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(7);
  });

  it('collects multiple errors at once', () => {
    const result = validateSegment({
      segment_id: 'SEG-TR-00001',
      type: 'transition',
      genre_tags: ['hip-hop'],
      mood_tags: ['chill'],
      duration_ms: -5,
      audio_url: 'https://example.com/audio.wav',
      script_text: 'Test',
      energy_level: 10,
      quality_score: 2.0,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('energy_level must be between 1 and 5');
    expect(result.errors).toContain('quality_score must be between 0.0 and 1.0');
    expect(result.errors).toContain('duration_ms must be greater than 0');
  });

  it('treats empty string segment_id as missing', () => {
    const result = validateSegment({ ...validSegment, segment_id: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('segment_id is required');
  });

  it('treats empty string audio_url as missing', () => {
    const result = validateSegment({ ...validSegment, audio_url: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('audio_url is required');
  });

  it('treats empty string script_text as missing', () => {
    const result = validateSegment({ ...validSegment, script_text: '' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('script_text is required');
  });
});
