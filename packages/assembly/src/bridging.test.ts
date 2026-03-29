import { describe, it, expect, vi } from 'vitest';
import type { Segment, SegmentType, TracklistEntry } from '@onay/core';
import {
  StubLLMProvider,
  StubTTSProvider,
  detectLowConfidence,
  generateBridge,
  type BridgingContext,
  type LLMProvider,
  type TTSProvider,
} from './bridging';
import { selectSegments, type AssemblyConfig } from './selector';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTrack(overrides: Partial<TracklistEntry> & { artist: string; title: string }): TracklistEntry {
  return {
    canonical_id: `${overrides.artist}-${overrides.title}`.toLowerCase().replace(/\s+/g, '-'),
    duration_ms: 210000,
    ...overrides,
  };
}

function makeSegment(overrides: Partial<Segment> & { segment_id: string; type: SegmentType }): Segment {
  return {
    genre_tags: ['hip-hop'],
    mood_tags: ['chill'],
    artist_refs: [],
    energy_level: 3,
    duration_ms: 6000,
    quality_score: 0.8,
    exaggeration_level: 0.5,
    created_at: '2026-01-01T00:00:00Z',
    usage_count: 0,
    audio_url: `https://cdn.onay.fm/segments/${overrides.segment_id}.wav`,
    script_text: 'Test script',
    ...overrides,
  };
}

const TRACK_A = makeTrack({ artist: 'SZA', title: 'Kill Bill' });
const TRACK_B = makeTrack({ artist: 'Frank Ocean', title: 'Nights' });

