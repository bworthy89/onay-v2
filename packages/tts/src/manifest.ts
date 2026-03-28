import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Segment } from '@onay/core';
import type { BatchManifest } from './types';

export function buildManifest(
  segments: Segment[],
  voiceRef: string,
  inputFile: string,
  totalScripts: number,
): BatchManifest {
  const now = new Date();
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);

  return {
    batch_id: `BATCH-${ts}`,
    created_at: now.toISOString(),
    voice_ref: voiceRef,
    input_file: inputFile,
    total_scripts: totalScripts,
    total_clips: segments.length,
    segments,
  };
}

export function writeManifest(manifest: BatchManifest, outputDir: string): string {
  const path = join(outputDir, 'manifest.json');
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
  return path;
}
