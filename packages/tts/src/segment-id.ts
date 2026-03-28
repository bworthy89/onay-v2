import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BatchManifest } from './types';

/**
 * Generates sequential segment IDs in the format SEG-XXXXX-TN
 * where XXXXX is a zero-padded script counter and N is the take number.
 *
 * If an existing manifest is found in the output directory, the counter
 * starts after the highest existing ID to avoid collisions.
 */
export function createIdGenerator(outputDir: string) {
  let counter = findHighestExistingId(outputDir);

  return {
    /** Advance to the next script and return its base number. */
    nextScript(): number {
      counter++;
      return counter;
    },

    /** Format a full segment ID for a given script number and take. */
    formatId(scriptNum: number, takeNum: number): string {
      const padded = String(scriptNum).padStart(5, '0');
      return `SEG-${padded}-T${takeNum}`;
    },
  };
}

function findHighestExistingId(outputDir: string): number {
  try {
    const raw = readFileSync(join(outputDir, 'manifest.json'), 'utf-8');
    const manifest: BatchManifest = JSON.parse(raw);
    let max = 0;
    for (const seg of manifest.segments) {
      const match = seg.segment_id.match(/^SEG-(\d+)-T\d+$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return max;
  } catch {
    return 0;
  }
}