function makeBridgingContext(overrides?: Partial<BridgingContext>): BridgingContext {
  return {
    previousSong: TRACK_A,
    nextSong: TRACK_B,
    stationMood: ['chill', 'late-night'],
    stationGenre: ['hip-hop', 'r&b'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// StubLLMProvider
// ---------------------------------------------------------------------------

describe('StubLLMProvider', () => {
  const llm = new StubLLMProvider();

  it('generates a script containing both artist names', async () => {
    const script = await llm.generateBridgingScript(makeBridgingContext());
    expect(script).toContain('SZA');
    expect(script).toContain('Frank Ocean');
  });

  it('is deterministic — same songs produce same script', async () => {
    const ctx = makeBridgingContext();
    const a = await llm.generateBridgingScript(ctx);
    const b = await llm.generateBridgingScript(ctx);
    expect(a).toBe(b);
  });

  it('produces different scripts for different song pairs', async () => {
    const ctx1 = makeBridgingContext();
    const ctx2 = makeBridgingContext({
      previousSong: makeTrack({ artist: 'Drake', title: 'Passionfruit' }),
      nextSong: makeTrack({ artist: 'The Weeknd', title: 'Blinding Lights' }),
    });
    const a = await llm.generateBridgingScript(ctx1);
    const b = await llm.generateBridgingScript(ctx2);
    // Different song pairs should hash to different templates (or at least different fills)
    expect(a).not.toBe(b);
  });

  it('returns a non-empty string', async () => {
    const script = await llm.generateBridgingScript(makeBridgingContext());
    expect(script.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// StubTTSProvider
// ---------------------------------------------------------------------------

describe('StubTTSProvider', () => {
  const tts = new StubTTSProvider();

  it('returns an audioPath and duration_ms', async () => {
    const result = await tts.generateSegment('Test script for bridging', 'transition');
    expect(result.audioPath).toMatch(/^stub:\/\/bridging\//);
    expect(result.duration_ms).toBeGreaterThanOrEqual(4000);
    expect(result.duration_ms).toBeLessThanOrEqual(8000);
  });

  it('clamps short scripts to minimum 4000ms', async () => {
    const result = await tts.generateSegment('Hi', 'transition');
    expect(result.duration_ms).toBe(4000);
  });

  it('clamps long scripts to maximum 8000ms', async () => {
    const result = await tts.generateSegment('x'.repeat(200), 'transition');
    expect(result.duration_ms).toBe(8000);
  });
});

// ---------------------------------------------------------------------------
// detectLowConfidence
// ---------------------------------------------------------------------------

describe('detectLowConfidence', () => {
  it('returns true when candidate pool is empty', () => {
    expect(detectLowConfidence([], 3, 2)).toBe(true);
  });

  it('returns true when no candidates match energy tolerance', () => {
    const candidates = [
      makeSegment({ segment_id: 'SEG-TR-00001', type: 'transition', energy_level: 1 }),
    ];
    // target 5, tolerance 1 → need 4-5, candidate is 1
    expect(detectLowConfidence(candidates, 5, 1)).toBe(true);
  });

  it('returns true when all candidates are overused (usage_count > 10)', () => {
    const candidates = [
      makeSegment({ segment_id: 'SEG-TR-00001', type: 'transition', usage_count: 11 }),
      makeSegment({ segment_id: 'SEG-TR-00002', type: 'transition', usage_count: 15 }),
    ];
    expect(detectLowConfidence(candidates, 3, 2)).toBe(true);
  });

  it('returns false when good candidates exist', () => {
    const candidates = [
      makeSegment({ segment_id: 'SEG-TR-00001', type: 'transition', energy_level: 3, usage_count: 2 }),
    ];
    expect(detectLowConfidence(candidates, 3, 1)).toBe(false);
  });

  it('returns false when at least one candidate has low usage', () => {
    const candidates = [
      makeSegment({ segment_id: 'SEG-TR-00001', type: 'transition', usage_count: 15 }),
      makeSegment({ segment_id: 'SEG-TR-00002', type: 'transition', usage_count: 5 }),
    ];
    expect(detectLowConfidence(candidates, 3, 2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateBridge
// ---------------------------------------------------------------------------

describe('generateBridge', () => {
  it('returns a complete Segment object', async () => {
    const ctx = makeBridgingContext();
    const seg = await generateBridge(ctx, new StubLLMProvider(), new StubTTSProvider());

    expect(seg.segment_id).toMatch(/^SEG-TR-\d{5}$/);
    expect(seg.type).toBe('transition');
    expect(seg.genre_tags).toEqual(['hip-hop', 'r&b']);
    expect(seg.mood_tags).toEqual(['chill', 'late-night']);
    expect(seg.artist_refs).toContain('SZA');
    expect(seg.artist_refs).toContain('Frank Ocean');
    expect(seg.energy_level).toBe(3);
    expect(seg.quality_score).toBe(0.7);
    expect(seg.usage_count).toBe(0);
    expect(seg.script_text).toContain('SZA');
    expect(seg.audio_url).toMatch(/^stub:\/\//);
    expect(seg.duration_ms).toBeGreaterThanOrEqual(4000);
  });

  it('calls the LLM provider with correct context', async () => {
    const ctx = makeBridgingContext();
    const mockLLM: LLMProvider = {
      generateBridgingScript: vi.fn().mockResolvedValue('Custom bridge script'),
    };
    const seg = await generateBridge(ctx, mockLLM, new StubTTSProvider());

    expect(mockLLM.generateBridgingScript).toHaveBeenCalledWith(ctx);
    expect(seg.script_text).toBe('Custom bridge script');
  });

  it('calls the TTS provider with the generated script', async () => {
    const mockTTS: TTSProvider = {
      generateSegment: vi.fn().mockResolvedValue({ audioPath: '/test/audio.wav', duration_ms: 5000 }),
    };
    const seg = await generateBridge(makeBridgingContext(), new StubLLMProvider(), mockTTS);

    expect(mockTTS.generateSegment).toHaveBeenCalledWith(expect.any(String), 'transition');
    expect(seg.audio_url).toBe('/test/audio.wav');
    expect(seg.duration_ms).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Selector integration with bridging
// ---------------------------------------------------------------------------

describe('selectSegments with bridging', () => {
  const DEFAULT_CONFIG: AssemblyConfig = {
    timeOfDay: 'evening',
    variationSeed: 42,
  };

  const TRACKS: TracklistEntry[] = [
    makeTrack({ artist: 'SZA', title: 'Kill Bill' }),
    makeTrack({ artist: 'Frank Ocean', title: 'Nights' }),
    makeTrack({ artist: 'Tyler, the Creator', title: 'EARFQUAKE' }),
    makeTrack({ artist: 'Kendrick Lamar', title: 'HUMBLE.' }),
    makeTrack({ artist: 'Drake', title: 'Passionfruit' }),
  ];

  function makeStation(overrides?: Partial<Parameters<typeof makeTrack>[0]> & Record<string, unknown>) {
    return {
      station_id: 'station-001',
      name: 'Late Night R&B',
      description: 'Smooth vibes',
      genre_tags: ['hip-hop', 'r&b'],
      mood_tags: ['chill', 'late-night'],
      cover_art_url: 'https://cdn.onay.fm/covers/station-001.jpg',
      rotation_schedule: { frequency: 'daily', time_of_day_target: 'evening', days: ['mon'] },
      tracklist: TRACKS,
      provider_availability: { apple_music: {}, spotify: {} },
      ...overrides,
    };
  }

  it('falls back to bridging when library is empty (no intro/outro available)', async () => {
    const station = makeStation();
    const entries = await selectSegments(station, [], DEFAULT_CONFIG);

    // With an empty library: no intro/outro from library, but bridging may produce transitions
    // All songs should still be present
    const songs = entries.filter((e) => e.type === 'song');
    expect(songs).toHaveLength(5);
  });

  it('generates bridged segments when all candidates are overused', async () => {
    const overusedLib = [
      makeSegment({ segment_id: 'SEG-SI-00001', type: 'show_intro', energy_level: 3 }),
      makeSegment({ segment_id: 'SEG-SO-00001', type: 'show_outro', energy_level: 3 }),
      // Only transitions, all overused
      makeSegment({ segment_id: 'SEG-TR-00001', type: 'transition', energy_level: 3, usage_count: 20 }),
      makeSegment({ segment_id: 'SEG-TR-00002', type: 'transition', energy_level: 3, usage_count: 15 }),
    ];

    const trackingLLM: LLMProvider & { calls: BridgingContext[] } = {
      calls: [],
      async generateBridgingScript(ctx: BridgingContext) {
        this.calls.push(ctx);
        return `Bridge from ${ctx.previousSong.artist} to ${ctx.nextSong.artist}`;
      },
    };

    const entries = await selectSegments(makeStation(), overusedLib, {
      ...DEFAULT_CONFIG,
      llmProvider: trackingLLM,
      ttsProvider: new StubTTSProvider(),
    });

    // Bridged segments should have been generated
    expect(trackingLLM.calls.length).toBeGreaterThan(0);

    // All songs still present
    const songs = entries.filter((e) => e.type === 'song');
    expect(songs).toHaveLength(5);

    // Some segments should be bridged (auto-generated IDs)
    const segments = entries.filter((e) => e.type === 'segment');
    expect(segments.length).toBeGreaterThan(2); // at least intro + outro + some bridges
  });

  it('uses library segments when confidence is high (no bridging needed)', async () => {
    const goodLib = [
      makeSegment({ segment_id: 'SEG-SI-00001', type: 'show_intro', energy_level: 3 }),
      makeSegment({ segment_id: 'SEG-SO-00001', type: 'show_outro', energy_level: 3 }),
      ...Array.from({ length: 10 }, (_, i) =>
        makeSegment({
          segment_id: `SEG-TR-${String(i).padStart(5, '0')}`,
          type: 'transition',
          energy_level: 3,
          usage_count: 0,
        }),
      ),
    ];

    const trackingLLM: LLMProvider & { callCount: number } = {
      callCount: 0,
      async generateBridgingScript(ctx: BridgingContext) {
        this.callCount++;
        return 'Should not be called';
      },
    };

    await selectSegments(makeStation(), goodLib, {
      ...DEFAULT_CONFIG,
      llmProvider: trackingLLM,
      ttsProvider: new StubTTSProvider(),
    });

    // LLM should not have been called since library has good candidates
    expect(trackingLLM.callCount).toBe(0);
  });

  it('still produces deterministic output with bridging stubs', async () => {
    const station = makeStation();
    const minLib = [
      makeSegment({ segment_id: 'SEG-SI-00001', type: 'show_intro', energy_level: 3 }),
      makeSegment({ segment_id: 'SEG-SO-00001', type: 'show_outro', energy_level: 3 }),
    ];

    // With stubs, the song order and structure should be consistent
    const a = await selectSegments(station, minLib, { ...DEFAULT_CONFIG, variationSeed: 99 });
    const b = await selectSegments(station, minLib, { ...DEFAULT_CONFIG, variationSeed: 99 });

    const aSongs = a.filter((e) => e.type === 'song');
    const bSongs = b.filter((e) => e.type === 'song');
    expect(aSongs).toEqual(bSongs);
  });
});
