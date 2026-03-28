import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { ChatterboxEngine } from './chatterbox';
import { runBatch } from './batch';
import type { GenerationJob, BatchManifest } from './types';

// ---------------------------------------------------------------------------
// Mock engine
// ---------------------------------------------------------------------------

class MockChatterboxEngine implements ChatterboxEngine {
  calls: Array<{ text: string; refWav: string; exaggeration: number }> = [];

  async generateAudio(text: string, refWav: string, exaggeration: number): Promise<Buffer> {
    this.calls.push({ text, refWav, exaggeration });

    // Return a minimal valid WAV: 22050 Hz, 16-bit, mono, ~100 samples
    const numSamples = 100;
    const dataSize = numSamples * 2;
    const buf = Buffer.alloc(44 + dataSize);

    buf.write('RIFF', 0);
    buf.writeUInt32LE(36 + dataSize, 4);
    buf.write('WAVE', 8);
    buf.write('fmt ', 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);       // PCM
    buf.writeUInt16LE(1, 22);       // mono
    buf.writeUInt32LE(22050, 24);   // sample rate
    buf.writeUInt32LE(44100, 28);   // byte rate
    buf.writeUInt16LE(2, 32);       // block align
    buf.writeUInt16LE(16, 34);      // bits per sample
    buf.write('data', 36);
    buf.writeUInt32LE(dataSize, 40);

    return buf;
  }
}

