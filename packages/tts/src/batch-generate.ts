#!/usr/bin/env tsx
/**
 * Segment Studio — Batch Generation Script
 *
 * Reads a JSON file of segment scripts and generates audio files
 * (via Chatterbox TTS) with full segment metadata.
 *
 * Usage:
 *   npx tsx packages/tts/src/batch-generate.ts \
 *     --input scripts.json \
 *     --output ./output \
 *     --voice-ref ./onay-ref.wav
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import type { Segment } from '@onay/core';
import { validateBatchInput, DEFAULT_TAKES } from './types';
import { createIdGenerator } from './segment-id';
import { synthesize } from './chatterbox';
import { buildManifest, writeManifest } from './manifest';

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  input: string;
  output: string;
  voiceRef: string;
}

function parseArgs(argv: string[]): CliArgs {
  let input = '';
  let output = '';
  let voiceRef = '';

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--input':
        input = argv[++i] ?? '';
        break;
      case '--output':
        output = argv[++i] ?? '';
        break;
      case '--voice-ref':
        voiceRef = argv[++i] ?? '';
        break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        process.exit(1);
    }
  }

  if (!input) { console.error('Missing --input'); process.exit(1); }
  if (!output) { console.error('Missing --output'); process.exit(1); }
  if (!voiceRef) { console.error('Missing --voice-ref'); process.exit(1); }

  return {
    input: resolve(input),
    output: resolve(output),
    voiceRef: resolve(voiceRef),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  // Read and validate input
  console.log(`Reading input from ${args.input}`);
  const raw = readFileSync(args.input, 'utf-8');
  const batch = validateBatchInput(JSON.parse(raw));
  console.log(`Found ${batch.scripts.length} script(s)\n`);

  // Prepare output directory
  mkdirSync(args.output, { recursive: true });

  const idGen = createIdGenerator(args.output);
  const allSegments: Segment[] = [];
  const now = new Date().toISOString();

  for (let si = 0; si < batch.scripts.length; si++) {
    const script = batch.scripts[si];
    const takes = script.takes ?? DEFAULT_TAKES;
    const scriptNum = idGen.nextScript();

    console.log(`[${si + 1}/${batch.scripts.length}] "${script.text.slice(0, 60)}${script.text.length > 60 ? '...' : ''}"`);
    console.log(`  type=${script.type}  energy=${script.energy_level}  takes=${takes.length}`);

    for (let ti = 0; ti < takes.length; ti++) {
      const take = takes[ti];
      const takeNum = ti + 1;
      const segmentId = idGen.formatId(scriptNum, takeNum);

      // Create clip directory
      const clipDir = resolve(args.output, segmentId);
      mkdirSync(clipDir, { recursive: true });

      const audioPath = resolve(clipDir, 'audio.wav');

      // Synthesize
      const result = await synthesize({
        text: script.text,
        voice_ref: args.voiceRef,
        exaggeration: take.exaggeration,
        output_path: audioPath,
      });

      // Build segment metadata
      const segment: Segment = {
        segment_id: segmentId,
        type: script.type,
        genre_tags: script.genre_tags,
        mood_tags: script.mood_tags,
        artist_refs: script.artist_refs ?? [],
        energy_level: script.energy_level,
        duration_ms: result.duration_ms,
        quality_score: 0.0,
        exaggeration_level: take.exaggeration,
        created_at: now,
        usage_count: 0,
        audio_url: '',
        script_text: script.text,
      };

      // Write per-clip metadata
      writeFileSync(
        resolve(clipDir, 'metadata.json'),
        JSON.stringify(segment, null, 2) + '\n',
      );

      allSegments.push(segment);
    }

    console.log('');
  }

  // Write manifest
  const manifest = buildManifest(
    allSegments,
    args.voiceRef,
    basename(args.input),
    batch.scripts.length,
  );
  const manifestPath = writeManifest(manifest, args.output);

  console.log('---');
  console.log(`Generated ${allSegments.length} clip(s) from ${batch.scripts.length} script(s)`);
  console.log(`Manifest written to ${manifestPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
