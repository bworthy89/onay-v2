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
│   ├── mobile/                    # React Native/Expo iOS app (migrated from v1)
│   │   ├── app/                   # Expo Router layouts & routes
│   │   │   ├── (auth)/            # Login flow
│   │   │   ├── (onboarding)/      # Welcome, music auth, setup
│   │   │   └── (main)/            # Tab groups: broadcast, arc, archive, cleo
│   │   ├── src/
│   │   │   ├── tokens/            # Design tokens (colors, typography, spacing)
│   │   │   ├── components/        # 15 shared UI components
│   │   │   ├── screens/           # 7 screen implementations
│   │   │   ├── hooks/             # useAppActive, etc.
│   │   │   ├── services/          # Storage, AuthService, api, MusicProvider
│   │   │   ├── engines/           # SessionEngine, AudioCoordinator, QueueManager, etc.
│   │   │   ├── cleo/              # Vibe definitions, fallbacks
│   │   │   └── config/            # Feature flags
│   │   ├── assets/                # Icons, splash, Onay frames, textures
│   │   └── app.json
│   └── tools/                     # Station Manager, Segment Studio, Assembly Dashboard (web)
├── packages/
│   ├── core/                      # Shared types, segment schema, timeline format
│   ├── assembly/                  # Assembly pipeline logic
│   └── tts/                       # Chatterbox integration, batch generation scripts
├── services/
│   └── api/                       # Express/TypeScript backend
├── docs/                          # PRD, architecture decisions
│   └── design-reference/          # v1 UI screenshots for visual QA
├── v2-migration/                  # Migration scripts and stubs (from v1)
├── .github/
│   └── workflows/                 # CI/CD
├── CLAUDE.md
└── package.json                   # Workspace root
```

## V1 → V2 UI Migration

The mobile app UI is carried over from v1, NOT rebuilt from scratch. A migration kit (`v2-migration/`) extracted all UI files (50+ files: 15 components, 7 screens, 20 routing files, design tokens, assets). Service and engine dependencies are replaced with stub files that have `// TODO:` markers.

**The job is to implement the stubs against the v2 backend, not to rebuild the UI.**

### Stubs to Implement

These are in `apps/mobile/src/services/` and `apps/mobile/src/engines/`. Each has an interface that the existing screens already import and use. Implement the interface — don't change the screens.

| Stub | Location | What It Does |
|---|---|---|
| Storage | services/Storage.ts | MMKV persistence (already functional, may need new keys) |
| AuthService | services/AuthService.ts | Auth state, sign-in, JWT tokens |
| api | services/api.ts | authenticatedFetch — point to v2 API base URL |
| MusicProvider | services/music/MusicProvider.ts | Playback abstraction over Apple Music + Spotify |
| SessionEngine | engines/SessionEngine.ts | Session state, phase tracking, track advancement |
| AudioCoordinator | engines/AudioCoordinator.ts | Segment audio playback, music ducking |
| SegmentController | engines/SegmentController.ts | Fetches/plays segments from timeline manifest |
| TransitionPreloader | engines/TransitionPreloader.ts | Pre-loads upcoming segments |
| QueueManager | engines/QueueManager.ts | Manages the station's track queue from timeline |
| PlaylistCurator | engines/PlaylistCurator.ts | AI playlist generation (Phase 2) |
| SessionMemory | services/SessionMemory.ts | Session history persistence |
| fallbacks | cleo/fallbacks.ts | 12 vibe definitions with labels, emojis, accent colors |

### Design System (do not change)

- Background: `#0D0D0D` — Accent: `#C8832A` (gold)
- Gold left-edge cards: 2px gold left border on dark cards
- Mono labels: DM Mono, 10px, ALL CAPS, letter-spacing 2.5
- Sharp corners: 4px radius throughout
- Fonts: Playfair Display (display), Inter (body), EB Garamond Italic (Onay dialogue), DM Mono (UI chrome)
- Full token definitions in `src/tokens/design-tokens.ts`

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

### Batch Generation Pipeline (`packages/tts`)

The TTS package provides a batch pipeline for producing segments. The real Chatterbox engine is swapped in via the `ChatterboxEngine` interface — a `PlaceholderChatterboxEngine` stub generates valid silent WAV files for development/testing.

