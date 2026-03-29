import { selectSegments, type AssemblyConfig } from './selector';
import { buildManifest, validateManifest, getManifestStats } from './manifest';
import type { Station, Segment } from '@onay/core';

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { stationId: string; apiUrl: string } {
  let stationId = '';
  let apiUrl = '';

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--station-id' && argv[i + 1]) stationId = argv[++i];
    if (argv[i] === '--api-url' && argv[i + 1]) apiUrl = argv[++i];
  }

  if (!stationId || !apiUrl) {
    console.error('Usage: npx tsx src/cli.ts --station-id <id> --api-url <url>');
    process.exit(1);
  }

  return { stationId, apiUrl };
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchStation(apiUrl: string, stationId: string): Promise<Station> {
  const res = await fetch(`${apiUrl}/api/stations/${stationId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch station ${stationId}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<Station>;
}

async function fetchSegments(apiUrl: string): Promise<Segment[]> {
  const res = await fetch(`${apiUrl}/api/segments?limit=1000`);
  if (!res.ok) {
    throw new Error(`Failed to fetch segments: ${res.status} ${res.statusText}`);
  }
  const data = await res.json() as { segments: Segment[]; total: number };
  return data.segments;
}

async function postTimeline(
  apiUrl: string,
  manifest: { station_id: string; created_at: string; entries: unknown[] },
): Promise<void> {
  const res = await fetch(`${apiUrl}/api/timelines`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manifest),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to post timeline: ${res.status} ${res.statusText}\n${body}`);
  }
  console.log('Timeline published successfully.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { stationId, apiUrl } = parseArgs(process.argv.slice(2));

  console.log(`Fetching station ${stationId}...`);
  const station = await fetchStation(apiUrl, stationId);
  console.log(`Station: ${station.name} (${station.tracklist.length} tracks)`);

  console.log('Fetching segment library...');
  const segments = await fetchSegments(apiUrl);
  console.log(`Library: ${segments.length} segments`);

  console.log('Running segment selection...');
  const config: AssemblyConfig = {
    timeOfDay: station.rotation_schedule?.time_of_day_target ?? 'evening',
    variationSeed: Date.now(),
  };
  const entries = selectSegments(station, segments, config);

  console.log('Building manifest...');
  const manifest = buildManifest(stationId, entries);

  console.log('Validating manifest...');
  const validation = validateManifest(manifest);
  if (!validation.valid) {
    console.error('Manifest validation failed:');
    for (const err of validation.errors) {
      console.error(`  - ${err}`);
    }
    process.exit(1);
  }
  console.log('Manifest valid.');

  console.log('Publishing timeline...');
  await postTimeline(apiUrl, manifest);

  const stats = getManifestStats(manifest);
  console.log('\n--- Manifest Stats ---');
  console.log(`Total duration: ${Math.round(stats.total_duration_ms / 1000 / 60)}m ${Math.round((stats.total_duration_ms / 1000) % 60)}s`);
  console.log(`Songs: ${stats.song_count}`);
  console.log(`Segments: ${stats.segment_count}`);
  console.log(`Segment ratio: ${(stats.segment_ratio * 100).toFixed(1)}% of transitions`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
