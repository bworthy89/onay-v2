import { describe, it, expect, vi } from 'vitest';
import type { Station, SegmentType } from '@onay/core';
import type { LLMClient, ScriptGenRequest } from './scriptgen.js';
import { buildPrompt, parseResponse, generateScripts, StubLLMClient } from './scriptgen.js';
import { TEMPLATE_BANK, getExamples, getRandomTemplates } from './templates.js';

// --- Test Fixtures ---

const testStation: Station = {
  station_id: 'station-test-001',
  name: 'Hip-Hop Heat',
  description: 'The hottest hip-hop tracks, curated with taste.',
  genre_tags: ['hip-hop', 'rap'],
  mood_tags: ['energetic', 'confident'],
  cover_art_url: '/covers/hiphop-heat.jpg',
  rotation_schedule: { frequency: 'daily', time_of_day_target: 'evening', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  tracklist: [
    { canonical_id: 'track-1', artist: 'Kendrick Lamar', title: 'HUMBLE.', duration_ms: 177000 },
    { canonical_id: 'track-2', artist: 'SZA', title: 'Kill Bill', duration_ms: 153000 },
    { canonical_id: 'track-3', artist: 'Drake', title: 'God\'s Plan', duration_ms: 199000 },
    { canonical_id: 'track-4', artist: 'Tyler, The Creator', title: 'EARFQUAKE', duration_ms: 190000 },
    { canonical_id: 'track-5', artist: 'Megan Thee Stallion', title: 'Savage', duration_ms: 161000 },
  ],
  provider_availability: {
    apple_music: {},
    spotify: {},
  },
};

function makeRequest(overrides: Partial<ScriptGenRequest> = {}): ScriptGenRequest {
  return {
    station: testStation,
    targetTypes: ['transition', 'song_intro'] as SegmentType[],
    countsPerType: 3,
    ...overrides,
  };
}

// --- Template Bank Tests ---

describe('TEMPLATE_BANK', () => {
  const allTypes: SegmentType[] = [
    'show_intro', 'show_outro', 'song_intro', 'transition',
    'artist_shoutout', 'genre_vibe', 'fun_fact', 'hot_take',
    'time_of_day', 'ad_lib', 'seasonal',
  ];

  it('has templates for every segment type', () => {
    for (const type of allTypes) {
      expect(TEMPLATE_BANK[type]).toBeDefined();
      expect(TEMPLATE_BANK[type].length).toBeGreaterThanOrEqual(10);
    }
  });

  it('all templates have required fields', () => {
    for (const type of allTypes) {
      for (const template of TEMPLATE_BANK[type]) {
        expect(template.script_text).toBeTruthy();
        expect(template.type).toBe(type);
        expect(template.energy_level).toBeGreaterThanOrEqual(1);
        expect(template.energy_level).toBeLessThanOrEqual(5);
      }
    }
  });

  it('getExamples returns correct count per type', () => {
    const examples = getExamples(['transition', 'song_intro'], 2);
    // 2 types × 2 per type = 4
    expect(examples.length).toBe(4);
    expect(examples.filter((e) => e.type === 'transition').length).toBe(2);
    expect(examples.filter((e) => e.type === 'song_intro').length).toBe(2);
  });

  it('getRandomTemplates returns correct total count', () => {
    const templates = getRandomTemplates(['show_intro', 'show_outro'], 5);
    expect(templates.length).toBe(10);
    expect(templates.filter((t) => t.type === 'show_intro').length).toBe(5);
    expect(templates.filter((t) => t.type === 'show_outro').length).toBe(5);
  });
});

// --- buildPrompt Tests ---

describe('buildPrompt', () => {
  it('includes system prompt with Onay character description', () => {
    const { system } = buildPrompt(makeRequest());
    expect(system).toContain('Onay');
    expect(system).toContain('warm, magnetic');
    expect(system).toContain('hip-hop and R&B');
    expect(system).toContain('JSON array');
  });

  it('includes few-shot examples from template bank', () => {
    const { system } = buildPrompt(makeRequest());
    expect(system).toContain('examples');
    expect(system).toContain('script_text');
    expect(system).toContain('energy_level');
  });

  it('includes station context in user prompt', () => {
    const { user } = buildPrompt(makeRequest());
    expect(user).toContain('Hip-Hop Heat');
    expect(user).toContain('hip-hop, rap');
    expect(user).toContain('energetic, confident');
  });

  it('includes tracklist in user prompt', () => {
    const { user } = buildPrompt(makeRequest());
    expect(user).toContain('Kendrick Lamar');
    expect(user).toContain('HUMBLE.');
    expect(user).toContain('SZA');
    expect(user).toContain('Kill Bill');
  });

  it('includes requested segment types and counts', () => {
    const { user } = buildPrompt(makeRequest());
    expect(user).toContain('transition: 3 scripts');
    expect(user).toContain('song_intro: 3 scripts');
    expect(user).toContain('3 scripts per type');
  });

  it('includes total script count', () => {
    const { user } = buildPrompt(makeRequest({ countsPerType: 5 }));
    expect(user).toContain('10 scripts');
  });

  it('includes style guidance when provided', () => {
    const { system } = buildPrompt(makeRequest({ style: 'Extra hype and party-focused' }));
    expect(system).toContain('Extra hype and party-focused');
  });

  it('omits style guidance when not provided', () => {
    const { system } = buildPrompt(makeRequest());
    expect(system).not.toContain('Additional style guidance');
  });
});

// --- parseResponse Tests ---

describe('parseResponse', () => {
  it('parses valid JSON array', () => {
    const input = JSON.stringify([
      { script_text: 'What a vibe tonight.', type: 'transition', energy_level: 3 },
      { script_text: 'This next one goes hard.', type: 'song_intro', energy_level: 4 },
    ]);
    const result = parseResponse(input);
    expect(result).toHaveLength(2);
    expect(result[0].script_text).toBe('What a vibe tonight.');
    expect(result[0].type).toBe('transition');
    expect(result[0].energy_level).toBe(3);
  });

  it('extracts JSON from surrounding text', () => {
    const input = `Here are the scripts you requested:

[
  {"script_text": "We riding tonight.", "type": "transition", "energy_level": 3}
]

Hope these work!`;
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].script_text).toBe('We riding tonight.');
  });

  it('skips items with invalid type', () => {
    const input = JSON.stringify([
      { script_text: 'Valid one.', type: 'transition', energy_level: 3 },
      { script_text: 'Bad type.', type: 'invalid_type', energy_level: 3 },
    ]);
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('transition');
  });

  it('skips items with energy out of range', () => {
    const input = JSON.stringify([
      { script_text: 'Too low.', type: 'transition', energy_level: 0 },
      { script_text: 'Too high.', type: 'transition', energy_level: 6 },
      { script_text: 'Just right.', type: 'transition', energy_level: 3 },
    ]);
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
    expect(result[0].script_text).toBe('Just right.');
  });

  it('skips items with empty script_text', () => {
    const input = JSON.stringify([
      { script_text: '', type: 'transition', energy_level: 3 },
      { script_text: '  ', type: 'transition', energy_level: 3 },
      { script_text: 'Has content.', type: 'transition', energy_level: 3 },
    ]);
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
  });

  it('skips items with missing fields', () => {
    const input = JSON.stringify([
      { script_text: 'No type.' },
      { type: 'transition', energy_level: 3 },
      { script_text: 'Complete.', type: 'transition', energy_level: 3 },
    ]);
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
  });

  it('rounds fractional energy levels', () => {
    const input = JSON.stringify([
      { script_text: 'Fractional.', type: 'transition', energy_level: 3.7 },
    ]);
    const result = parseResponse(input);
    expect(result[0].energy_level).toBe(4);
  });

  it('returns empty array for completely unparseable input', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = parseResponse('This is just random text with no structure.');
    expect(result).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it('extracts scripts from free-form text with quoted strings', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const input = `Here are some scripts:
"We moving to the next vibe." - transition, energy: 3
"This next song goes crazy." - song_intro, energy: 4`;
    const result = parseResponse(input);
    expect(result).toHaveLength(2);
    expect(result[0].script_text).toBe('We moving to the next vibe.');
    expect(result[0].type).toBe('transition');
    expect(result[1].type).toBe('song_intro');
    warnSpy.mockRestore();
  });

  it('handles JSON with extra whitespace', () => {
    const input = `
    [
      { "script_text": "Spaced out.", "type": "ad_lib", "energy_level": 2 }
    ]
    `;
    const result = parseResponse(input);
    expect(result).toHaveLength(1);
  });
});

