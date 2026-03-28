import type { Segment, SegmentType } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_SEGMENT_TYPES: SegmentType[] = [
  'show_intro',
  'show_outro',
  'song_intro',
  'transition',
  'artist_shoutout',
  'genre_vibe',
  'fun_fact',
  'hot_take',
  'time_of_day',
  'ad_lib',
  'seasonal',
];

export function validateSegment(segment: Partial<Segment>): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!segment.segment_id) errors.push('segment_id is required');
  if (!segment.type) errors.push('type is required');
  if (!segment.genre_tags || segment.genre_tags.length === 0) errors.push('genre_tags is required');
  if (!segment.mood_tags || segment.mood_tags.length === 0) errors.push('mood_tags is required');
  if (segment.duration_ms === undefined || segment.duration_ms === null) errors.push('duration_ms is required');
  if (!segment.audio_url) errors.push('audio_url is required');
  if (!segment.script_text) errors.push('script_text is required');

  // Type check
  if (segment.type && !VALID_SEGMENT_TYPES.includes(segment.type as SegmentType)) {
    errors.push(`Invalid segment type: ${segment.type}`);
  }

  // Range checks
  if (segment.energy_level !== undefined && (segment.energy_level < 1 || segment.energy_level > 5)) {
    errors.push('energy_level must be between 1 and 5');
  }

  if (segment.quality_score !== undefined && (segment.quality_score < 0 || segment.quality_score > 1)) {
    errors.push('quality_score must be between 0.0 and 1.0');
  }

  if (segment.duration_ms !== undefined && segment.duration_ms !== null && segment.duration_ms <= 0) {
    errors.push('duration_ms must be greater than 0');
  }

  return { valid: errors.length === 0, errors };
}
