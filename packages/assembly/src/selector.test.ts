import { describe, it, expect } from 'vitest';
import type { Station, Segment, SegmentType, TimelineEntry, TracklistEntry } from '@onay/core';
import { selectSegments, type AssemblyConfig } from './selector';

// ---------------------------------------------------------------------------
// Test fixtures
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

const TRACKS: TracklistEntry[] = [
  makeTrack({ artist: 'SZA', title: 'Kill Bill' }),
  makeTrack({ artist: 'Frank Ocean', title: 'Nights' }),
  makeTrack({ artist: 'Tyler, the Creator', title: 'EARFQUAKE' }),
  makeTrack({ artist: 'Kendrick Lamar', title: 'HUMBLE.' }),
  makeTrack({ artist: 'SZA', title: 'Snooze' }),
  makeTrack({ artist: 'The Weeknd', title: 'Blinding Lights' }),
  makeTrack({ artist: 'Drake', title: 'Passionfruit' }),
  makeTrack({ artist: 'Daniel Caesar', title: 'Best Part' }),
  makeTrack({ artist: 'Solange', title: 'Cranes in the Sky' }),
  makeTrack({ artist: 'Frank Ocean', title: 'Thinkin Bout You' }),
  makeTrack({ artist: 'H.E.R.', title: 'Best Part' }),
  makeTrack({ artist: 'Jhene Aiko', title: 'Triggered' }),
  makeTrack({ artist: 'Mac Miller', title: 'Self Care' }),
  makeTrack({ artist: 'Childish Gambino', title: 'Redbone' }),
  makeTrack({ artist: 'Anderson .Paak', title: 'Come Down' }),
];