// --- generateScripts Tests ---

describe('generateScripts', () => {
  it('returns GenerationJob array from LLM response', async () => {
    const mockLLM: LLMClient = {
      complete: async () =>
        JSON.stringify([
          { script_text: 'Smooth transition here.', type: 'transition', energy_level: 3 },
          { script_text: 'Up next is fire.', type: 'song_intro', energy_level: 4 },
        ]),
    };

    const result = await generateScripts(makeRequest(), mockLLM);
    expect(result.scripts).toHaveLength(2);

    const [first, second] = result.scripts;
    expect(first.script_text).toBe('Smooth transition here.');
    expect(first.type).toBe('transition');
    expect(first.takes).toBe(3);
    expect(first.genre_tags).toEqual(['hip-hop', 'rap']);
    expect(first.mood_tags).toEqual(['energetic', 'confident']);

    expect(second.type).toBe('song_intro');
  });

  it('applies station genre_tags and mood_tags to all jobs', async () => {
    const mockLLM: LLMClient = {
      complete: async () =>
        JSON.stringify([
          { script_text: 'Test.', type: 'transition', energy_level: 2 },
        ]),
    };

    const result = await generateScripts(makeRequest(), mockLLM);
    expect(result.scripts[0].genre_tags).toEqual(['hip-hop', 'rap']);
    expect(result.scripts[0].mood_tags).toEqual(['energetic', 'confident']);
  });

  it('sets exaggeration_levels based on energy_level', async () => {
    const mockLLM: LLMClient = {
      complete: async () =>
        JSON.stringify([
          { script_text: 'Low energy.', type: 'transition', energy_level: 1 },
          { script_text: 'Mid energy.', type: 'transition', energy_level: 3 },
          { script_text: 'High energy.', type: 'transition', energy_level: 5 },
        ]),
    };

    const result = await generateScripts(makeRequest(), mockLLM);
    expect(result.scripts[0].exaggeration_levels).toEqual([0.2, 0.4]); // low
    expect(result.scripts[1].exaggeration_levels).toEqual([0.4, 0.6]); // mid
    expect(result.scripts[2].exaggeration_levels).toEqual([0.6, 0.8]); // high
  });

  it('sets takes to 3 for all scripts', async () => {
    const mockLLM: LLMClient = {
      complete: async () =>
        JSON.stringify([
          { script_text: 'A.', type: 'song_intro', energy_level: 3 },
          { script_text: 'B.', type: 'transition', energy_level: 4 },
        ]),
    };

    const result = await generateScripts(makeRequest(), mockLLM);
    for (const job of result.scripts) {
      expect(job.takes).toBe(3);
    }
  });

  it('extracts artist_refs from script text matching tracklist', async () => {
    const mockLLM: LLMClient = {
      complete: async () =>
        JSON.stringify([
          { script_text: 'Shoutout to SZA for this one.', type: 'artist_shoutout', energy_level: 3 },
          { script_text: 'No artist mentioned here.', type: 'transition', energy_level: 3 },
        ]),
    };

    const result = await generateScripts(makeRequest(), mockLLM);
    expect(result.scripts[0].artist_refs).toEqual(['SZA']);
    expect(result.scripts[1].artist_refs).toEqual([]);
  });

  it('handles empty LLM response gracefully', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockLLM: LLMClient = {
      complete: async () => 'Sorry, I cannot generate scripts right now.',
    };

    const result = await generateScripts(makeRequest(), mockLLM);
    expect(result.scripts).toHaveLength(0);
    warnSpy.mockRestore();
  });

  it('does not duplicate artist_refs', async () => {
    const mockLLM: LLMClient = {
      complete: async () =>
        JSON.stringify([
          { script_text: 'SZA and SZA again — double the vibes.', type: 'artist_shoutout', energy_level: 3 },
        ]),
    };

    const result = await generateScripts(makeRequest(), mockLLM);
    expect(result.scripts[0].artist_refs).toEqual(['SZA']);
  });
});

