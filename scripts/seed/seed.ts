import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Station, Segment } from '@onay/core';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const apiUrlFlag = args.find((a) => a.startsWith('--api-url'));
const API_BASE = apiUrlFlag?.split('=')[1] ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJson<T>(filename: string): T {
  const path = resolve(__dirname, filename);
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

async function post(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: unknown }> {
  const url = `${API_BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, data: { error: `Request failed: ${message}` } };
  }
  clearTimeout(timer);

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  return { ok: res.ok, status: res.status, data };
}

function log(icon: string, msg: string) {
  console.log(`${icon}  ${msg}`);
}

// ---------------------------------------------------------------------------
// Seed stations
// ---------------------------------------------------------------------------

async function seedStations(stations: Station[]) {
  log('=', `Seeding ${stations.length} stations...`);
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const station of stations) {
    const { tracklist, ...stationBody } = station;

    // Create station (without tracklist — tracks are added separately)
    const stationRes = await post('/api/stations', stationBody);

    if (stationRes.ok) {
      log('+', `Station created: ${station.name}`);
      created++;
    } else if (stationRes.status === 409) {
      log('-', `Station already exists: ${station.name}`);
      skipped++;
    } else {
      log('!', `Failed to create station "${station.name}": ${stationRes.status} ${JSON.stringify(stationRes.data)}`);
      failed++;
      continue; // skip tracks if station creation failed
    }

    // Add tracks
    let trackCount = 0;
    for (const track of tracklist) {
      const trackRes = await post(`/api/stations/${station.station_id}/tracks`, track);
      if (trackRes.ok) {
        trackCount++;
      } else if (trackRes.status === 409) {
        // duplicate track, skip silently
      } else {
        log('!', `  Failed to add track "${track.title}": ${trackRes.status}`);
      }
    }
    if (trackCount > 0) {
      log('+', `  Added ${trackCount} tracks`);
    }
  }

  log('=', `Stations done: ${created} created, ${skipped} skipped, ${failed} failed`);
}

// ---------------------------------------------------------------------------
// Seed segments
// ---------------------------------------------------------------------------

async function seedSegments(segments: Segment[]) {
  log('=', `Seeding ${segments.length} segments...`);
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const segment of segments) {
    const res = await post('/api/segments', segment);

    if (res.ok) {
      created++;
    } else if (res.status === 409) {
      skipped++;
    } else {
      log('!', `Failed to create segment "${segment.segment_id}": ${res.status} ${JSON.stringify(res.data)}`);
      failed++;
    }
  }

  log('+', `Segments: ${created} created, ${skipped} skipped, ${failed} failed`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nOnay Seed Script`);
  console.log(`API: ${API_BASE}\n`);

  // Verify API is reachable
  try {
    const health = await fetch(`${API_BASE}/health`);
    if (!health.ok) throw new Error(`status ${health.status}`);
    log('+', 'API is reachable');
  } catch (err) {
    log('!', `Cannot reach API at ${API_BASE} — is the server running?`);
    log('!', `Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  console.log('');

  const stations = loadJson<Station[]>('stations.json');
  const segments = loadJson<Segment[]>('segments.json');

  await seedStations(stations);
  console.log('');
  await seedSegments(segments);

  console.log('\nSeed complete.\n');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