**GenerationJob** — input format for the batch pipeline:

```typescript
interface GenerationJob {
  script_text: string;           // The script to synthesize
  type: SegmentType;             // Segment type (show_intro, transition, etc.)
  genre_tags: string[];
  mood_tags: string[];
  artist_refs: string[];
  energy_level: number;          // 1-5
  takes: number;                 // Number of takes per exaggeration level
  exaggeration_levels: number[]; // e.g., [0.3, 0.5, 0.7]
}
```

Total audio files per job = `takes × exaggeration_levels.length`. Each take gets a unique segment ID from `@onay/core`'s `generateSegmentId()`.

**CLI usage:**

```bash
npx tsx packages/tts/src/cli.ts \
  --input jobs.json \
  --output ./output \
  --ref-wav ./onay-ref.wav
```

Output structure: `output/{segment_id}/take-{n}.wav` + `output/manifest.json` mapping every file to its full `Segment` metadata (quality_score starts at 0, filled by quality scoring later).

### Script Generation (`packages/tts/src/scriptgen.ts`)

LLM-powered script generation that feeds directly into the batch pipeline. Flow: `ScriptGenRequest` → prompt building → LLM call → response parsing → `GenerationJob[]`.

**ScriptGenRequest** — input:

```typescript
interface ScriptGenRequest {
  station: Station;              // Station context (name, genres, tracklist)
  targetTypes: SegmentType[];    // Which segment types to generate
  countsPerType: number;         // How many scripts per type
  style?: string;                // Optional style guidance
}
```

**LLMClient** — pluggable interface:

```typescript
interface LLMClient {
  complete(systemPrompt: string, userPrompt: string): Promise<string>;
}
```

`StubLLMClient` returns pre-written scripts from a template bank (`src/templates.ts`) — 10-12 example scripts per segment type, written in Onay's voice. These also serve as few-shot examples in the LLM prompt.

Exaggeration levels auto-set by energy: low (1-2) → `[0.2, 0.4]`, mid (3) → `[0.4, 0.6]`, high (4-5) → `[0.6, 0.8]`. Takes default to 3.

### Quality Scoring (`packages/tts/src/quality.ts`)

Automated scoring of TTS output. Runs after batch generation to populate `quality_score` on each segment.

**`scoreSegment(audioPath, segmentType)`** → `Promise<QualityResult>`

```typescript
interface QualityResult {
  quality_score: number;   // 0.0-1.0, base 1.0 minus deductions
  quality_flags: string[]; // diagnostic flags for each issue found
}
```

Scoring pipeline (base score 1.0, subtract deductions, clamp to 0.0):

1. **File integrity** — validates RIFF/WAVE header, PCM format, 16-bit, mono/stereo, sample rate ≥ 24000. Fail → score 0.0, flag `invalid_audio`.
2. **Duration check** — compares audio duration against expected range per segment type. Outside range → -0.3, flag `duration_out_of_range`.
3. **Silence detection** — threshold: amplitude < 1% of max absolute sample value (min 1.0 for silent files). Leading > 500ms → -0.1, trailing > 500ms → -0.1, internal gap > 1000ms → -0.2.

| Segment Type | Duration Range (ms) |
|---|---|
| show_intro | 8000-15000 |
| show_outro | 8000-12000 |
| song_intro | 5000-10000 |
| transition | 4000-8000 |
| artist_shoutout | 8000-20000 |
| genre_vibe | 6000-12000 |
| fun_fact | 8000-15000 |
| hot_take | 6000-15000 |
| time_of_day | 4000-8000 |
| ad_lib | 1000-3000 |
| seasonal | 5000-10000 |

**`batchScore(audioPaths, types)`** — scores multiple files concurrently via `Promise.all`. Validates array lengths match.

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

## Development Workflow

Work is tracked via GitHub Issues with a GitHub Projects kanban board. Every coding session maps to a single issue.

### Session pattern

1. Pick the next issue from the board (move it to "In Progress").
2. Create a feature branch: `git checkout -b feature/issue-short-name dev`
3. Open Claude Code. Prompt references the issue number and scope.
4. Build the feature. Commit incrementally on the branch.
5. Run tests: `npm run test` in the relevant workspace.
6. Push the branch. Open a PR into `dev`.
7. Review the diff. Squash merge. Delete the branch.
8. Close the issue (move to "Done").

