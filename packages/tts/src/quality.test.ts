import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scoreSegment } from './quality';

// --- WAV fixture builder ---

interface WavOptions {
  sampleRate?: number;
  bitsPerSample?: number;
  numChannels?: number;
  /** PCM samples as floats in [-1, 1]. Generated from this, or use durationMs for silence/tone. */
  samples?: number[];
  /** If no samples provided, generate a sine tone of this duration. */
  durationMs?: number;
  /** Frequency of generated tone in Hz. Default 440. */
  toneFrequency?: number;
  /** If true, generate silence instead of tone. */
  silent?: boolean;
  /** If true, write an invalid RIFF header. */
  corruptHeader?: boolean;
}

function buildTestWav(opts: WavOptions = {}): Buffer {
  const sampleRate = opts.sampleRate ?? 24000;
  const bitsPerSample = opts.bitsPerSample ?? 16;
  const numChannels = opts.numChannels ?? 1;
  const bytesPerSample = bitsPerSample / 8;

  let floatSamples: number[];

  if (opts.samples) {
    floatSamples = opts.samples;
  } else {
    const durationMs = opts.durationMs ?? 6000;
    const numSamples = Math.floor((sampleRate * durationMs) / 1000);
    const freq = opts.toneFrequency ?? 440;
    floatSamples = new Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      floatSamples[i] = opts.silent ? 0 : 0.5 * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
  }

  const dataSize = floatSamples.length * numChannels * bytesPerSample;
  const headerSize = 44;
  const buf = Buffer.alloc(headerSize + dataSize);

  // RIFF header
  buf.write(opts.corruptHeader ? 'JUNK' : 'RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);

  // fmt sub-chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(numChannels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buf.writeUInt16LE(numChannels * bytesPerSample, 32);
  buf.writeUInt16LE(bitsPerSample, 34);

  // data sub-chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  // Write PCM samples (16-bit signed)
  const maxVal = (1 << (bitsPerSample - 1)) - 1;
  for (let i = 0; i < floatSamples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, floatSamples[i]));
    const intVal = Math.round(clamped * maxVal);
    buf.writeInt16LE(intVal, headerSize + i * bytesPerSample);
  }

  return buf;
}

// --- Test setup ---

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `onay-quality-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeFixture(name: string, buf: Buffer): string {
  const p = join(tmpDir, name);
  writeFileSync(p, buf);
  return p;
}

// --- Tests ---

describe('scoreSegment — file integrity', () => {
  it('rejects a file with a corrupt WAV header', async () => {
    const path = writeFixture('bad.wav', buildTestWav({ corruptHeader: true, durationMs: 6000 }));
    const result = await scoreSegment(path, 'transition');
    expect(result.quality_score).toBe(0.0);
    expect(result.flags).toContain('invalid_audio');
  });

  it('rejects a zero-length file', async () => {
    const path = writeFixture('empty.wav', Buffer.alloc(0));
    const result = await scoreSegment(path, 'transition');
    expect(result.quality_score).toBe(0.0);
    expect(result.flags).toContain('invalid_audio');
  });

  it('rejects a file with sample rate below 24000', async () => {
    const path = writeFixture('low-sr.wav', buildTestWav({ sampleRate: 22050, durationMs: 6000 }));
    const result = await scoreSegment(path, 'transition');
    expect(result.quality_score).toBe(0.0);
    expect(result.flags).toContain('invalid_audio');
  });

  it('accepts a valid WAV at 24000 Hz', async () => {
    const path = writeFixture('ok.wav', buildTestWav({ sampleRate: 24000, durationMs: 6000 }));
    const result = await scoreSegment(path, 'transition');
    expect(result.quality_score).toBeGreaterThan(0);
    expect(result.flags).not.toContain('invalid_audio');
  });
});

describe('scoreSegment — duration check', () => {
  it('scores 1.0 for a transition within range (4000-8000ms)', async () => {
    const path = writeFixture('good-dur.wav', buildTestWav({ durationMs: 6000 }));
    const result = await scoreSegment(path, 'transition');
    expect(result.quality_score).toBe(1.0);
    expect(result.flags).toEqual([]);
  });

  it('flags duration_out_of_range for a too-short transition', async () => {
    const path = writeFixture('short.wav', buildTestWav({ durationMs: 2000 }));
    const result = await scoreSegment(path, 'transition');
    expect(result.quality_score).toBeCloseTo(0.7, 5);
    expect(result.flags).toContain('duration_out_of_range');
  });

  it('flags duration_out_of_range for a too-long ad_lib', async () => {
    // ad_lib range: 1000-3000ms, so 5000ms is too long
    const path = writeFixture('long.wav', buildTestWav({ durationMs: 5000 }));
    const result = await scoreSegment(path, 'ad_lib');
    expect(result.quality_score).toBeCloseTo(0.7, 5);
    expect(result.flags).toContain('duration_out_of_range');
  });

  it('accepts a show_intro at the boundary (8000ms)', async () => {
    const path = writeFixture('boundary.wav', buildTestWav({ durationMs: 8000 }));
    const result = await scoreSegment(path, 'show_intro');
    expect(result.flags).not.toContain('duration_out_of_range');
  });
});
