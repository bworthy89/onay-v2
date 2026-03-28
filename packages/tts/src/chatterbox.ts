import { writeFileSync } from 'node:fs';
import type { SynthesisResult } from './types';

export interface ChatterboxOptions {
  text: string;
  voice_ref: string;
  exaggeration: number;
  output_path: string;
}

/**
 * Synthesize speech using Chatterbox TTS.
 *
 * STUB: Logs what it would generate and writes a 0-byte .wav placeholder.
 * Replace the body of this function with real Chatterbox inference.
 *
 * Real implementation should:
 *   1. Load the Chatterbox model (full 0.5B for production, turbo 350M for preview)
 *   2. Load voice_ref as the cloning reference
 *   3. Generate audio with the given exaggeration level
 *   4. Write the .wav to output_path
 *   5. Return the actual duration in milliseconds
 */
export async function synthesize(options: ChatterboxOptions): Promise<SynthesisResult> {
  const { text, voice_ref, exaggeration, output_path } = options;

  console.log(
    `  [chatterbox-stub] Would synthesize:\n` +
    `    text:          "${text.length > 80 ? text.slice(0, 77) + '...' : text}"\n` +
    `    voice_ref:     ${voice_ref}\n` +
    `    exaggeration:  ${exaggeration}\n` +
    `    output:        ${output_path}`
  );

  // Write a 0-byte placeholder WAV
  writeFileSync(output_path, Buffer.alloc(0));

  // Estimate duration: ~150ms per word is a rough spoken-word average
  const wordCount = text.split(/\s+/).length;
  const estimatedMs = wordCount * 150;

  return {
    audio_path: output_path,
    duration_ms: estimatedMs,
  };
}
