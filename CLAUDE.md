# ONAY — AI-Powered Radio Platform

## What is this?

Onay is an AI-powered radio app where a DJ personality (Onay) hosts curated music stations with voice commentary, transitions, and contextual insights. The app plays music from Apple Music or Spotify while interleaving pre-produced DJ voice segments between songs.

This is NOT a real-time generation system. All voice segments are pre-produced in batch, stored in a library, and assembled into show timelines ahead of time. Users stream the finished product.

## Architecture Overview

Three layers:

1. **Content Layer** — Batch-produces Onay's voice segments offline using Chatterbox TTS on a local GPU. Scripts are LLM-generated, sent through TTS, quality-scored, and curated into a segment library.
2. **Assembly Layer** — Takes a station's tracklist + the segment library and produces a show timeline. An LLM selects which segments go between which songs. Output is a JSON timeline manifest.
3. **Delivery Layer** — The mobile app reads a timeline manifest and orchestrates playback: songs via the user's music provider SDK, Onay segments via direct audio playback.

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile app | React Native + Expo (iOS first) |
| Tooling web app | React (Station Manager, Segment Studio, Assembly Dashboard) |
| Backend API | Express + TypeScript |
| Database | PostgreSQL (or SQLite for MVP) |
| TTS | Chatterbox by Resemble AI (self-hosted, MIT licensed) |
| LLM | Ollama (local) for scripts, cloud API (Gemini) as fallback |
| Music providers | Apple Music (MusicKit), Spotify (Spotify SDK) |
| Hosting | Hostinger VPS |
| CDN | Cloudflare or BunnyCDN |

## Repo Structure

```
onay/
├── apps/
│   ├── mobile/          # React Native/Expo iOS app
│   └── tools/           # Station Manager, Segment Studio, Assembly Dashboard (web)
├── packages/
│   ├── core/            # Shared types, segment schema, timeline format
│   ├── assembly/        # Assembly pipeline logic
│   └── tts/             # Chatterbox integration, batch generation scripts
├── services/
│   └── api/             # Express/TypeScript backend
├── docs/                # PRD, architecture docs
├── .github/
│   └── workflows/       # CI/CD
└── package.json         # Workspace root
```

## Key Data Structures

### Segment Metadata

```typescript
interface Segment {
  segment_id: string;          // e.g., "SEG-TR-00412"
  type: SegmentType;           // show_intro | show_outro | song_intro | transition | artist_shoutout | genre_vibe | fun_fact | hot_take | time_of_day | ad_lib | seasonal
  genre_tags: string[];        // e.g., ["hip-hop", "r&b"]
  mood_tags: string[];         // e.g., ["chill", "late-night"]
  artist_refs: string[];       // e.g., ["SZA", "Frank Ocean"]
  energy_level: number;        // 1-5
  duration_ms: number;
  quality_score: number;       // 0.0-1.0
  exaggeration_level: number;  // Chatterbox emotion parameter used
  created_at: string;          // ISO timestamp
  usage_count: number;
  audio_url: string;
  script_text: string;
}
```

### Timeline Manifest

```typescript
interface TimelineManifest {
  station_id: string;
  created_at: string;
  entries: TimelineEntry[];
}

type TimelineEntry =
  | { type: "song"; canonical_id: string; artist: string; title: string; isrc?: string; duration_ms: number }
  | { type: "segment"; segment_id: string; audio_url: string; duration_ms: number };
```

### Station

```typescript
interface Station {
  station_id: string;
  name: string;
  description: string;
  genre_tags: string[];
  mood_tags: string[];
  cover_art_url: string;
  rotation_schedule: RotationSchedule;
  tracklist: TracklistEntry[];
  provider_availability: {
    apple_music: Record<string, string | null>;  // canonical_id -> AM catalog ID
    spotify: Record<string, string | null>;       // canonical_id -> Spotify track ID
  };
}
```

## Music Provider Abstraction

Songs are referenced by canonical ID (artist + title + optional ISRC) in timelines. At playback time, the mobile app resolves to the user's provider:

- Apple Music: MusicKit catalog search
- Spotify: Spotify Web API track search
- If unavailable: skip song, adjust segment flow (no dead air)

The Station Manager pre-computes availability mappings at station build time.

## Chatterbox TTS Usage

- **Full model (0.5B):** Used for production segment generation. Maximum quality.
- **Turbo model (350M):** Used for previews and iteration in Segment Studio. Supports paralinguistic tags (`[laugh]`, `[chuckle]`, `[cough]`).
- **Voice cloning:** All generation uses Onay's reference WAV (~10 seconds) for consistent voice identity.
- **Emotion exaggeration:** Parameter controls intensity. Vary across takes for the same script to get different energy levels.

## Assembly Rules

When assembling a show timeline, follow these constraints:

- Never repeat the same segment within 5 slots of itself.
- Match segment energy_level to surrounding songs (±1 level tolerance).
- Show must start with a show_intro and end with a show_outro.
- Don't place segments between every song — let music breathe. Target 60-70% of transitions having a segment.
- Ad-libs are filler only — max 2 per show, never back-to-back with another segment.
- Artist shoutouts should only appear adjacent to a song by that artist.
- Time-of-day segments should match the station's rotation schedule target.

## Three Core Tools

### Station Manager
Build and schedule stations. AI generates tracklists from vibe/genre descriptions, checks cross-provider availability, suggests rotation schedules.

### Segment Studio
Produce Onay's voice library. AI writes scripts → Chatterbox batch TTS → quality scoring → operator review queue. Supports A/B comparison, emotion slider, bulk operations.

### Assembly Dashboard
AI assembles show timelines from tracklist + segment library. Visual timeline editor, preview playback, segment swapping, publish flow.

## Phase 2: Social Layer (not yet in scope)

User-curated playlists that run through the same assembly pipeline. Sharing, follows, activity feed, collaborative playlists. Build this AFTER the core station model is proven.

## Development Conventions

- **Branching:** `main` (deployable) ← `dev` (integration) ← `feature/*` branches
- **PRs:** All merges via squash merge PR into `dev`, then `dev` into `main` for releases
- **Testing:** Vitest for unit tests, Supertest for API integration tests
- **Linting:** ESLint + Prettier
- **Type safety:** Strict TypeScript throughout (`strict: true`)
- **Versioning:** Semver — current target is v0.1.0 (Chatterbox + schema + first segments)

## Current Phase

**Phase 1: Foundation** — Set up Chatterbox, define schemas, build Segment Studio MVP, produce initial segment library (300-500 segments for hip-hop/R&B), build Station Manager MVP, build assembly pipeline MVP, deploy first test station.
