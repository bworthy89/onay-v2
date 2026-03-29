import type { Station, SegmentType } from '@onay/core';
import type { GenerationJob } from './types.js';
import { getExamples, getRandomTemplates } from './templates.js';

// --- Types ---

export interface ScriptGenRequest {
  station: Station;
  targetTypes: SegmentType[];
  countsPerType: number;
  style?: string;
}

export interface ScriptGenResult {
  scripts: GenerationJob[];
}

export interface LLMClient {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}

interface ParsedScript {
  script_text: string;
  type: SegmentType;
  energy_level: number;
}

// --- Stub LLM Client ---

/**
 * Returns pre-written scripts from the template bank.
 * Used for development/testing without a real LLM.
 */
export class StubLLMClient implements LLMClient {
  async complete(_systemPrompt: string, _userPrompt: string): Promise<string> {
    // Parse the user prompt to extract requested types and counts
    const types = extractTypesFromPrompt(_userPrompt);
    const count = extractCountFromPrompt(_userPrompt);
    const templates = getRandomTemplates(types, count);

    const scripts: ParsedScript[] = templates.map((t) => ({
      script_text: t.script_text,
      type: t.type,
      energy_level: t.energy_level,
    }));

    return JSON.stringify(scripts);
  }
}

function extractTypesFromPrompt(prompt: string): SegmentType[] {
  const validTypes: SegmentType[] = [
    'show_intro', 'show_outro', 'song_intro', 'transition',
    'artist_shoutout', 'genre_vibe', 'fun_fact', 'hot_take',
    'time_of_day', 'ad_lib', 'seasonal',
  ];
  return validTypes.filter((t) => prompt.includes(t));
}

function extractCountFromPrompt(prompt: string): number {
  const match = prompt.match(/(\d+)\s+scripts?\s+per\s+type/i);
  return match ? parseInt(match[1], 10) : 3;
}

// --- Prompt Building ---

const SYSTEM_PROMPT_BASE = `You are writing scripts for Onay, an AI radio DJ. She is warm, magnetic, rooted in hip-hop and R&B culture. She's knowledgeable, opinionated, and genuine — never robotic or generic. She speaks conversationally, with natural rhythm.

Your job is to write short spoken-word scripts that Onay will read aloud between songs on her radio station. Each script should feel natural, like something a real DJ would say on air.

Guidelines:
- Keep scripts between 1-4 sentences
- Write conversationally — contractions, natural pauses, personality
- Match the energy level to the mood (1 = mellow/quiet, 5 = hype/loud)
- Reference genres, moods, and artists when relevant to the station
- Never be generic or corporate-sounding
- Ad-libs should be very short (under 10 words)
- Show intros/outros should address the listener directly

Respond with a JSON array of objects. Each object must have exactly these fields:
- "script_text": the spoken script (string)
- "type": the segment type (string)
- "energy_level": energy from 1-5 (number)

Respond ONLY with the JSON array, no other text.`;

export function buildPrompt(request: ScriptGenRequest): { system: string; user: string } {
  const { station, targetTypes, countsPerType, style } = request;

  // Build system prompt with few-shot examples
  const examples = getExamples(targetTypes, 3);
  let system = SYSTEM_PROMPT_BASE;

  if (examples.length > 0) {
    system += '\n\nHere are examples of good scripts in Onay\'s voice:\n\n';
    system += JSON.stringify(
      examples.map((e) => ({
        script_text: e.script_text,
        type: e.type,
        energy_level: e.energy_level,
      })),
      null,
      2,
    );
  }

  if (style) {
    system += `\n\nAdditional style guidance: ${style}`;
  }

  // Build user prompt with station context
  const tracklist = station.tracklist
    .map((t, i) => `${i + 1}. ${t.artist} — ${t.title}`)
    .join('\n');

  const typesRequested = targetTypes
    .map((t) => `- ${t}: ${countsPerType} scripts`)
    .join('\n');

  const totalScripts = targetTypes.length * countsPerType;

  const user = `Write ${totalScripts} scripts for the station "${station.name}".

Station description: ${station.description}
Genres: ${station.genre_tags.join(', ')}
Moods: ${station.mood_tags.join(', ')}

Tracklist:
${tracklist}

Generate the following (${countsPerType} scripts per type):
${typesRequested}

Respond with a JSON array of ${totalScripts} script objects.`;

  return { system, user };
}

