#!/usr/bin/env tsx
/**
 * Batch TTS Generation CLI
 *
 * Usage:
 *   npx tsx src/cli.ts --input jobs.json --output ./output --ref-wav ./reference.wav
 */

import { resolve } from 'node:path';
import { PlaceholderChatterboxEngine } from './chatterbox';
import { runBatch } from './batch';

interface CliArgs {
  input: string;
  output: string;
  refWav: string;
}

function parseArgs(argv: string[]): CliArgs {
  let input = '';
  let output = '';
  let refWav = '';

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--input':
        input = argv[++i] ?? '';
        break;
      case '--output':
        output = argv[++i] ?? '';
        break;
      case '--ref-wav':
        refWav = argv[++i] ?? '';
        break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        process.exit(1);
    }
  }

  if (!input) { console.error('Missing --input'); process.exit(1); }
  if (!output) { console.error('Missing --output'); process.exit(1); }
  if (!refWav) { console.error('Missing --ref-wav'); process.exit(1); }

  return {
    input: resolve(input),
    output: resolve(output),
    refWav: resolve(refWav),
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const engine = new PlaceholderChatterboxEngine();

  console.log(`Input:   ${args.input}`);
  console.log(`Output:  ${args.output}`);
  console.log(`Ref WAV: ${args.refWav}\n`);

  const result = await runBatch({
    inputPath: args.input,
    outputDir: args.output,
    refWav: args.refWav,
    engine,
  });

  console.log('---');
  console.log(`Jobs processed:  ${result.jobsProcessed}`);
  console.log(`Takes generated: ${result.takesGenerated}`);
  console.log(`Errors:          ${result.errors.length}`);
  console.log(`Manifest:        ${result.manifestPath}`);

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    for (const err of result.errors) {
      console.log(`  job[${err.jobIndex}] take ${err.takeIndex}: ${err.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