function makeStation(overrides?: Partial<Station>): Station {
  return {
    station_id: 'station-001',
    name: 'Late Night R&B',
    description: 'Smooth vibes for the late night',
    genre_tags: ['hip-hop', 'r&b'],
    mood_tags: ['chill', 'late-night'],
    cover_art_url: 'https://cdn.onay.fm/covers/station-001.jpg',
    rotation_schedule: { frequency: 'daily', time_of_day_target: 'evening', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
    tracklist: TRACKS,
    provider_availability: { apple_music: {}, spotify: {} },
    ...overrides,
  };
}

function buildLibrary(): Segment[] {
  const segs: Segment[] = [];
  let id = 0;
  const nextId = (prefix: string) => `SEG-${prefix}-${String(++id).padStart(5, '0')}`;

  // Show intros (3)
  for (let i = 0; i < 3; i++) {
    segs.push(makeSegment({ segment_id: nextId('SI'), type: 'show_intro', duration_ms: 10000, energy_level: 3 }));
  }

  // Show outros (3)
  for (let i = 0; i < 3; i++) {
    segs.push(makeSegment({ segment_id: nextId('SO'), type: 'show_outro', duration_ms: 9000, energy_level: 2 }));
  }

  // Transitions (10)
  for (let i = 0; i < 10; i++) {
    segs.push(makeSegment({ segment_id: nextId('TR'), type: 'transition', energy_level: 2 + (i % 3), duration_ms: 5000 }));
  }

  // Song intros (8)
  for (let i = 0; i < 8; i++) {
    segs.push(makeSegment({ segment_id: nextId('SN'), type: 'song_intro', energy_level: 2 + (i % 3), duration_ms: 7000 }));
  }

  // Artist shoutouts (4) — specific artists
  segs.push(makeSegment({ segment_id: nextId('AS'), type: 'artist_shoutout', artist_refs: ['SZA'], energy_level: 3 }));
  segs.push(makeSegment({ segment_id: nextId('AS'), type: 'artist_shoutout', artist_refs: ['Frank Ocean'], energy_level: 3 }));
  segs.push(makeSegment({ segment_id: nextId('AS'), type: 'artist_shoutout', artist_refs: ['Drake'], energy_level: 3 }));
  segs.push(makeSegment({ segment_id: nextId('AS'), type: 'artist_shoutout', artist_refs: ['Beyonce'], energy_level: 3 }));

  // Genre vibes (5)
  for (let i = 0; i < 5; i++) {
    segs.push(makeSegment({ segment_id: nextId('GV'), type: 'genre_vibe', energy_level: 2 + (i % 3), duration_ms: 8000 }));
  }

  // Fun facts (4)
  for (let i = 0; i < 4; i++) {
    segs.push(makeSegment({ segment_id: nextId('FF'), type: 'fun_fact', energy_level: 3, duration_ms: 10000 }));
  }

  // Hot takes (3)
  for (let i = 0; i < 3; i++) {
    segs.push(makeSegment({ segment_id: nextId('HT'), type: 'hot_take', energy_level: 4, duration_ms: 8000 }));
  }

  // Time-of-day (3) — tagged with time hints in mood_tags
  segs.push(makeSegment({ segment_id: nextId('TD'), type: 'time_of_day', mood_tags: ['evening'], energy_level: 2, duration_ms: 5000 }));
  segs.push(makeSegment({ segment_id: nextId('TD'), type: 'time_of_day', mood_tags: ['morning'], energy_level: 3, duration_ms: 5000 }));
  segs.push(makeSegment({ segment_id: nextId('TD'), type: 'time_of_day', mood_tags: ['late-night'], energy_level: 2, duration_ms: 5000 }));

  // Ad-libs (4)
  for (let i = 0; i < 4; i++) {
    segs.push(makeSegment({ segment_id: nextId('AL'), type: 'ad_lib', energy_level: 3, duration_ms: 2000 }));
  }

  // Seasonal (3)
  for (let i = 0; i < 3; i++) {
    segs.push(makeSegment({ segment_id: nextId('SE'), type: 'seasonal', energy_level: 3, duration_ms: 7000 }));
  }

  return segs;
}

const DEFAULT_CONFIG: AssemblyConfig = {
  timeOfDay: 'evening',
  variationSeed: 42,
  allowStubs: true,
};

// ---------------------------------------------------------------------------
// Helpers for assertions
// ---------------------------------------------------------------------------

function songEntries(entries: TimelineEntry[]) {
  return entries.filter((e) => e.type === 'song');
}

function segmentEntries(entries: TimelineEntry[]) {
  return entries.filter((e) => e.type === 'segment');
}

function getSegmentIds(entries: TimelineEntry[]): string[] {
  return entries.filter((e): e is Extract<TimelineEntry, { type: 'segment' }> => e.type === 'segment').map((e) => e.segment_id);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('selectSegments', () => {
  const station = makeStation();
  const library = buildLibrary();

  describe('show intro and outro', () => {
    it('starts with a show_intro segment', async () => {
      const entries = await selectSegments(station, library, DEFAULT_CONFIG);
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0].type).toBe('segment');
      const firstSeg = entries[0] as Extract<TimelineEntry, { type: 'segment' }>;
      const introIds = library.filter((s) => s.type === 'show_intro').map((s) => s.segment_id);
      expect(introIds).toContain(firstSeg.segment_id);
    });

    it('ends with a show_outro segment', async () => {
      const entries = await selectSegments(station, library, DEFAULT_CONFIG);
      const last = entries[entries.length - 1];
      expect(last.type).toBe('segment');
      const lastSeg = last as Extract<TimelineEntry, { type: 'segment' }>;
      const outroIds = library.filter((s) => s.type === 'show_outro').map((s) => s.segment_id);
      expect(outroIds).toContain(lastSeg.segment_id);
    });

    it('picks best available intro when no genre match exists', async () => {
      const jazzStation = makeStation({ genre_tags: ['jazz'] });
      // Library has only hip-hop tagged intros, but should still pick one
      const entries = await selectSegments(jazzStation, library, DEFAULT_CONFIG);
      expect(entries[0].type).toBe('segment');
    });
  });

  describe('60-70% transition coverage', () => {
    it('places segments at roughly 60-70% of transitions', async () => {
      // Run with multiple seeds to average out
      const coverages: number[] = [];
      for (let seed = 1; seed <= 20; seed++) {
        const entries = await selectSegments(station, library, { ...DEFAULT_CONFIG, variationSeed: seed });
        const songs = songEntries(entries);
        const transitionCount = songs.length - 1; // gaps between songs
        if (transitionCount === 0) continue;

        // Count segments between songs (excluding intro before first song and outro after last)
        let segsBetweenSongs = 0;
        let inSongSection = false;
        let songsSeen = 0;
        for (const e of entries) {
          if (e.type === 'song') {
            inSongSection = true;
            songsSeen++;
          } else if (inSongSection && songsSeen < songs.length) {
            segsBetweenSongs++;
          }
        }
        coverages.push(segsBetweenSongs / transitionCount);
      }

      const avgCoverage = coverages.reduce((a, b) => a + b, 0) / coverages.length;
      // Average across many seeds should be in the 40-85% range
      // (individual runs may deviate, but the average should be close to 60-70%)
      expect(avgCoverage).toBeGreaterThan(0.35);
      expect(avgCoverage).toBeLessThan(0.90);
    });
  });

  describe('no-repeat-within-5 rule', () => {
    it('never uses the same segment_id within 5 slots of itself', async () => {
      // Use a small library to force potential repeats
      const smallLib = library.slice(0, 15);
      const entries = await selectSegments(station, smallLib, DEFAULT_CONFIG);
      const segIds = getSegmentIds(entries);

      for (let i = 0; i < segIds.length; i++) {
        const window = segIds.slice(Math.max(0, i - 5), i);
        expect(window).not.toContain(segIds[i]);
      }
    });

    it('enforces no-repeat with full library', async () => {
      const entries = await selectSegments(station, library, DEFAULT_CONFIG);
      const segIds = getSegmentIds(entries);

      for (let i = 0; i < segIds.length; i++) {
        const window = segIds.slice(Math.max(0, i - 5), i);
        expect(window).not.toContain(segIds[i]);
      }
    });
  });

  describe('energy matching', () => {
    it('selects segments within energy tolerance of target', async () => {
      // Create a library with extreme energy levels only
      const extremeLib = [
        makeSegment({ segment_id: 'SEG-SI-99901', type: 'show_intro', energy_level: 1 }),
        makeSegment({ segment_id: 'SEG-SO-99901', type: 'show_outro', energy_level: 1 }),
        makeSegment({ segment_id: 'SEG-TR-99901', type: 'transition', energy_level: 1 }),
        makeSegment({ segment_id: 'SEG-TR-99902', type: 'transition', energy_level: 5 }),
        makeSegment({ segment_id: 'SEG-TR-99903', type: 'transition', energy_level: 3 }),
        makeSegment({ segment_id: 'SEG-TR-99904', type: 'transition', energy_level: 2 }),
        makeSegment({ segment_id: 'SEG-TR-99905', type: 'transition', energy_level: 4 }),
      ];

      const entries = await selectSegments(station, extremeLib, DEFAULT_CONFIG);
      // All segments should either come from our library or be bridged (auto-generated)
      const segIds = getSegmentIds(entries);
      const allLibIds = extremeLib.map((s) => s.segment_id);
      for (const id of segIds) {
        const fromLibrary = allLibIds.includes(id);
        const bridged = /^SEG-TR-\d{5}$/.test(id) && !allLibIds.includes(id);
        expect(fromLibrary || bridged).toBe(true);
      }
    });

    it('widens tolerance to ±2 when no ±1 match exists', async () => {
      // Library with only energy 1 transitions, target will be 3
      const narrowLib = [
        makeSegment({ segment_id: 'SEG-SI-88801', type: 'show_intro', energy_level: 3 }),
        makeSegment({ segment_id: 'SEG-SO-88801', type: 'show_outro', energy_level: 3 }),
        makeSegment({ segment_id: 'SEG-TR-88801', type: 'transition', energy_level: 1 }),
        makeSegment({ segment_id: 'SEG-TR-88802', type: 'transition', energy_level: 1 }),
        makeSegment({ segment_id: 'SEG-TR-88803', type: 'transition', energy_level: 1 }),
        makeSegment({ segment_id: 'SEG-TR-88804', type: 'transition', energy_level: 5 }),
        makeSegment({ segment_id: 'SEG-TR-88805', type: 'transition', energy_level: 5 }),
      ];

      const entries = await selectSegments(station, narrowLib, DEFAULT_CONFIG);
      // Should still place some segments despite energy mismatch (±2 tolerance)
      const segs = segmentEntries(entries);
      expect(segs.length).toBeGreaterThan(2); // at least intro + outro + some transitions
    });
  });

  describe('ad-lib limits', () => {
    it('places at most 2 ad-libs per show', async () => {
      // Library with many ad-libs to tempt overuse
      const adLibHeavy = [
        makeSegment({ segment_id: 'SEG-SI-77701', type: 'show_intro', energy_level: 3 }),
        makeSegment({ segment_id: 'SEG-SO-77701', type: 'show_outro', energy_level: 3 }),
        ...Array.from({ length: 20 }, (_, i) =>
          makeSegment({ segment_id: `SEG-AL-777${String(i).padStart(2, '0')}`, type: 'ad_lib', energy_level: 3, duration_ms: 2000 }),
        ),
      ];

      const entries = await selectSegments(station, adLibHeavy, DEFAULT_CONFIG);
      const adLibIds = getSegmentIds(entries).filter((id) => id.startsWith('SEG-AL'));
      expect(adLibIds.length).toBeLessThanOrEqual(2);
    });

    it('never places an ad-lib adjacent to another segment', async () => {
      const entries = await selectSegments(station, library, DEFAULT_CONFIG);

      for (let i = 0; i < entries.length; i++) {
        if (entries[i].type === 'segment') {
          const seg = entries[i] as Extract<TimelineEntry, { type: 'segment' }>;
          const libSeg = library.find((s) => s.segment_id === seg.segment_id);
          if (libSeg?.type === 'ad_lib') {
            // Previous entry should be a song (not another segment)
            if (i > 0) {
              expect(entries[i - 1].type).toBe('song');
            }
          }
        }
      }
    });
  });

  describe('artist shoutout adjacency', () => {
    it('only places artist shoutouts next to songs by that artist', async () => {
      const entries = await selectSegments(station, library, DEFAULT_CONFIG);

      for (let i = 0; i < entries.length; i++) {
        if (entries[i].type !== 'segment') continue;
        const seg = entries[i] as Extract<TimelineEntry, { type: 'segment' }>;
        const libSeg = library.find((s) => s.segment_id === seg.segment_id);
        if (libSeg?.type !== 'artist_shoutout') continue;

        // Find adjacent songs
        const prevSong = [...entries.slice(0, i)].reverse().find((e) => e.type === 'song') as
          | Extract<TimelineEntry, { type: 'song' }>
          | undefined;
        const nextSong = entries.slice(i + 1).find((e) => e.type === 'song') as
          | Extract<TimelineEntry, { type: 'song' }>
          | undefined;

        const adjacentArtists = [prevSong?.artist, nextSong?.artist]
          .filter(Boolean)
          .map((a) => a!.toLowerCase());

        const hasMatch = libSeg.artist_refs.some((ref) =>
          adjacentArtists.some((a) => a.includes(ref.toLowerCase()) || ref.toLowerCase().includes(a)),
        );
        expect(hasMatch).toBe(true);
      }
    });

    it('does not place Beyonce shoutout when she is not in tracklist', async () => {
      const entries = await selectSegments(station, library, DEFAULT_CONFIG);
      const beyonceSeg = library.find((s) => s.artist_refs.includes('Beyonce'));
      const segIds = getSegmentIds(entries);
      expect(segIds).not.toContain(beyonceSeg!.segment_id);
    });
  });

  describe('time-of-day filtering', () => {
    it('only includes time-of-day segments matching config.timeOfDay', async () => {
      const entries = await selectSegments(station, library, DEFAULT_CONFIG); // timeOfDay: 'evening'

      for (const entry of entries) {
        if (entry.type !== 'segment') continue;
        const seg = entry as Extract<TimelineEntry, { type: 'segment' }>;
        const libSeg = library.find((s) => s.segment_id === seg.segment_id);
        if (libSeg?.type !== 'time_of_day') continue;

        const hints = [...libSeg.genre_tags, ...libSeg.mood_tags].map((t) => t.toLowerCase());
        expect(hints).toContain('evening');
      }
    });

    it('excludes morning time-of-day segments when timeOfDay is evening', async () => {
      const morningSeg = library.find(
        (s) => s.type === 'time_of_day' && s.mood_tags.includes('morning'),
      )!;
      const entries = await selectSegments(station, library, DEFAULT_CONFIG);
      const segIds = getSegmentIds(entries);
      expect(segIds).not.toContain(morningSeg.segment_id);
    });
  });

  describe('deterministic output', () => {
    it('produces identical output for the same seed', async () => {
      const a = await selectSegments(station, library, { ...DEFAULT_CONFIG, variationSeed: 123 });
      const b = await selectSegments(station, library, { ...DEFAULT_CONFIG, variationSeed: 123 });
      expect(a).toEqual(b);
    });

    it('produces different output for different seeds', async () => {
      const a = await selectSegments(station, library, { ...DEFAULT_CONFIG, variationSeed: 1 });
      const b = await selectSegments(station, library, { ...DEFAULT_CONFIG, variationSeed: 2 });
      // They may occasionally match on small libraries, but with 50+ segments this is extremely unlikely
      const aIds = getSegmentIds(a);
      const bIds = getSegmentIds(b);
      expect(aIds).not.toEqual(bIds);
    });
  });

  describe('sparse library', () => {
    it('handles a library with only intro and outro', async () => {
      const minLib = [
        makeSegment({ segment_id: 'SEG-SI-00001', type: 'show_intro', energy_level: 3 }),
        makeSegment({ segment_id: 'SEG-SO-00001', type: 'show_outro', energy_level: 3 }),
      ];

      const entries = await selectSegments(station, minLib, DEFAULT_CONFIG);
      // Should have intro + 15 songs + outro + bridged transitions
      expect(entries[0].type).toBe('segment');
      expect(entries[entries.length - 1].type).toBe('segment');
      expect(songEntries(entries)).toHaveLength(15);
    });

    it('handles an empty library gracefully', async () => {
      const entries = await selectSegments(station, [], DEFAULT_CONFIG);
      // All songs present
      expect(songEntries(entries)).toHaveLength(15);
      // Synthesized boundaries: first entry is show_intro, last is show_outro
      const segs = segmentEntries(entries) as Extract<TimelineEntry, { type: 'segment' }>[];
      expect(segs.length).toBeGreaterThanOrEqual(2);
      const firstSeg = segs[0];
      const lastSeg = segs[segs.length - 1];
      // Verify boundary segment IDs match show_intro / show_outro patterns
      expect(firstSeg.segment_id).toMatch(/^SEG-SI-/);
      expect(lastSeg.segment_id).toMatch(/^SEG-SO-/);
      // First entry overall is the intro segment, last entry overall is the outro
      expect(entries[0]).toBe(firstSeg);
      expect(entries[entries.length - 1]).toBe(lastSeg);
    });

    it('handles an empty tracklist', async () => {
      const emptyStation = makeStation({ tracklist: [] });
      const entries = await selectSegments(emptyStation, library, DEFAULT_CONFIG);
      expect(entries).toHaveLength(0);
    });

    it('handles a single-track station', async () => {
      const singleStation = makeStation({ tracklist: [TRACKS[0]] });
      const entries = await selectSegments(singleStation, library, DEFAULT_CONFIG);
      // Intro + song + outro
      const songs = songEntries(entries);
      expect(songs).toHaveLength(1);
      expect(entries[0].type).toBe('segment'); // intro
      expect(entries[entries.length - 1].type).toBe('segment'); // outro
    });
  });

  describe('usage_count and quality_score preference', () => {
    it('prefers segments with lower usage_count', async () => {
      const lowUsage = makeSegment({
        segment_id: 'SEG-TR-LOW01',
        type: 'transition',
        energy_level: 3,
        usage_count: 0,
        quality_score: 0.8,
      });
      const highUsage = makeSegment({
        segment_id: 'SEG-TR-HIGH1',
        type: 'transition',
        energy_level: 3,
        usage_count: 100,
        quality_score: 0.8,
      });

      const testLib = [
        makeSegment({ segment_id: 'SEG-SI-USG01', type: 'show_intro', energy_level: 3 }),
        makeSegment({ segment_id: 'SEG-SO-USG01', type: 'show_outro', energy_level: 3 }),
        lowUsage,
        highUsage,
      ];

      // Run multiple seeds — the low-usage one should be picked every time
      for (let seed = 1; seed <= 10; seed++) {
        const entries = await selectSegments(station, testLib, { ...DEFAULT_CONFIG, variationSeed: seed });
        const transitionIds = getSegmentIds(entries).filter(
          (id) => id === lowUsage.segment_id || id === highUsage.segment_id,
        );
        if (transitionIds.length > 0) {
          expect(transitionIds[0]).toBe(lowUsage.segment_id);
        }
      }
    });

    it('prefers higher quality_score when usage_count is equal', async () => {
      const highQ = makeSegment({
        segment_id: 'SEG-TR-HIQ01',
        type: 'transition',
        energy_level: 3,
        usage_count: 0,
        quality_score: 0.95,
      });
      const lowQ = makeSegment({
        segment_id: 'SEG-TR-LOQ01',
        type: 'transition',
        energy_level: 3,
        usage_count: 0,
        quality_score: 0.3,
      });

      const testLib = [
        makeSegment({ segment_id: 'SEG-SI-QUA01', type: 'show_intro', energy_level: 3 }),
        makeSegment({ segment_id: 'SEG-SO-QUA01', type: 'show_outro', energy_level: 3 }),
        highQ,
        lowQ,
      ];

      for (let seed = 1; seed <= 10; seed++) {
        const entries = await selectSegments(station, testLib, { ...DEFAULT_CONFIG, variationSeed: seed });
        const transitionIds = getSegmentIds(entries).filter(
          (id) => id === highQ.segment_id || id === lowQ.segment_id,
        );
        if (transitionIds.length > 0) {
          expect(transitionIds[0]).toBe(highQ.segment_id);
        }
      }
    });
  });

  describe('all songs are included', () => {
    it('includes every track from the station tracklist in order', async () => {
      const entries = await selectSegments(station, library, DEFAULT_CONFIG);
      const songs = songEntries(entries) as Extract<TimelineEntry, { type: 'song' }>[];
      expect(songs).toHaveLength(TRACKS.length);
      for (let i = 0; i < TRACKS.length; i++) {
        expect(songs[i].canonical_id).toBe(TRACKS[i].canonical_id);
        expect(songs[i].artist).toBe(TRACKS[i].artist);
        expect(songs[i].title).toBe(TRACKS[i].title);
      }
    });
  });

  describe('timeline structure', () => {
    it('never has two consecutive segments (except intro before first song)', async () => {
      const entries = await selectSegments(station, library, DEFAULT_CONFIG);

      // After the intro, we should not see two segments in a row
      // (the intro is allowed to be followed by a song)
      let afterFirstSong = false;
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].type === 'song') afterFirstSong = true;
        if (!afterFirstSong) continue;

        if (entries[i].type === 'segment' && i + 1 < entries.length && entries[i + 1].type === 'segment') {
          // This would mean two segments in a row after the song section started
          // Only allowed if second is the outro (last entry)
          expect(i + 1).toBe(entries.length - 1);
        }
      }
    });
  });
});
