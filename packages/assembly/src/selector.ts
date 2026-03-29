import type { Station, Segment, SegmentType, TimelineEntry, TracklistEntry } from '@onay/core';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AssemblyConfig {
  timeOfDay: string;
  variationSeed: number;
}

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32)
// ---------------------------------------------------------------------------

function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pick the best segment from candidates using effective usage (lower better) then quality_score (higher better), with seeded randomness for tie-breaking. */
function pickBest(
  candidates: Segment[],
  rng: () => number,
  usageBumps: Map<string, number>,
): Segment {
  const shuffled = candidates.map((s) => ({
    s,
    effectiveUsage: s.usage_count + (usageBumps.get(s.segment_id) ?? 0),
    r: rng(),
  }));
  shuffled.sort((a, b) => {
    if (a.effectiveUsage !== b.effectiveUsage) return a.effectiveUsage - b.effectiveUsage;
    if (a.s.quality_score !== b.s.quality_score) return b.s.quality_score - a.s.quality_score;
    return a.r - b.r;
  });
  return shuffled[0].s;
}

function segmentToEntry(seg: Segment): TimelineEntry {
  return {
    type: 'segment',
    segment_id: seg.segment_id,
    audio_url: seg.audio_url,
    duration_ms: seg.duration_ms,
  };
}

function trackToEntry(track: TracklistEntry): TimelineEntry {
  return {
    type: 'song',
    canonical_id: track.canonical_id,
    artist: track.artist,
    title: track.title,
    ...(track.isrc ? { isrc: track.isrc } : {}),
    duration_ms: track.duration_ms,
  };
}

/** Check if a segment's genre_tags overlap with the station's genre_tags. */
function matchesStationGenre(seg: Segment, station: Station): boolean {
  if (seg.genre_tags.length === 0) return true; // untagged segments are universal
  return seg.genre_tags.some((g) => station.genre_tags.includes(g));
}

// ---------------------------------------------------------------------------
// Candidate filtering
// ---------------------------------------------------------------------------

interface CandidateContext {
  station: Station;
  recentIds: string[];
  adLibCount: number;
  lastEntryWasSegment: boolean;
  energyTarget: number | null;
  config: AssemblyConfig;
  currentTrack: TracklistEntry | null;
  nextTrack: TracklistEntry | null;
}

