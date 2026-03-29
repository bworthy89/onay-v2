import type { Segment, SegmentType, TracklistEntry } from '@onay/core';
import { generateSegmentId } from '@onay/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BridgingContext {
  previousSong: TracklistEntry;
  nextSong: TracklistEntry;
  stationMood: string[];
  stationGenre: string[];
}

export interface LLMProvider {
  generateBridgingScript(context: BridgingContext): Promise<string>;
}

export interface TTSProvider {
  generateSegment(
    script: string,
    type: SegmentType,
  ): Promise<{ audioPath: string; duration_ms: number }>;
}

// ---------------------------------------------------------------------------
// Stub LLM Provider
// ---------------------------------------------------------------------------

const BRIDGING_TEMPLATES = [
  'Alright, switching it up from {prev} to {next}...',
  "That was {prev} setting the mood, now let's bring in {next}...",
  "We're moving from {prev} into {next} — stay with me...",
  '{prev} just blessed your ears, and {next} is about to do the same...',
  "From {prev} to {next}, we're keeping the energy right...",
  "Can't get enough of {prev}, but wait till you hear {next}...",
];

/** Simple deterministic hash of a string to a number. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export class StubLLMProvider implements LLMProvider {
  async generateBridgingScript(context: BridgingContext): Promise<string> {
    const key = `${context.previousSong.title}:${context.nextSong.title}`;
    const idx = hashString(key) % BRIDGING_TEMPLATES.length;
    const template = BRIDGING_TEMPLATES[idx];
    return template
      .replace('{prev}', context.previousSong.artist)
      .replace('{next}', context.nextSong.artist);
  }
}

// ---------------------------------------------------------------------------
// Stub TTS Provider — generates a silent WAV (same pattern as packages/tts)
// ---------------------------------------------------------------------------

function buildSilentWav(durationMs: number): Buffer {
  const sampleRate = 22050;
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * numChannels * bytesPerSample;
  const headerSize = 44;
  const fileSize = headerSize + dataSize;

  const buf = Buffer.alloc(fileSize);
  let offset = 0;

  // RIFF header
  buf.write('RIFF', offset);
  offset += 4;
  buf.writeUInt32LE(fileSize - 8, offset);
  offset += 4;
  buf.write('WAVE', offset);
  offset += 4;

  // fmt sub-chunk
  buf.write('fmt ', offset);
  offset += 4;
  buf.writeUInt32LE(16, offset);
  offset += 4; // sub-chunk size
  buf.writeUInt16LE(1, offset);
  offset += 2; // PCM
  buf.writeUInt16LE(numChannels, offset);
  offset += 2;
  buf.writeUInt32LE(sampleRate, offset);
  offset += 4;
  buf.writeUInt32LE(sampleRate * numChannels * bytesPerSample, offset);
  offset += 4; // byte rate
  buf.writeUInt16LE(numChannels * bytesPerSample, offset);
  offset += 2; // block align
  buf.writeUInt16LE(bytesPerSample * 8, offset);
  offset += 2; // bits per sample

  // data sub-chunk (all zeros = silence)
  buf.write('data', offset);
  offset += 4;
  buf.writeUInt32LE(dataSize, offset);
  // remaining bytes are already 0

  return buf;
}

export class StubTTSProvider implements TTSProvider {
  async generateSegment(
    script: string,
    _type: SegmentType,
  ): Promise<{ audioPath: string; duration_ms: number }> {
    // Estimate duration at ~80ms per character, clamped to 4-8s for transitions
    const estimated = Math.min(8000, Math.max(4000, script.length * 80));
    // Build the WAV but don't write to disk — in tests the audioPath is a placeholder
    buildSilentWav(estimated);
    return {
      audioPath: `stub://bridging/${hashString(script)}.wav`,
      duration_ms: estimated,
    };
  }
}

// ---------------------------------------------------------------------------
// Boundary segment synthesis (show_intro / show_outro)
// ---------------------------------------------------------------------------

const INTRO_TEMPLATES = [
  "What's good, you're locked in with Onay — let's get this started.",
  "Welcome back, it's Onay on the ones and twos — we got a vibe tonight.",
  "You already know what it is — Onay here, and we're about to set it off.",
];

const OUTRO_TEMPLATES = [
  "That's a wrap for now — Onay signing off. Stay smooth out there.",
  "We out. Onay loves you. Catch you on the next one.",
  "And that's the show — Onay saying peace. Keep the vibe going.",
];

export async function synthesizeBoundary(
  type: 'show_intro' | 'show_outro',
  stationName: string,
  stationGenre: string[],
  stationMood: string[],
  tts: TTSProvider,
): Promise<Segment> {
  const templates = type === 'show_intro' ? INTRO_TEMPLATES : OUTRO_TEMPLATES;
  const idx = hashString(stationName) % templates.length;
  const script = templates[idx];

  const { audioPath, duration_ms } = await tts.generateSegment(script, type);

  return {
    segment_id: generateSegmentId(type),
    type,
    genre_tags: [...stationGenre],
    mood_tags: [...stationMood],
    artist_refs: [],
    energy_level: 3,
    duration_ms,
    quality_score: 0.7,
    exaggeration_level: 0.5,
    created_at: new Date().toISOString(),
    usage_count: 0,
    audio_url: audioPath,
    script_text: script,
  };
}

// ---------------------------------------------------------------------------
// Low-confidence detection
// ---------------------------------------------------------------------------

const HIGH_USAGE_THRESHOLD = 10;

export function detectLowConfidence(
  candidates: Segment[],
  energyTarget: number,
  energyTolerance: number,
): boolean {
  // Empty pool
  if (candidates.length === 0) return true;

  // No candidates within energy tolerance
  const withinEnergy = candidates.filter(
    (s) => Math.abs(s.energy_level - energyTarget) <= energyTolerance,
  );
  if (withinEnergy.length === 0) return true;

  // All candidates are overused
  if (candidates.every((s) => s.usage_count > HIGH_USAGE_THRESHOLD)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Bridge generation
// ---------------------------------------------------------------------------

export async function generateBridge(
  context: BridgingContext,
  llm: LLMProvider,
  tts: TTSProvider,
): Promise<Segment> {
  const script = await llm.generateBridgingScript(context);
  const { audioPath, duration_ms } = await tts.generateSegment(script, 'transition');

  return {
    segment_id: generateSegmentId('transition'),
    type: 'transition',
    genre_tags: [...context.stationGenre],
    mood_tags: [...context.stationMood],
    artist_refs: [context.previousSong.artist, context.nextSong.artist],
    energy_level: 3,
    duration_ms,
    quality_score: 0.7, // generated segments get a baseline score
    exaggeration_level: 0.5,
    created_at: new Date().toISOString(),
    usage_count: 0,
    audio_url: audioPath,
    script_text: script,
  };
}