### Prompt pattern for Claude Code

Each prompt should be scoped to ONE issue. Start with "Read CLAUDE.md" so Claude Code picks up the full project context. Reference the specific issue and what needs to be built.

**Examples:**

```
Read CLAUDE.md. Working on issue #1 — define shared TypeScript types in
packages/core/src/types.ts. Create SegmentType enum, Segment interface,
Station interface, TimelineManifest interface, and all supporting types
from the Key Data Structures section. Export everything from index.ts.
Verify with tsc --noEmit.
```

```
Read CLAUDE.md. Working on issue #5 — build Station CRUD endpoints in
services/api. Need POST/GET/PUT/DELETE for stations with the Station
type from packages/core. Store in SQLite. Include input validation and
error handling. Write tests with Vitest + Supertest.
```

```
Read CLAUDE.md. Working on issue #10 — build the segment selection engine
in packages/assembly/src/selector.ts. Follow all assembly rules listed
in the Assembly Rules section. Write extensive tests — test every rule
individually. Use deterministic seeding.
```

**Rules:**
- One issue per session. Don't ask Claude Code to build multiple features at once.
- Always reference CLAUDE.md — it contains the types, schemas, and rules Claude Code needs.
- For deeper context on a specific feature, point to the PRD: "Also read docs/onay-prd-v2.md section 5.2 for full Segment Studio requirements."
- Keep prompts specific. "Build the API" is too broad. "Build Station CRUD endpoints with tests" is right.

### Issue sizing

Each issue should be completable in 1-3 coding sessions. If an issue takes more than 3 sessions, it's too big — break it into sub-issues. Good signs an issue is the right size:
- Touches 1-2 files primarily
- Has a clear "done" state you can verify
- Tests can be written and passing in the same session

## What's Built

### Completed (merged to dev)

| Component | PR | What It Does |
|---|---|---|
| Core types | #21 | `SegmentType`, `Segment`, `Station`, `TimelineManifest`, `TracklistEntry`, `Vibe` — all in `packages/core/src/types.ts` |
| API init | #22 | Express + TypeScript server, CORS, typed error handler, health endpoint (`GET /health`), better-sqlite3 with WAL mode |
| Seed data | #23 | `scripts/seed/seed.ts` + JSON fixtures (2 stations, 24 tracks, ~100 segments). Depends on Station/Segment CRUD endpoints that don't exist yet |

### Pending feature branches (ready to merge)