function getCandidates(
  library: Segment[],
  allowedTypes: SegmentType[],
  ctx: CandidateContext,
  energyTolerance: number,
): Segment[] {
  return library.filter((seg) => {
    // Type filter
    if (!allowedTypes.includes(seg.type)) return false;

    // No repeat within 5 slots
    if (ctx.recentIds.includes(seg.segment_id)) return false;

    // Energy matching (skip when target is unknown)
    if (ctx.energyTarget !== null && Math.abs(seg.energy_level - ctx.energyTarget) > energyTolerance) return false;

    // Genre preference
    if (!matchesStationGenre(seg, ctx.station)) return false;

    // Ad-lib rules
    if (seg.type === 'ad_lib') {
      if (ctx.adLibCount >= 2) return false;
      if (ctx.lastEntryWasSegment) return false;
    }

    // Artist shoutout: only adjacent to a song by that artist
    if (seg.type === 'artist_shoutout') {
      const adjacentArtists: string[] = [];
      if (ctx.currentTrack) adjacentArtists.push(ctx.currentTrack.artist.toLowerCase());
      if (ctx.nextTrack) adjacentArtists.push(ctx.nextTrack.artist.toLowerCase());
      const hasMatch = seg.artist_refs.some((ref) =>
        adjacentArtists.some((a) => a.includes(ref.toLowerCase()) || ref.toLowerCase().includes(a)),
      );
      if (!hasMatch) return false;
    }

    // Time-of-day: must match station's rotation schedule target
    if (seg.type === 'time_of_day') {
      const target = ctx.station.rotation_schedule?.time_of_day_target;
      if (!target) return true; // allow if station has no target
      const segTimeHints = [...seg.genre_tags, ...seg.mood_tags].map((t) => t.toLowerCase());
      if (!segTimeHints.includes(target.toLowerCase())) return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Main selector
// ---------------------------------------------------------------------------

export function selectSegments(
  station: Station,
  library: Segment[],
  config: AssemblyConfig,
): TimelineEntry[] {
  const rng = createRng(config.variationSeed);
  const tracklist = station.tracklist;

  if (tracklist.length === 0) return [];

  const entries: TimelineEntry[] = [];
  const recentIds: string[] = [];
  const usageBumps = new Map<string, number>(); // track within-run usage bumps
  let adLibCount = 0;
  let lastEntryWasSegment = false;

  // Helper to track a used segment
  const useSegment = (seg: Segment) => {
    entries.push(segmentToEntry(seg));
    recentIds.push(seg.segment_id);
    if (recentIds.length > 5) recentIds.shift();
    if (seg.type === 'ad_lib') adLibCount++;
    usageBumps.set(seg.segment_id, (usageBumps.get(seg.segment_id) ?? 0) + 1);
    lastEntryWasSegment = true;
  };

  // Helper to add a song
  const useSong = (track: TracklistEntry) => {
    entries.push(trackToEntry(track));
    lastEntryWasSegment = false;
  };

  // --- 1. Show intro ---
  const introCtx: CandidateContext = {
    station,
    recentIds,
    adLibCount,
    lastEntryWasSegment: false,
    energyTarget: null,
    config,
    currentTrack: null,
    nextTrack: tracklist[0] ?? null,
  };

  // Prefer genre-matching intro, fall back to any intro
  let introCandidates = getCandidates(library, ['show_intro'], introCtx, 5);
  if (introCandidates.length === 0) {
    introCandidates = library.filter((s) => s.type === 'show_intro');
  }
  if (introCandidates.length > 0) {
    useSegment(pickBest(introCandidates, rng, usageBumps));
  }

  // --- 2. Pre-compute which transition gaps get segments (60-70% of gaps) ---
  const numGaps = tracklist.length - 1;
  const segmentGaps = new Set<number>();
  if (numGaps > 0) {
    const allowedMin = Math.ceil(0.60 * numGaps);
    const allowedMax = Math.floor(0.70 * numGaps);
    const targetCount = allowedMin + Math.floor(rng() * (allowedMax - allowedMin + 1));

    // Fisher-Yates partial shuffle to pick targetCount unique gap indices
    const indices = Array.from({ length: numGaps }, (_, i) => i);
    for (let j = 0; j < targetCount; j++) {
      const swap = j + Math.floor(rng() * (numGaps - j));
      [indices[j], indices[swap]] = [indices[swap], indices[j]];
      segmentGaps.add(indices[j]);
    }
  }

  for (let i = 0; i < tracklist.length; i++) {
    const track = tracklist[i];
    useSong(track);

    // Don't place a segment after the last song (outro goes there)
    if (i === tracklist.length - 1) break;

    // Skip transitions not selected for a segment
    if (!segmentGaps.has(i)) continue;

    const nextTrack = tracklist[i + 1];
    const isLastTransition = i === tracklist.length - 2;

    // TracklistEntry has no energy_level — skip energy filtering
    const energyTarget: number | null = null;

    const ctx: CandidateContext = {
      station,
      recentIds,
      adLibCount,
      lastEntryWasSegment,
      energyTarget,
      config,
      currentTrack: track,
      nextTrack,
    };

    // Preferred segment types for transitions
    const transitionTypes: SegmentType[] = [
      'artist_shoutout',
      'song_intro',
      'transition',
      'genre_vibe',
      'fun_fact',
      'hot_take',
      'time_of_day',
      'seasonal',
      ...(isLastTransition ? [] : ['ad_lib' as SegmentType]),
    ];

    // When energyTarget is known, try ±1 then ±2; when null, energy filter is skipped
    let candidates = getCandidates(library, transitionTypes, ctx, 1);
    if (candidates.length === 0 && ctx.energyTarget !== null) {
      candidates = getCandidates(library, transitionTypes, ctx, 2);
    }

    if (candidates.length > 0) {
      useSegment(pickBest(candidates, rng, usageBumps));
    }
  }

  // --- 3. Show outro ---
  const outroCtx: CandidateContext = {
    station,
    recentIds,
    adLibCount,
    lastEntryWasSegment,
    energyTarget: null,
    config,
    currentTrack: tracklist[tracklist.length - 1],
    nextTrack: null,
  };

  let outroCandidates = getCandidates(library, ['show_outro'], outroCtx, 5);
  if (outroCandidates.length === 0) {
    outroCandidates = library.filter((s) => s.type === 'show_outro');
  }
  if (outroCandidates.length > 0) {
    useSegment(pickBest(outroCandidates, rng, usageBumps));
  }

  return entries;
}
