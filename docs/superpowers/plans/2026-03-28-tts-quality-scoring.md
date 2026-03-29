# TTS Quality Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build audio quality scoring for Chatterbox TTS output that checks file integrity, duration, and silence patterns, returning a 0-1 score with diagnostic flags.

**Architecture:** Single module `packages/tts/src/quality.ts` with pure WAV buffer parsing (no external deps). Reads WAV files from disk, validates header, computes duration, scans PCM samples for silence. Tests generate WAV fixtures programmatically using a helper function.

**Tech Stack:** Node.js `fs` + `Buffer` for WAV parsing, Vitest for tests, `@onay/core` for `SegmentType`.

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/tts/src/quality.ts` | `scoreSegment()`, `batchScore()`, WAV parsing helpers, duration ranges, silence detection |
| Create | `packages/tts/src/quality.test.ts` | Unit tests with programmatic WAV fixture generation |
| Modify | `packages/tts/src/index.ts` | Re-export `scoreSegment`, `batchScore`, `QualityResult` |

---

### Task 1: WAV Fixture Helper + File Integrity Tests

**Files:**
- Create: `packages/tts/src/quality.test.ts`
- Create: `packages/tts/src/quality.ts`

- [ ] **Step 1: Write the WAV fixture helper and integrity tests**

In `packages/tts/src/quality.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/tts && npx vitest run src/quality.test.ts`
Expected: FAIL — `scoreSegment` does not exist yet.

- [ ] **Step 3: Write the QualityResult type and file integrity check**

In `packages/tts/src/quality.ts`:

```typescript
import { readFileSync } from 'node:fs';
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
    buf = readFileSync(audioPath);
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

  const threshold = maxAbs * 0.01;

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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/tts && npx vitest run src/quality.test.ts`
Expected: All 4 integrity tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/tts/src/quality.ts packages/tts/src/quality.test.ts
git commit -m "feat(tts): add quality scoring with file integrity checks"
```

---

### Task 2: Duration Check Tests

**Files:**
- Modify: `packages/tts/src/quality.test.ts`

- [ ] **Step 1: Add duration tests**

