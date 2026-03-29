# Segment Studio Review Queue — Design Spec

**Issue:** #14
**Date:** 2026-03-29
**Branch:** `feature/tools-segment-studio`

## Overview

Internal web tool for reviewing, approving, and rejecting Onay voice segments from the TTS pipeline. Operators browse the segment library with filters, listen to audio, and manage segment status (pending/approved/rejected).

## Stack

- Vite + React 18 + TypeScript + Tailwind CSS v3
- Lives in `apps/tools/` (workspace `@onay/tools`)
- Vite dev server proxies `/api` to backend at `localhost:3001`

## Files

| File | Purpose |
|---|---|
| `src/api.ts` | Typed API client wrapping fetch calls to backend |
| `src/pages/SegmentStudio.tsx` | Main page — stats, filters, bulk actions, paginated list |
| `src/components/StatsBar.tsx` | Library stats row (total, by type, avg quality) |
| `src/components/FilterBar.tsx` | Type dropdown, genre/mood inputs, quality range, search |
| `src/components/SegmentCard.tsx` | Segment card with metadata, audio player, action buttons |
| `src/components/AudioPlayer.tsx` | Play/pause + progress bar (HTML5 Audio API) |
| `src/App.tsx` | Root component (renders SegmentStudio) |
| `src/main.tsx` | React entry point |
| `src/index.css` | Tailwind directives |

## API Client (`src/api.ts`)

Base URL from `import.meta.env.VITE_API_URL` or `""` (proxy fallback).

| Function | Method | Endpoint | Params |
|---|---|---|---|
| `getSegments(filters)` | GET | `/api/segments` | type, genre, mood, search, qualityMin, limit, offset |
| `updateSegment(id, data)` | PUT | `/api/segments/:id` | Partial segment fields (status, etc.) |
| `deleteSegment(id)` | DELETE | `/api/segments/:id` | — |
| `bulkApprove(threshold)` | POST | `/api/segments/bulk-approve` | `{ quality_threshold }` |
| `getStats()` | GET | `/api/segments/stats` | — |

All functions return typed responses matching the backend shape.

## UI Components

### StatsBar
- Displays: total segments, breakdown by type, average quality score, total duration
- Refreshes when segments are modified

### FilterBar
- Type: `<select>` dropdown with all SegmentType values + "All"
- Genre/Mood: text inputs (free-text, passed as query params)
- Quality min: range slider 0.0–1.0
- Search: text input for script_text search
- Filters update parent state; parent re-fetches

### SegmentCard
- **Header:** segment_id, type badge, status badge (pending=gray, approved=green, rejected=red)
- **Body:** script_text (truncated with expand), genre/mood tags as pills, artist_refs
- **Metadata row:** energy level (1–5 dots), quality score (colored: red <0.5, yellow 0.5–0.8, green >0.8), duration (formatted mm:ss), exaggeration level
- **Audio:** AudioPlayer component with play/pause and progress bar
- **Actions:** Approve (green), Reject (red), Regenerate (yellow) buttons
  - Approve: `PUT { status: "approved" }`
  - Reject: `PUT { status: "rejected" }`
  - Regenerate: `PUT { status: "pending" }` (resets to pending for re-processing)

### AudioPlayer
- HTML5 `<audio>` element (hidden), controlled via refs
- Play/pause toggle button
- Progress bar showing current time / duration
- Click on progress bar to seek

### Bulk Actions Bar
- "Approve all above threshold" button with quality score number input
- Before executing: shows count of segments that would be affected (fetches with qualityMin filter)
- Confirmation step before calling `bulkApprove()`

### Pagination
- Page-based navigation at bottom of list
- 20 segments per page (configurable)
- Shows total count and current page range

## Styling

- Dark background: `#0D0D0D`
- Text: white (`#F5F5F5`) and gray (`#888`)
- Accent: gold `#C8832A` for interactive elements
- Tailwind utility classes only — no custom CSS beyond directives
- Functional, not polished — this is an internal tool

## Vite Config

```typescript
server: {
  proxy: {
    '/api': 'http://localhost:3001'
  }
}
```

## Decisions

- **Pagination over infinite scroll** — simpler, matches API's limit/offset pattern
- **No routing library** — single page for now, add react-router when Station Manager / Assembly Dashboard arrive
- **Regenerate = reset to pending** — no dedicated regeneration pipeline yet
- **No state management library** — React useState/useEffect sufficient for this scope
