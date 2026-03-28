#!/bin/bash
# create-phase1-issues.sh
# Run from inside your onay repo: ./create-phase1-issues.sh
# Requires: gh cli (brew install gh), authenticated (gh auth login)

set -euo pipefail

MILESTONE="Phase 1: Foundation"

echo "Creating milestone..."
gh milestone create "$MILESTONE" --description "Core pipeline, segment library, tooling MVPs, first test station" 2>/dev/null || echo "Milestone already exists, continuing..."

echo ""
echo "Creating labels..."
for label in core api tts assembly tools infra integration phase-1; do
  gh label create "$label" 2>/dev/null || true
done

echo ""
echo "Creating issues..."

# ── Issue 1 ──
gh issue create \
  --title "[core] Define shared TypeScript types for Segment, Station, and Timeline" \
  --label "core,phase-1" \
  --milestone "$MILESTONE" \
  --body "Create the foundational types in \`packages/core/src/types.ts\` that every other package depends on.

**Types to define:**
- \`SegmentType\` enum (show_intro, show_outro, song_intro, transition, artist_shoutout, genre_vibe, fun_fact, hot_take, time_of_day, ad_lib, seasonal)
- \`Segment\` interface (full metadata schema from CLAUDE.md)
- \`Station\` interface with tracklist entries and provider availability maps
- \`TimelineManifest\` interface with \`TimelineEntry\` union type (song | segment)
- \`TracklistEntry\` with canonical ID, artist, title, ISRC, duration
- \`RotationSchedule\` type
- \`Vibe\` type and \`VIBES\` constant (12 vibes from fallbacks.ts)

Export everything from \`packages/core/src/index.ts\`. Add \`tsconfig.json\` to the package. Verify with \`tsc --noEmit\`.

**Acceptance criteria:**
- All types match CLAUDE.md schemas exactly
- Package compiles clean
- Can be imported from other workspaces via \`@onay/core\`"
echo "✓ Issue 1 created"

# ── Issue 2 ──
gh issue create \
  --title "[core] Segment validation and utility functions" \
  --label "core,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #1

Add utility functions to \`packages/core\` for working with segments.

- \`validateSegment(segment: Partial<Segment>): ValidationResult\` — checks required fields, valid ranges (energy 1-5, quality 0-1, duration > 0)
- \`generateSegmentId(type: SegmentType): string\` — generates IDs like \`SEG-TR-00412\`
- \`filterSegments(library: Segment[], filters: SegmentFilter): Segment[]\` — filter by type, genre, mood, artist, energy range, quality threshold
- \`SegmentFilter\` type definition

Write unit tests with Vitest. Aim for full coverage on the validator."
echo "✓ Issue 2 created"

# ── Issue 3 ──
gh issue create \
  --title "[api] Initialize Express/TypeScript project with health check" \
  --label "api,phase-1" \
  --milestone "$MILESTONE" \
  --body "Set up \`services/api\` as an Express/TypeScript project.

- Express app with JSON body parsing, CORS, error handling middleware
- \`GET /health\` returns \`{ status: \"ok\", version: \"0.1.0\" }\`
- SQLite database setup via \`better-sqlite3\` (file-based, \`data/onay.db\`)
- Environment config (PORT, DATABASE_PATH, NODE_ENV)
- \`tsconfig.json\` extending the workspace root config
- \`npm run dev\` script with \`tsx watch\`
- \`npm run build\` and \`npm run start\` for production

**Acceptance criteria:**
- \`npm run dev\` starts the server
- \`curl localhost:3001/health\` returns OK
- SQLite db file created on first run"
echo "✓ Issue 3 created"

# ── Issue 4 ──
gh issue create \
  --title "[api] Database schema and migration setup" \
  --label "api,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #1, #3

Create SQLite tables for the core data models. Use a simple migration runner (numbered SQL files in \`services/api/migrations/\`).

**Tables:**
- \`stations\` — id, name, description, genre_tags (JSON), mood_tags (JSON), cover_art_url, rotation_schedule (JSON), created_at, updated_at, is_published
- \`station_tracks\` — id, station_id (FK), position, canonical_id, artist, title, isrc, duration_ms, apple_music_id, spotify_id
- \`segments\` — all fields from the Segment type (segment_id as PK, type, genre_tags JSON, mood_tags JSON, artist_refs JSON, energy_level, duration_ms, quality_score, exaggeration_level, usage_count, audio_url, script_text, created_at)
- \`timelines\` — id, station_id (FK), entries (JSON), created_at
- \`timeline_history\` — id, timeline_id (FK), station_id (FK), published_at

Create indexes on segments for type, quality_score, and energy_level."
echo "✓ Issue 4 created"

# ── Issue 5 ──
gh issue create \
  --title "[api] Station CRUD endpoints" \
  --label "api,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #4

Build REST endpoints for station management.

- \`POST /api/stations\` — create a station
- \`GET /api/stations\` — list all stations (with optional \`?published=true\` filter)
- \`GET /api/stations/:id\` — get station with full tracklist
- \`PUT /api/stations/:id\` — update station metadata
- \`DELETE /api/stations/:id\` — delete station
- \`POST /api/stations/:id/tracks\` — add track to station tracklist
- \`PUT /api/stations/:id/tracks\` — reorder/replace full tracklist
- \`DELETE /api/stations/:id/tracks/:trackId\` — remove track

Input validation using types from \`@onay/core\`. Return proper HTTP status codes. Write integration tests with Vitest + Supertest."
echo "✓ Issue 5 created"

# ── Issue 6 ──
gh issue create \
  --title "[api] Segment library endpoints" \
  --label "api,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #4

Build REST endpoints for the segment library.

- \`POST /api/segments\` — create/upload a segment (metadata + audio file)
- \`GET /api/segments\` — query segments with filters (type, genre, mood, artist, energy range, quality threshold, text search on script_text)
- \`GET /api/segments/:id\` — get single segment with full metadata
- \`PUT /api/segments/:id\` — update segment metadata (approve, reject, update tags)
- \`DELETE /api/segments/:id\` — delete segment and its audio file
- \`POST /api/segments/bulk-approve\` — approve all segments above a quality threshold
- \`GET /api/segments/stats\` — library stats (count by type, average quality, total duration)

Support file upload for audio via \`multer\`. Store audio files in a configurable directory. Write integration tests."
echo "✓ Issue 6 created"

# ── Issue 7 ──
gh issue create \
  --title "[api] Timeline manifest endpoints" \
  --label "api,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #4

Build REST endpoints for serving assembled timelines.

- \`POST /api/timelines\` — save an assembled timeline for a station
- \`GET /api/stations/:id/timeline\` — get the current active timeline for a station (what listeners receive)
- \`GET /api/stations/:id/timeline/history\` — list past timelines for a station
- \`GET /api/timelines/:id\` — get a specific timeline by ID

The timeline response should be the full \`TimelineManifest\` from \`@onay/core\` — the mobile app consumes this directly to orchestrate playback."
echo "✓ Issue 7 created"

# ── Issue 8 ──
gh issue create \
  --title "[tts] Build batch generation script with Chatterbox placeholder" \
  --label "tts,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #1

Create the batch TTS generation pipeline in \`packages/tts\`.

**Input:** A JSON file of generation jobs:
\`\`\`json
[
  {
    \"script_text\": \"You're locked in with Onay, let's get into it...\",
    \"type\": \"show_intro\",
    \"genre_tags\": [\"hip-hop\", \"r&b\"],
    \"mood_tags\": [\"energetic\"],
    \"artist_refs\": [],
    \"energy_level\": 4,
    \"takes\": 3,
    \"exaggeration_levels\": [0.3, 0.5, 0.7]
  }
]
\`\`\`

**Processing:**
- For each job, generate N takes at different exaggeration levels
- Stub the actual Chatterbox call as a placeholder function that logs what it would generate and creates a silent WAV file of the target duration
- Generate a \`segment_id\` for each output

**Output:**
- Audio files organized as \`output/{segment_id}/take-{n}.wav\`
- A manifest JSON mapping each take to full segment metadata
- Summary log: jobs processed, takes generated, any errors

The Chatterbox placeholder should be a single function \`generateAudio(text, refWav, exaggeration)\` that can be swapped for the real implementation on a GPU machine.

Write unit tests for the pipeline orchestration (not the TTS call itself)."
echo "✓ Issue 8 created"

# ── Issue 9 ──
gh issue create \
  --title "[tts] Quality scoring module for generated audio" \
  --label "tts,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #8

Build an automated quality scoring module in \`packages/tts/src/quality.ts\`.

Heuristic scoring for v1:

- **Duration check:** Is the clip within expected range for its segment type? (Reference ranges from the segment taxonomy in the PRD)
- **Silence detection:** Flag clips with excessive leading/trailing silence (>500ms) or internal silence gaps (>1s)
- **File integrity:** Valid WAV header, correct sample rate, not corrupted

Output a \`quality_score\` (0.0–1.0) and a \`quality_flags\` array explaining any deductions.

This is v1 of quality scoring — more sophisticated analysis (spectral, voice consistency) comes later. The goal is to auto-reject obviously bad clips and surface everything else for manual review.

Write unit tests with sample WAV fixtures."
echo "✓ Issue 9 created"

# ── Issue 10 ──
gh issue create \
  --title "[assembly] Segment selection engine" \
  --label "assembly,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #1, #2

Build the core assembly logic in \`packages/assembly/src/selector.ts\`.

Given a station's tracklist and a segment library, select which segments go between which songs.

**Assembly rules (from CLAUDE.md):**
- Never repeat the same segment within 5 slots of itself
- Match segment energy_level to surrounding songs (±1 level tolerance)
- Show must start with a show_intro and end with a show_outro
- Don't place segments between every song — target 60-70% of transitions having a segment
- Ad-libs: max 2 per show, never back-to-back with another segment
- Artist shoutouts only appear adjacent to a song by that artist
- Time-of-day segments should match the station's rotation schedule target

**Input:** \`Station\` (with tracklist) + \`Segment[]\` (library) + \`AssemblyConfig\` (time-of-day, variation seed)

**Output:** \`TimelineEntry[]\` — the ordered sequence of songs and segments

Write extensive unit tests. Test every rule individually and in combination. Use deterministic seeding so tests are reproducible."
echo "✓ Issue 10 created"

# ── Issue 11 ──
gh issue create \
  --title "[assembly] Timeline manifest builder" \
  --label "assembly,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #10

Build the module that takes the selector output and produces a complete \`TimelineManifest\`.

- Wraps the segment selection result with station metadata and timestamps
- Calculates total show duration
- Validates the manifest (no gaps, no orphaned segments, all audio_urls present)
- Exports as JSON for the API to serve

Also build a CLI command: \`npm run assemble -- --station <id>\` that fetches a station from the API, pulls the segment library, runs the selector, and POSTs the resulting timeline back to the API."
echo "✓ Issue 11 created"

# ── Issue 12 ──
gh issue create \
  --title "[assembly] Dynamic bridging — generate short custom transitions" \
  --label "assembly,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #10, #8

When the segment library doesn't have a good match for a particular transition (selector returns a low-confidence pick), generate a short custom bridge.

- Detect low-confidence selections (no segment matches within energy tolerance, or all candidates have been recently used)
- Generate a 1-2 sentence bridging script using LLM (stub the LLM call)
- Send the script through the TTS batch pipeline to produce a one-off segment
- Insert the generated segment into the timeline

The LLM stub should accept \`(previousSong, nextSong, stationMood)\` and return a bridging script string. Real Ollama/Gemini integration comes later."
echo "✓ Issue 12 created"

# ── Issue 13 ──
gh issue create \
  --title "[tts] Script generation module — LLM-powered segment writing" \
  --label "tts,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #1

Build the script generation module in \`packages/tts/src/scriptgen.ts\`.

Given a station's tracklist and metadata, generate Onay-style scripts for all needed segment types.

**Input:** Station definition (tracklist, genre, mood) + target segment types + count per type

**Output:** Array of script objects with text, type, tags, and target energy level — ready to feed into the batch TTS pipeline from issue #8.

Include Onay's character brief in the LLM system prompt: warm, magnetic, hip-hop/R&B-rooted, opinionated, genuine, never robotic. Generate multiple script variants per slot for variety.

Stub the LLM call (accept prompt, return text). Include 10-15 hardcoded example scripts per segment type as few-shot examples in the prompt template.

Write tests for the prompt construction and output parsing."
echo "✓ Issue 13 created"

# ── Issue 14 ──
gh issue create \
  --title "[tools] Segment Studio MVP — review queue UI" \
  --label "tools,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #6, #8

Build the first tool UI in \`apps/tools\` as a React web app.

**Segment Studio review queue:**
- List view of segments pending review (fetched from API)
- Filter by type, genre, quality score range
- Audio player for each segment (play/pause)
- Approve / Reject / Flag for regeneration buttons per segment
- Bulk approve: approve all segments above a quality threshold with one click
- Metadata display: script text, type, tags, energy level, exaggeration level, quality score, duration

Keep the UI functional, not fancy. This is an internal tool. Use a simple component library (shadcn/ui or plain Tailwind)."
echo "✓ Issue 14 created"

# ── Issue 15 ──
gh issue create \
  --title "[tools] Station Manager MVP — tracklist builder UI" \
  --label "tools,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #5

Build the Station Manager in \`apps/tools\`.

**Station builder:**
- Create new station: name, description, genre tags, mood tags
- Add tracks manually: search by artist/title (text input for now, music API search in Phase 3)
- Drag-and-drop tracklist reordering
- Remove tracks
- Save / publish station (POST/PUT to API)
- List view of all stations

This is the manual version — AI-powered tracklist generation comes in Phase 3."
echo "✓ Issue 15 created"

# ── Issue 16 ──
gh issue create \
  --title "[tools] Assembly Dashboard MVP — timeline preview" \
  --label "tools,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #7, #11

Build the Assembly Dashboard in \`apps/tools\`.

**Timeline preview:**
- Select a station
- Trigger assembly (calls the assembly CLI or API endpoint)
- Display the resulting timeline as a visual sequence of blocks (song blocks and segment blocks)
- Click any segment block to play the audio
- Show total duration and segment count
- Publish button (saves timeline to API as the station's active timeline)

No swap/edit functionality yet — that's Phase 3. This is view + publish only."
echo "✓ Issue 16 created"

# ── Issue 17 ──
gh issue create \
  --title "[infra] Deploy API to Hostinger VPS" \
  --label "infra,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #3

Set up deployment pipeline for the API server.

- GitHub Actions workflow triggered on merge to \`main\`
- Build \`services/api\` with TypeScript
- SSH into Hostinger VPS, rsync the built files
- Restart the API service via pm2 or systemd
- Verify health check passes after deploy
- Set up environment variables on the VPS
- Configure Pangolin/Newt tunneling to expose the API (or use existing setup)

Also set up the PR pipeline: lint + type check + tests on PR to \`dev\`."
echo "✓ Issue 17 created"

# ── Issue 18 ──
gh issue create \
  --title "[infra] Segment audio storage and serving" \
  --label "infra,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #17

Set up audio file storage and serving on the VPS.

- Dedicated directory for segment audio (\`/var/data/onay/segments/\`)
- API saves uploaded segment audio to this directory
- Serve audio files via static file route or nginx reverse proxy
- Set proper cache headers (segments are immutable — long cache TTL)
- Ensure audio URLs in segment metadata resolve correctly

CDN (Cloudflare/BunnyCDN) comes in Phase 3. This is direct VPS serving for now."
echo "✓ Issue 18 created"

# ── Issue 19 ──
gh issue create \
  --title "[core] Seed data — sample scripts and test segments" \
  --label "core,phase-1" \
  --milestone "$MILESTONE" \
  --body "Create seed data for development and testing.

- 5 sample stations with tracklists (10-15 tracks each): Hip-Hop Heat, Late Night R&B, Throwback Vibes, Chill Beats, Workout Energy
- 50 sample segment scripts covering all 11 segment types, tagged with appropriate genres and moods
- A seed script (\`npm run seed\`) that inserts stations and segments into the database via the API

This makes it possible to test the assembly pipeline and tool UIs without manually entering data every time."
echo "✓ Issue 19 created"

# ── Issue 20 ──
gh issue create \
  --title "[phase-1] Integration test — assemble and serve a complete station" \
  --label "integration,phase-1" \
  --milestone "$MILESTONE" \
  --body "Depends on: #11, #7, #19

End-to-end integration test proving the full Phase 1 pipeline works.

1. Seed a station with a tracklist
2. Seed the segment library with test segments
3. Run the assembly pipeline against the station
4. Verify the output timeline follows all assembly rules
5. Save the timeline via the API
6. Fetch the timeline from the API and verify it's complete and valid
7. Verify all segment audio URLs in the timeline are accessible

This is the \"demo station\" milestone. When this passes, Phase 1 is done and we're ready to wire up the mobile app in Phase 2."
echo "✓ Issue 20 created"

echo ""
echo "═══════════════════════════════════════"
echo "  All 20 Phase 1 issues created! 🎉"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Go to GitHub → Projects → Create 'ONAY v2' board"
echo "  2. Add all issues with 'phase-1' label to the board"
echo "  3. Start building from issue #1"