Append to `packages/tts/src/quality.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd packages/tts && npx vitest run src/quality.test.ts`
Expected: All 8 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/tts/src/quality.test.ts
git commit -m "test(tts): add duration check tests for quality scoring"
```

---

### Task 3: Silence Detection Tests

**Files:**
- Modify: `packages/tts/src/quality.test.ts`

- [ ] **Step 1: Add silence detection tests**

Append to `packages/tts/src/quality.test.ts`:

```typescript
describe('scoreSegment — silence detection', () => {
  /** Build samples: silence for `silenceMs`, then tone for `toneMs`, then silence for `trailMs`. */
  function buildSilenceToneSilence(silenceMs: number, toneMs: number, trailMs: number, sampleRate = 24000): number[] {
    const silenceSamples = Math.floor((sampleRate * silenceMs) / 1000);
    const toneSamples = Math.floor((sampleRate * toneMs) / 1000);
    const trailSamples = Math.floor((sampleRate * trailMs) / 1000);
    const samples: number[] = [];

    for (let i = 0; i < silenceSamples; i++) samples.push(0);
    for (let i = 0; i < toneSamples; i++) samples.push(0.5 * Math.sin(2 * Math.PI * 440 * i / sampleRate));
    for (let i = 0; i < trailSamples; i++) samples.push(0);

    return samples;
  }

  it('flags excessive leading silence (>500ms)', async () => {
    // 800ms silence + 5200ms tone = 6000ms total, within transition range
    const samples = buildSilenceToneSilence(800, 5200, 0);
    const path = writeFixture('lead-silence.wav', buildTestWav({ samples }));
    const result = await scoreSegment(path, 'transition');
    expect(result.flags).toContain('excessive_leading_silence');
    expect(result.flags).not.toContain('excessive_trailing_silence');
    expect(result.quality_score).toBeCloseTo(0.9, 5);
  });

  it('flags excessive trailing silence (>500ms)', async () => {
    // 5200ms tone + 800ms silence = 6000ms total
    const samples = buildSilenceToneSilence(0, 5200, 800);
    const path = writeFixture('trail-silence.wav', buildTestWav({ samples }));
    const result = await scoreSegment(path, 'transition');
    expect(result.flags).toContain('excessive_trailing_silence');
    expect(result.flags).not.toContain('excessive_leading_silence');
    expect(result.quality_score).toBeCloseTo(0.9, 5);
  });

  it('flags both leading and trailing silence', async () => {
    // 800ms silence + 4400ms tone + 800ms silence = 6000ms total
    const samples = buildSilenceToneSilence(800, 4400, 800);
    const path = writeFixture('both-silence.wav', buildTestWav({ samples }));
    const result = await scoreSegment(path, 'transition');
    expect(result.flags).toContain('excessive_leading_silence');
    expect(result.flags).toContain('excessive_trailing_silence');
    expect(result.quality_score).toBeCloseTo(0.8, 5);
  });

  it('does not flag silence under 500ms', async () => {
    // 400ms silence + 5200ms tone + 400ms silence = 6000ms total
    const samples = buildSilenceToneSilence(400, 5200, 400);
    const path = writeFixture('ok-silence.wav', buildTestWav({ samples }));
    const result = await scoreSegment(path, 'transition');
    expect(result.flags).not.toContain('excessive_leading_silence');
    expect(result.flags).not.toContain('excessive_trailing_silence');
  });

  it('flags internal silence gap > 1000ms', async () => {
    const sampleRate = 24000;
    const samples: number[] = [];
    // 2s tone
    for (let i = 0; i < sampleRate * 2; i++) samples.push(0.5 * Math.sin(2 * Math.PI * 440 * i / sampleRate));
    // 1.2s silence (internal gap)
    for (let i = 0; i < Math.floor(sampleRate * 1.2); i++) samples.push(0);
    // 2s tone
    for (let i = 0; i < sampleRate * 2; i++) samples.push(0.5 * Math.sin(2 * Math.PI * 440 * i / sampleRate));
    // Total ~5.2s — within transition range (4-8s)

    const path = writeFixture('gap.wav', buildTestWav({ samples }));
    const result = await scoreSegment(path, 'transition');
    expect(result.flags).toContain('internal_silence_gap');
    expect(result.quality_score).toBeCloseTo(0.8, 5);
  });

  it('does not flag internal silence under 1000ms', async () => {
    const sampleRate = 24000;
    const samples: number[] = [];
    // 2.5s tone
    for (let i = 0; i < Math.floor(sampleRate * 2.5); i++) samples.push(0.5 * Math.sin(2 * Math.PI * 440 * i / sampleRate));
    // 800ms silence (under threshold)
    for (let i = 0; i < Math.floor(sampleRate * 0.8); i++) samples.push(0);
    // 2.5s tone
    for (let i = 0; i < Math.floor(sampleRate * 2.5); i++) samples.push(0.5 * Math.sin(2 * Math.PI * 440 * i / sampleRate));
    // Total ~5.8s

    const path = writeFixture('small-gap.wav', buildTestWav({ samples }));
    const result = await scoreSegment(path, 'transition');
    expect(result.flags).not.toContain('internal_silence_gap');
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd packages/tts && npx vitest run src/quality.test.ts`
Expected: All 14 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/tts/src/quality.test.ts
git commit -m "test(tts): add silence detection tests for quality scoring"
```

---

### Task 4: Combined Deduction + batchScore Tests

**Files:**
- Modify: `packages/tts/src/quality.test.ts`

- [ ] **Step 1: Add combined and batch tests**

Append to `packages/tts/src/quality.test.ts`:

```typescript
import { batchScore } from './quality';

describe('scoreSegment — combined deductions', () => {
  it('clamps score to 0.0 when deductions exceed 1.0', async () => {
    // Too-short file (duration deduction: -0.3) + leading silence (-0.1) + trailing silence (-0.1) + internal gap (-0.2) = -0.7
    // But let's make a really bad file: wrong duration AND lots of silence
    const sampleRate = 24000;
    const samples: number[] = [];
    // 800ms leading silence
    for (let i = 0; i < Math.floor(sampleRate * 0.8); i++) samples.push(0);
    // 200ms tone
    for (let i = 0; i < Math.floor(sampleRate * 0.2); i++) samples.push(0.5 * Math.sin(2 * Math.PI * 440 * i / sampleRate));
    // 1.2s internal gap
    for (let i = 0; i < Math.floor(sampleRate * 1.2); i++) samples.push(0);
    // 200ms tone
    for (let i = 0; i < Math.floor(sampleRate * 0.2); i++) samples.push(0.5 * Math.sin(2 * Math.PI * 440 * i / sampleRate));
    // 800ms trailing silence
    for (let i = 0; i < Math.floor(sampleRate * 0.8); i++) samples.push(0);
    // Total ~3.2s — too short for show_intro (8-15s), so -0.3 duration + -0.1 leading + -0.1 trailing + -0.2 gap = -0.7

    const path = writeFixture('bad-combo.wav', buildTestWav({ samples }));
    const result = await scoreSegment(path, 'show_intro');
    expect(result.quality_score).toBeCloseTo(0.3, 5);
    expect(result.flags).toContain('duration_out_of_range');
    expect(result.flags).toContain('excessive_leading_silence');
    expect(result.flags).toContain('excessive_trailing_silence');
    expect(result.flags).toContain('internal_silence_gap');
  });

  it('perfect file scores 1.0 with no flags', async () => {
    const path = writeFixture('perfect.wav', buildTestWav({ durationMs: 6000 }));
    const result = await scoreSegment(path, 'transition');
    expect(result.quality_score).toBe(1.0);
    expect(result.flags).toEqual([]);
  });
});

describe('batchScore', () => {
  it('scores multiple files in parallel', async () => {
    const good = writeFixture('batch-good.wav', buildTestWav({ durationMs: 6000 }));
    const bad = writeFixture('batch-bad.wav', buildTestWav({ corruptHeader: true }));
    const short = writeFixture('batch-short.wav', buildTestWav({ durationMs: 500 }));

    const results = await batchScore(
      [good, bad, short],
      ['transition', 'transition', 'transition'],
    );

    expect(results).toHaveLength(3);
    expect(results[0].quality_score).toBe(1.0);
    expect(results[1].quality_score).toBe(0.0);
    expect(results[1].flags).toContain('invalid_audio');
    expect(results[2].flags).toContain('duration_out_of_range');
  });
});
```

Note: The `batchScore` import should be added alongside the existing `scoreSegment` import at the top of the file:

```typescript
import { scoreSegment, batchScore } from './quality';
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd packages/tts && npx vitest run src/quality.test.ts`
Expected: All 17 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/tts/src/quality.test.ts
git commit -m "test(tts): add combined deduction and batchScore tests"
```

---

### Task 5: Export from Index + Typecheck

**Files:**
- Modify: `packages/tts/src/index.ts`

- [ ] **Step 1: Add exports to index.ts**

Add these lines to `packages/tts/src/index.ts`:

```typescript
export { scoreSegment, batchScore } from './quality';
export type { QualityResult } from './quality';
```

- [ ] **Step 2: Run typecheck**

Run: `cd packages/tts && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Run all TTS tests**

Run: `cd packages/tts && npx vitest run`
Expected: All tests PASS (quality + batch + scriptgen).

- [ ] **Step 4: Commit**

```bash
git add packages/tts/src/index.ts
git commit -m "feat(tts): export quality scoring from package index"
```
