import { readFile } from 'node:fs/promises';
import type { SegmentType } from '@onay/core';

export interface QualityResult {
  quality_score: number;
  flags: string[];
}

/** Expected duration ranges per segment type in milliseconds [min, max]. */
const DURATION_RANGES: Record<SegmentType, [number, number]> = {
  show_intro:      [8000, 15000],
  show_outro:      [8000, 12000],
  song_intro:      [5000, 10000],
  transition:      [4000, 8000],
  artist_shoutout: [8000, 20000],
  genre_vibe:      [6000, 12000],
  fun_fact:        [8000, 15000],
  hot_take:        [6000, 15000],
  time_of_day:     [4000, 8000],
  ad_lib:          [1000, 3000],
  seasonal:        [5000, 10000],
};

interface WavInfo {
  sampleRate: number;
  numChannels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataSize: number;
}

/**
 * Parse a WAV file buffer and extract header info.
 * Returns null if the header is invalid.
 */
function parseWavHeader(buf: Buffer): WavInfo | null {
  // Minimum WAV header is 44 bytes
  if (buf.length < 44) return null;

  // Check RIFF and WAVE markers
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buf.toString('ascii', 8, 12) !== 'WAVE') return null;

  // Find fmt chunk
  if (buf.toString('ascii', 12, 16) !== 'fmt ') return null;

  const audioFormat = buf.readUInt16LE(20);
  if (audioFormat !== 1) return null; // Only PCM

  const numChannels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);

  // Find data chunk — scan from byte 36 onward
  let offset = 36;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    if (chunkId === 'data') {
      return {
        sampleRate,
        numChannels,
        bitsPerSample,
        dataOffset: offset + 8,
        dataSize: chunkSize,
      };
    }
    offset += 8 + chunkSize;
  }

  return null;
}

export async function scoreSegment(audioPath: string, segmentType: SegmentType): Promise<QualityResult> {
  let buf: Buffer;
  try {
    buf = await readFile(audioPath);
  } catch {
    return { quality_score: 0.0, flags: ['invalid_audio'] };
  }

  if (buf.length === 0) {
    return { quality_score: 0.0, flags: ['invalid_audio'] };
  }

  const wav = parseWavHeader(buf);
  if (!wav) {
    return { quality_score: 0.0, flags: ['invalid_audio'] };
  }

  if (wav.sampleRate < 24000) {
    return { quality_score: 0.0, flags: ['invalid_audio'] };
  }

  let score = 1.0;
  const flags: string[] = [];

  // Duration check
  const durationMs = (wav.dataSize / (wav.numChannels * (wav.bitsPerSample / 8))) / wav.sampleRate * 1000;
  const [minMs, maxMs] = DURATION_RANGES[segmentType];
  if (durationMs < minMs || durationMs > maxMs) {
    score -= 0.3;
    flags.push('duration_out_of_range');
  }

  // Silence detection
  const bytesPerSample = wav.bitsPerSample / 8;
  const totalSamples = Math.floor(wav.dataSize / (wav.numChannels * bytesPerSample));
  const samples = new Float64Array(totalSamples);

  for (let i = 0; i < totalSamples; i++) {
    const byteOffset = wav.dataOffset + i * wav.numChannels * bytesPerSample;
    if (byteOffset + bytesPerSample > buf.length) break;
    samples[i] = buf.readInt16LE(byteOffset);
  }

  // Find max absolute value for threshold
  let maxAbs = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > maxAbs) maxAbs = abs;
  }

  // Use 1% of max amplitude, with a minimum of 1 to handle fully silent files
  const threshold = Math.max(maxAbs * 0.01, 1.0);

  // Helper: is sample silent?
  const isSilent = (idx: number) => Math.abs(samples[idx]) < threshold;

  // Leading silence
  let leadingSamples = 0;
  while (leadingSamples < samples.length && isSilent(leadingSamples)) {
    leadingSamples++;
  }
  const leadingMs = (leadingSamples / wav.sampleRate) * 1000;
  if (leadingMs > 500) {
    score -= 0.1;
    flags.push('excessive_leading_silence');
  }

  // Trailing silence
  let trailingSamples = 0;
  let idx = samples.length - 1;
  while (idx >= 0 && isSilent(idx)) {
    trailingSamples++;
    idx--;
  }
  const trailingMs = (trailingSamples / wav.sampleRate) * 1000;
  if (trailingMs > 500) {
    score -= 0.1;
    flags.push('excessive_trailing_silence');
  }

  // Internal silence gaps
  const contentStart = leadingSamples;
  const contentEnd = samples.length - trailingSamples;
  let gapLength = 0;
  let hasInternalGap = false;

  for (let i = contentStart; i < contentEnd; i++) {
    if (isSilent(i)) {
      gapLength++;
      const gapMs = (gapLength / wav.sampleRate) * 1000;
      if (gapMs > 1000) {
        hasInternalGap = true;
        break;
      }
    } else {
      gapLength = 0;
    }
  }

  if (hasInternalGap) {
    score -= 0.2;
    flags.push('internal_silence_gap');
  }

  return { quality_score: Math.max(0.0, score), flags };
}

export async function batchScore(
  audioPaths: string[],
  types: SegmentType[],
): Promise<QualityResult[]> {
  return Promise.all(audioPaths.map((path, i) => scoreSegment(path, types[i])));
}