// --- StubLLMClient Tests ---

describe('StubLLMClient', () => {
  it('returns valid JSON with scripts matching requested types', async () => {
    const stub = new StubLLMClient();
    const { system, user } = buildPrompt(makeRequest({
      targetTypes: ['transition', 'song_intro'],
      countsPerType: 2,
    }));

    const response = await stub.complete(system, user);
    const parsed = JSON.parse(response);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(4); // 2 types × 2 per type

    for (const item of parsed) {
      expect(item.script_text).toBeTruthy();
      expect(['transition', 'song_intro']).toContain(item.type);
      expect(item.energy_level).toBeGreaterThanOrEqual(1);
      expect(item.energy_level).toBeLessThanOrEqual(5);
    }
  });

  it('works end-to-end with generateScripts', async () => {
    const stub = new StubLLMClient();
    const request = makeRequest({
      targetTypes: ['show_intro', 'transition'],
      countsPerType: 2,
    });

    const result = await generateScripts(request, stub);
    expect(result.scripts.length).toBeGreaterThan(0);

    for (const job of result.scripts) {
      expect(job.script_text).toBeTruthy();
      expect(job.takes).toBe(3);
      expect(job.genre_tags).toEqual(['hip-hop', 'rap']);
      expect(job.exaggeration_levels.length).toBe(2);
    }
  });
});
