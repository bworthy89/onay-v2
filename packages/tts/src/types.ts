import type { Segment, SegmentType } from '@onay/core';

/** A single job in the batch input file. */
export interface GenerationJob {
  script_text: string;
  type: SegmentType;
  genre_tags: string[];
  mood_tags: string[];
  artist_refs: string[];
  energy_level: number;
  takes: number;
  exaggeration_levels: number[];
}

/** Batch-level metadata written to manifest.json. */
export interface BatchManifest {
  batch_id: string;
  created_at: string;
  voice_ref: string;
  input_file: string;
  total_jobs: number;
  total_takes: number;
  segments: Segment[];
}

const VALID_SEGMENT_TYPES: ReadonlySet<string> = new Set<SegmentType>([
  'show_intro', 'show_outro', 'song_intro', 'transition',
  'artist_shoutout', 'genre_vibe', 'fun_fact', 'hot_take',
  'time_of_day', 'ad_lib', 'seasonal',
]);

export function validateJobs(data: unknown): GenerationJob[] {
  if (!Array.isArray(data)) {
    throw new Error('Input JSON must be an array of GenerationJob objects');
  }
  if (data.length === 0) {
    throw new Error('Jobs array must not be empty');
  }

  for (let i = 0; i < data.length; i++) {
    const job = data[i] as Record<string, unknown>;
    const prefix = `jobs[${i}]`;

    if (typeof job.script_text !== 'string' || job.script_text.trim().length === 0) {
      throw new Error(`${prefix}.script_text must be a non-empty string`);
    }
    if (typeof job.type !== 'string' || !VALID_SEGMENT_TYPES.has(job.type)) {
      throw new Error(`${prefix}.type must be one of: ${[...VALID_SEGMENT_TYPES].join(', ')}`);
    }
    if (!Array.isArray(job.genre_tags)) {
      throw new Error(`${prefix}.genre_tags must be an array`);
    }
    if (!Array.isArray(job.mood_tags)) {
      throw new Error(`${prefix}.mood_tags must be an array`);
    }
    if (!Array.isArray(job.artist_refs)) {
      throw new Error(`${prefix}.artist_refs must be an array`);
    }
    if (typeof job.energy_level !== 'number' || job.energy_level < 1 || job.energy_level > 5) {
      throw new Error(`${prefix}.energy_level must be a number between 1 and 5`);
    }
    if (typeof job.takes !== 'number' || !Number.isInteger(job.takes) || job.takes < 1) {
      throw new Error(`${prefix}.takes must be a positive integer`);
    }
    if (!Array.isArray(job.exaggeration_levels) || job.exaggeration_levels.length === 0) {
      throw new Error(`${prefix}.exaggeration_levels must be a non-empty array`);
    }
    for (let e = 0; e < (job.exaggeration_levels as number[]).length; e++) {
      const val = (job.exaggeration_levels as number[])[e];
      if (typeof val !== 'number' || val < 0 || val > 1) {
        throw new Error(`${prefix}.exaggeration_levels[${e}] must be a number between 0 and 1`);
      }
    }
  }

  return data as GenerationJob[];
}