| Branch | Commit | What It Adds |
|---|---|---|
| `feature/core-utils` | `2a8e317` | `generateSegmentId()`, `filterSegments()`, `validateSegment()` in `packages/core/src/utils.ts` + `validation.ts`. Full test coverage |
| `feature/api-schema` | `a0f1757` | Database schema (`services/api/migrations/001-initial-schema.sql`) + migration runner (`src/migrate.ts`). Tables: stations, station_tracks, segments, timelines, timeline_history |
| `feature/tts-batch` | `6ad8fff` | Full batch TTS pipeline with `ChatterboxEngine` interface, `PlaceholderChatterboxEngine` stub, `runBatch()`, CLI. Full test coverage |
| `feature/tts-scriptgen` | merged | LLM-powered script generation: `ScriptGenRequest` → `buildPrompt()` → `LLMClient` → `parseResponse()` → `GenerationJob[]`. Template bank (10-12 scripts per segment type in Onay's voice), `StubLLMClient`, graceful response parsing. 31 tests |
| `feature/api-stations` | merged | Station CRUD + track management + segment library endpoints. 68 integration tests |
| `feature/api-timelines` | merged | Timeline manifest endpoints: create, get active, history, get by ID. 27 integration tests |
| `feature/tts-quality` | PR #30 | Audio quality scoring: `scoreSegment()` + `batchScore()` in `packages/tts/src/quality.ts`. WAV integrity checks (RIFF/WAVE header, 16-bit PCM, sample rate ≥ 24000), duration validation per segment type, silence detection (leading/trailing/internal gaps). Returns `QualityResult` with `quality_score` (0-1) and `quality_flags`. 17 tests |

### API Endpoints (from `feature/api-stations`)

**Station CRUD** (`services/api/src/routes/stations.ts`):

| Method | Path | Description |
|---|---|---|
| POST | `/api/stations` | Create station (generates UUID, validates name) |
| GET | `/api/stations` | List all stations (`?published=true` filter). No tracklist in listing |
| GET | `/api/stations/:id` | Get station with full tracklist (joins station_tracks by position) |
| PUT | `/api/stations/:id` | Partial update station metadata, bumps `updated_at` |
| DELETE | `/api/stations/:id` | Delete station (cascade deletes tracks) |
| POST | `/api/stations/:id/tracks` | Add track to station (auto-positions at end) |
| PUT | `/api/stations/:id/tracks` | Replace entire tracklist (transactional) |
| DELETE | `/api/stations/:id/tracks/:trackId` | Remove track, reorder remaining positions |

**Segment Library** (`services/api/src/routes/segments.ts`):

| Method | Path | Description |
|---|---|---|
| POST | `/api/segments` | Upload segment (multipart: metadata + audio file via multer, wav/mp3, 50MB limit) |
| GET | `/api/segments` | Query with combinable filters: type, genre, mood, artist, energyMin/Max, qualityMin, search, limit, offset |
| GET | `/api/segments/:id` | Get single segment |
| PUT | `/api/segments/:id` | Update segment metadata (approve/reject, tags, quality score) |
| DELETE | `/api/segments/:id` | Delete segment + audio file from disk |
| POST | `/api/segments/bulk-approve` | Approve all pending segments with `quality_score >= threshold` |
| GET | `/api/segments/stats` | Library stats: total, by_type counts, avg_quality, total_duration_ms |

**Timeline Manifests** (`services/api/src/routes/timelines.ts`):

| Method | Path | Description |
|---|---|---|
| POST | `/api/timelines` | Create timeline (validates station exists, entries non-empty, entry field types). Also inserts timeline_history record. Returns 201 |
| GET | `/api/stations/:id/timeline` | Get most recent timeline for a station. 404 if station has no timelines |
| GET | `/api/stations/:id/timeline/history` | List past timelines with `entry_count` and `total_duration_ms`. Supports `?limit` and `?offset` |
| GET | `/api/timelines/:id` | Get specific timeline by ID |

**DB response shape:** Station rows use `station_id` (mapped from DB `id`), JSON array columns are parsed to arrays. Segments include a `status` field (`pending`/`approved`/`rejected`) added via `002-segment-status.sql` migration.

**Test setup:** `src/test-setup.ts` provides `createTestDb()` — creates an in-memory SQLite database with all migrations applied. Test files mock `db.js` via `vi.mock` and clean tables in `beforeEach`.

### Not yet started

- Assembly pipeline (`packages/assembly/` — empty)
- Tools web app (`apps/tools/` — empty)
- Mobile app stub implementations (interfaces in place, bodies unimplemented)

### Database Schema (from `feature/api-schema` + `002-segment-status.sql`)

```sql
-- stations: id, name, description, genre_tags, mood_tags, cover_art_url, rotation_schedule, is_published, created_at, updated_at
-- station_tracks: id, station_id, position, canonical_id, artist, title, isrc, duration_ms, apple_music_id, spotify_id
-- segments: segment_id (PK), type, genre_tags, mood_tags, artist_refs, energy_level, duration_ms, quality_score, exaggeration_level, usage_count, audio_url, script_text, status, created_at
-- timelines: id, station_id, entries (JSON), created_at
-- timeline_history: id, timeline_id, station_id, published_at
```

## Current Phase

**Phase 1: Foundation** — Set up Chatterbox, define schemas, build Segment Studio MVP, produce initial segment library (300-500 segments for hip-hop/R&B), build Station Manager MVP, build assembly pipeline MVP, deploy first test station.

**Next up:** Merge pending feature branches → run seed script → build assembly pipeline.

**Phase 2: Mobile App** — Run v1 → v2 UI migration (`v2-migration/migrate-ui.sh`). Implement stubs against v2 backend. Priority order: Storage → AuthService → api → MusicProvider → SessionEngine/QueueManager (consume timeline manifests) → AudioCoordinator/SegmentController (segment playback). Do NOT rebuild or significantly modify the UI — implement the stub interfaces so existing screens work with the new backend.