// --- Response Parsing ---

const VALID_TYPES: Set<string> = new Set([
  'show_intro', 'show_outro', 'song_intro', 'transition',
  'artist_shoutout', 'genre_vibe', 'fun_fact', 'hot_take',
  'time_of_day', 'ad_lib', 'seasonal',
]);

export function parseResponse(response: string): ParsedScript[] {
  // Try JSON parsing first
  const trimmed = response.trim();

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return validateParsedScripts(parsed);
    }
  } catch {
    // Not valid JSON — try extraction
  }

  // Try extracting JSON array from surrounding text
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        console.warn('[scriptgen] Extracted JSON from free-form response');
        return validateParsedScripts(parsed);
      }
    } catch {
      // Extraction failed too
    }
  }

  // Try line-by-line extraction from free-form text
  const freeFormScripts = extractFromFreeForm(trimmed);
  if (freeFormScripts.length > 0) {
    console.warn('[scriptgen] Parsed scripts from free-form text');
    return freeFormScripts;
  }

  console.warn('[scriptgen] Could not parse LLM response');
  return [];
}

function validateParsedScripts(items: unknown[]): ParsedScript[] {
  const results: ParsedScript[] = [];
  for (const item of items) {
    if (
      typeof item === 'object' &&
      item !== null &&
      'script_text' in item &&
      'type' in item &&
      'energy_level' in item
    ) {
      const obj = item as Record<string, unknown>;
      const scriptText = String(obj.script_text).trim();
      const type = String(obj.type);
      const energyLevel = Number(obj.energy_level);

      if (scriptText && VALID_TYPES.has(type) && energyLevel >= 1 && energyLevel <= 5) {
        results.push({
          script_text: scriptText,
          type: type as SegmentType,
          energy_level: Math.round(energyLevel),
        });
      } else {
        console.warn(`[scriptgen] Skipping invalid script: type="${type}", energy=${energyLevel}`);
      }
    }
  }
  return results;
}

function extractFromFreeForm(text: string): ParsedScript[] {
  // Try to find quoted strings that look like scripts
  const results: ParsedScript[] = [];
  const lines = text.split('\n').filter((l) => l.trim());

  for (const line of lines) {
    // Look for patterns like: "script text" (type, energy: N)
    const match = line.match(/"([^"]+)"\s*.*?(show_intro|show_outro|song_intro|transition|artist_shoutout|genre_vibe|fun_fact|hot_take|time_of_day|ad_lib|seasonal).*?(\d)/);
    if (match) {
      results.push({
        script_text: match[1],
        type: match[2] as SegmentType,
        energy_level: Math.min(5, Math.max(1, parseInt(match[3], 10))),
      });
    }
  }

  return results;
}

// --- Main Generation Function ---

function getDefaultExaggerationLevels(energyLevel: number): number[] {
  if (energyLevel <= 2) return [0.2, 0.4];
  if (energyLevel <= 3) return [0.4, 0.6];
  return [0.6, 0.8];
}

export async function generateScripts(
  request: ScriptGenRequest,
  llm: LLMClient,
): Promise<ScriptGenResult> {
  const { system, user } = buildPrompt(request);
  const response = await llm.complete(system, user);
  const parsed = parseResponse(response);

  const scripts: GenerationJob[] = parsed.map((script) => ({
    script_text: script.script_text,
    type: script.type,
    genre_tags: [...request.station.genre_tags],
    mood_tags: [...request.station.mood_tags],
    artist_refs: extractArtistRefs(script, request.station),
    energy_level: script.energy_level,
    takes: 3,
    exaggeration_levels: getDefaultExaggerationLevels(script.energy_level),
  }));

  return { scripts };
}

/**
 * If the script mentions an artist from the station's tracklist, include them as refs.
 */
function extractArtistRefs(script: ParsedScript, station: Station): string[] {
  const refs: string[] = [];
  const scriptLower = script.script_text.toLowerCase();
  for (const track of station.tracklist) {
    if (scriptLower.includes(track.artist.toLowerCase())) {
      if (!refs.includes(track.artist)) {
        refs.push(track.artist);
      }
    }
  }
  return refs;
}