class FailingEngine implements ChatterboxEngine {
  async generateAudio(): Promise<Buffer> {
    throw new Error('GPU exploded');
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir(): string {
  const dir = join(tmpdir(), `onay-tts-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeJobs(dir: string, jobs: GenerationJob[]): string {
  const path = join(dir, 'jobs.json');
  writeFileSync(path, JSON.stringify(jobs));
  return path;
}

const sampleJobs: GenerationJob[] = [
  {
    script_text: 'Welcome to the show.',
    type: 'show_intro',
    genre_tags: ['hip-hop'],
    mood_tags: ['hype'],
    artist_refs: [],
    energy_level: 4,
    takes: 1,
    exaggeration_levels: [0.3, 0.7],
  },
  {
    script_text: 'SZA is incredible.',
    type: 'artist_shoutout',
    genre_tags: ['r&b'],
    mood_tags: ['chill'],
    artist_refs: ['SZA'],
    energy_level: 3,
    takes: 2,
    exaggeration_levels: [0.5],
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runBatch', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('generates the correct number of takes per job', async () => {
    const inputPath = writeJobs(tmpDir, sampleJobs);
    const outputDir = join(tmpDir, 'output');
    const engine = new MockChatterboxEngine();

    const result = await runBatch({
      inputPath,
      outputDir,
      refWav: '/fake/ref.wav',
      engine,
    });

    // Job 0: 1 take × 2 exaggeration levels = 2 takes
    // Job 1: 2 takes × 1 exaggeration level  = 2 takes
    // Total = 4
    expect(result.takesGenerated).toBe(4);
    expect(result.jobsProcessed).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it('calls the engine with correct parameters', async () => {
    const inputPath = writeJobs(tmpDir, [sampleJobs[0]]);
    const outputDir = join(tmpDir, 'output');
    const engine = new MockChatterboxEngine();

    await runBatch({
      inputPath,
      outputDir,
      refWav: '/fake/ref.wav',
      engine,
    });

    // 1 take × 2 exaggeration levels = 2 calls
    expect(engine.calls).toHaveLength(2);
    expect(engine.calls[0].text).toBe('Welcome to the show.');
    expect(engine.calls[0].refWav).toBe('/fake/ref.wav');
    expect(engine.calls[0].exaggeration).toBe(0.3);
    expect(engine.calls[1].exaggeration).toBe(0.7);
  });

  it('writes WAV files in output/{segment_id}/ directories', async () => {
    const inputPath = writeJobs(tmpDir, [sampleJobs[0]]);
    const outputDir = join(tmpDir, 'output');
    const engine = new MockChatterboxEngine();

    const result = await runBatch({
      inputPath,
      outputDir,
      refWav: '/fake/ref.wav',
      engine,
    });

    // Read manifest to get segment IDs
    const manifest: BatchManifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    expect(manifest.segments).toHaveLength(2);

    for (const seg of manifest.segments) {
      const segDir = join(outputDir, seg.segment_id);
      expect(existsSync(segDir)).toBe(true);

      // Check that at least one take-*.wav exists in the directory
      const audioUrl = seg.audio_url;
      expect(existsSync(audioUrl)).toBe(true);
    }
  });

  it('writes a valid manifest.json', async () => {
    const inputPath = writeJobs(tmpDir, sampleJobs);
    const outputDir = join(tmpDir, 'output');
    const engine = new MockChatterboxEngine();

    const result = await runBatch({
      inputPath,
      outputDir,
      refWav: '/fake/ref.wav',
      engine,
    });

    expect(existsSync(result.manifestPath)).toBe(true);

    const manifest: BatchManifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    expect(manifest.batch_id).toMatch(/^BATCH-\d{14}$/);
    expect(manifest.voice_ref).toBe('/fake/ref.wav');
    expect(manifest.input_file).toBe('jobs.json');
    expect(manifest.total_jobs).toBe(2);
    expect(manifest.total_takes).toBe(4);
    expect(manifest.segments).toHaveLength(4);
  });

  it('segment metadata has correct fields', async () => {
    const inputPath = writeJobs(tmpDir, [sampleJobs[1]]);
    const outputDir = join(tmpDir, 'output');
    const engine = new MockChatterboxEngine();

    const result = await runBatch({
      inputPath,
      outputDir,
      refWav: '/fake/ref.wav',
      engine,
    });

    const manifest: BatchManifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    const seg = manifest.segments[0];

    expect(seg.segment_id).toMatch(/^SEG-AS-\d{5}$/);
    expect(seg.type).toBe('artist_shoutout');
    expect(seg.genre_tags).toEqual(['r&b']);
    expect(seg.mood_tags).toEqual(['chill']);
    expect(seg.artist_refs).toEqual(['SZA']);
    expect(seg.energy_level).toBe(3);
    expect(seg.quality_score).toBe(0);
    expect(seg.usage_count).toBe(0);
    expect(seg.script_text).toBe('SZA is incredible.');
    expect(seg.duration_ms).toBeGreaterThanOrEqual(0);
    expect(seg.created_at).toBeTruthy();
  });

  it('records errors without crashing the batch', async () => {
    const inputPath = writeJobs(tmpDir, [sampleJobs[0]]);
    const outputDir = join(tmpDir, 'output');
    const engine = new FailingEngine();

    const result = await runBatch({
      inputPath,
      outputDir,
      refWav: '/fake/ref.wav',
      engine,
    });

    expect(result.jobsProcessed).toBe(1);
    expect(result.takesGenerated).toBe(0);
    expect(result.errors).toHaveLength(2); // 1 take × 2 exaggeration levels
    expect(result.errors[0].error).toBe('GPU exploded');
  });

  it('validates input and rejects invalid jobs', async () => {
    const badPath = join(tmpDir, 'bad.json');
    writeFileSync(badPath, JSON.stringify([{ script_text: '' }]));
    const outputDir = join(tmpDir, 'output');
    const engine = new MockChatterboxEngine();

    await expect(
      runBatch({ inputPath: badPath, outputDir, refWav: '/fake/ref.wav', engine }),
    ).rejects.toThrow('script_text must be a non-empty string');
  });

  it('each segment gets a unique ID from @onay/core', async () => {
    const inputPath = writeJobs(tmpDir, sampleJobs);
    const outputDir = join(tmpDir, 'output');
    const engine = new MockChatterboxEngine();

    const result = await runBatch({
      inputPath,
      outputDir,
      refWav: '/fake/ref.wav',
      engine,
    });

    const manifest: BatchManifest = JSON.parse(readFileSync(result.manifestPath, 'utf-8'));
    const ids = manifest.segments.map((s) => s.segment_id);
    const uniqueIds = new Set(ids);

    // All IDs should be unique (statistically guaranteed with 90k range for 4 segments)
    expect(uniqueIds.size).toBe(ids.length);

    // IDs should follow @onay/core format: SEG-{ABBREV}-{5 digits}
    for (const id of ids) {
      expect(id).toMatch(/^SEG-[A-Z]{2}-\d{5}$/);
    }
  });
});
