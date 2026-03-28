import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import type { Segment } from '@onay/core';
import { generateSegmentId } from '@onay/core';
import type { ChatterboxEngine } from './chatterbox';
import type { GenerationJob, BatchManifest } from './types';
import { validateJobs } from './types';

export interface BatchOptions {
  inputPath: string;
  outputDir: string;
  refWav: string;
  engine: ChatterboxEngine;
}

export interface BatchResult {
  jobsProcessed: number;
  takesGenerated: number;
  errors: BatchError[];
  manifestPath: string;
}

export interface BatchError {
  jobIndex: number;
  takeIndex: number;
  error: string;
}

export async function runBatch(options: BatchOptions): Promise<BatchResult> {
  const { inputPath, outputDir, refWav, engine } = options;

  // Read and validate input
  const raw = readFileSync(inputPath, 'utf-8');
  const jobs = validateJobs(JSON.parse(raw));

  // Prepare output directory
  mkdirSync(outputDir, { recursive: true });

  const allSegments: Segment[] = [];
  const errors: BatchError[] = [];
  const now = new Date().toISOString();
  let takesGenerated = 0;

  for (let ji = 0; ji < jobs.length; ji++) {
    const job = jobs[ji];

    console.log(
      `[${ji + 1}/${jobs.length}] "${job.script_text.slice(0, 60)}${job.script_text.length > 60 ? '...' : ''}"`,
    );
    console.log(`  type=${job.type}  energy=${job.energy_level}  takes=${job.takes}  exaggeration_levels=${job.exaggeration_levels.length}`);

    let takeCounter = 0;

    for (const exaggeration of job.exaggeration_levels) {
      for (let t = 0; t < job.takes; t++) {
        takeCounter++;
        const segmentId = generateSegmentId(job.type);
        const segDir = resolve(outputDir, segmentId);
        mkdirSync(segDir, { recursive: true });

        const audioPath = resolve(segDir, `take-${takeCounter}.wav`);

        try {
          const audioBuffer = await engine.generateAudio(job.script_text, refWav, exaggeration);
          writeFileSync(audioPath, audioBuffer);

          // Estimate duration from WAV buffer: read data chunk size from header
          const durationMs = estimateDurationFromWav(audioBuffer);

          const segment: Segment = {
            segment_id: segmentId,
            type: job.type,
            genre_tags: job.genre_tags,
            mood_tags: job.mood_tags,
            artist_refs: job.artist_refs,
            energy_level: job.energy_level,
            duration_ms: durationMs,
            quality_score: 0,
            exaggeration_level: exaggeration,
            created_at: now,
            usage_count: 0,
            audio_url: audioPath,
            script_text: job.script_text,
          };

          allSegments.push(segment);
          takesGenerated++;
        } catch (err) {
          errors.push({
            jobIndex: ji,
            takeIndex: takeCounter,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    console.log('');
  }

  // Write manifest
  const manifest = buildManifest(allSegments, refWav, basename(inputPath), jobs.length);
  const manifestPath = resolve(outputDir, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  return {
    jobsProcessed: jobs.length,
    takesGenerated,
    errors,
    manifestPath,
  };
}

function estimateDurationFromWav(buffer: Buffer): number {
  if (buffer.length < 44) return 0;

  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  const numChannels = buffer.readUInt16LE(22);
  const dataSize = buffer.readUInt32LE(40);

  const bytesPerSample = bitsPerSample / 8;
  const numSamples = dataSize / (numChannels * bytesPerSample);

  return Math.round((numSamples / sampleRate) * 1000);
}

function buildManifest(
  segments: Segment[],
  voiceRef: string,
  inputFile: string,
  totalJobs: number,
): BatchManifest {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);

  return {
    batch_id: `BATCH-${ts}`,
    created_at: now.toISOString(),
    voice_ref: voiceRef,
    input_file: inputFile,
    total_jobs: totalJobs,
    total_takes: segments.length,
    segments,
  };
}
