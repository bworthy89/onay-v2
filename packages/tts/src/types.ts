import type { Segment, SegmentType } from '@onay/core';

/** Configuration for a single TTS take. */
export interface TakeConfig {
  exaggeration: number;
}

/** A single script entry in the batch input file. */
export interface ScriptEntry {
  text: string;
  type: SegmentType;
  genre_tags: string[];
  mood_tags: string[];
  artist_refs?: string[];
  energy_level: number;
  takes?: TakeConfig[];
}

/** Top-level structure of the batch input JSON file. */
export interface BatchInput {
  scripts: ScriptEntry[];
}

/** Result from a single Chatterbox synthesis call. */
export interface SynthesisResult {
  audio_path: string;
  duration_ms: number;
}

/** Batch-level metadata written to manifest.json. */
export interface BatchManifest {
  batch_id: string;
  created_at: string;
  voice_ref: string;
  input_file: string;
  total_scripts: number;
  total_clips: number;
  segments: Segment[];
}

/** Default takes when none are specified on a script entry. */
export const DEFAULT_TAKES: TakeConfig[] = [
  { exaggeration: 0.3 },
  { exaggeration: 0.5 },
  { exaggeration: 0.7 },
];

const VALID_SEGMENT_TYPES: ReadonlySet<string> = new Set<SegmentType>([
  'show_intro', 'show_outro', 'song_intro', 'transition',
  'artist_shoutout', 'genre_vibe', 'fun_fact', 'hot_take',
  'time_of_day', 'ad_lib', 'seasonal',
]);

export function validateBatchInput(data: unknown): BatchInput {
  if (typeof data !== 'object' || data === null || !('scripts' in data)) {
    throw new Error('Input JSON must have a "scripts" array');
  }

  const { scripts } = data as { scripts: unknown };
  if (!Array.isArray(scripts) || scripts.length === 0) {
    throw new Error('"scripts" must be a non-empty array');
  }

  for (let i = 0; i < scripts.length; i++) {
    const s = scripts[i] as Record<string, unknown>;
    const prefix = `scripts[${i}]`;

    if (typeof s.text !== 'string' || s.text.trim().length === 0) {
      throw new Error(`${prefix}.text must be a non-empty string`);
    }
    if (typeof s.type !== 'string' || !VALID_SEGMENT_TYPES.has(s.type)) {
      throw new Error(`${prefix}.type must be one of: ${[...VALID_SEGMENT_TYPES].join(', ')}`);
    }
    if (!Array.isArray(s.genre_tags)) {
      throw new Error(`${prefix}.genre_tags must be an array`);
    }
    if (!Array.isArray(s.mood_tags)) {
      throw new Error(`${prefix}.mood_tags must be an array`);
    }
    if (typeof s.energy_level !== 'number' || s.energy_level < 1 || s.energy_level > 5) {
      throw new Error(`${prefix}.energy_level must be a number between 1 and 5`);
    }

    if (s.takes !== undefined) {
      if (!Array.isArray(s.takes) || s.takes.length === 0) {
        throw new Error(`${prefix}.takes must be a non-empty array if provided`);
      }
      for (let t = 0; t < (s.takes as unknown[]).length; t++) {
        const take = (s.takes as Record<string, unknown>[])[t];
        if (typeof take.exaggeration !== 'number' || take.exaggeration < 0 || take.exaggeration > 1) {
          throw new Error(`${prefix}.takes[${t}].exaggeration must be a number between 0 and 1`);
        }
      }
    }
  }

  return data as BatchInput;
}
