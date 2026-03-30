import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AssemblyDashboard } from '../pages/AssemblyDashboard';
import type { Station, Timeline, TimelineHistoryItem, AssembleResult } from '../api';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function makeStation(overrides: Partial<Station> = {}): Station {
  return {
    station_id: 'station-1',
    name: 'Hip-Hop Vibes',
    description: 'A hip-hop station',
    genre_tags: ['hip-hop'],
    mood_tags: ['chill'],
    cover_art_url: null,
    rotation_schedule: null,
    is_published: true,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    ...overrides,
  };
}

function makeTimeline(overrides: Partial<Timeline> = {}): Timeline {
  return {
    id: 'timeline-1',
    station_id: 'station-1',
    created_at: '2026-03-15T12:00:00Z',
    entries: [
      { type: 'segment', segment_id: 'SEG-SI-001', audio_url: '/audio/intro.wav', duration_ms: 10000 },
      { type: 'song', canonical_id: 'sza-kill-bill', artist: 'SZA', title: 'Kill Bill', duration_ms: 180000 },
      { type: 'segment', segment_id: 'SEG-TR-001', audio_url: '/audio/trans.wav', duration_ms: 6000 },
      { type: 'song', canonical_id: 'frank-ivy', artist: 'Frank Ocean', title: 'Ivy', duration_ms: 240000 },
      { type: 'segment', segment_id: 'SEG-SO-001', audio_url: '/audio/outro.wav', duration_ms: 8000 },
    ],
    ...overrides,
  };
}

function makeHistoryItem(overrides: Partial<TimelineHistoryItem> = {}): TimelineHistoryItem {
  return {
    id: 'timeline-1',
    created_at: '2026-03-15T12:00:00Z',
    entry_count: 5,
    total_duration_ms: 444000,
    ...overrides,
  };
}

function makeAssembleResult(): AssembleResult {
  const tl = makeTimeline();
  return {
    ...tl,
    stats: {
      total_duration_ms: 444000,
      song_count: 2,
      segment_count: 3,
      segment_ratio: 0.67,
    },
  };
}

// Helper to set up fetch responses in order
function setupFetch(...responses: Array<{ status?: number; body: unknown }>) {
  for (const resp of responses) {
    mockFetch.mockResolvedValueOnce({
      ok: (resp.status ?? 200) < 400,
      status: resp.status ?? 200,
      json: () => Promise.resolve(resp.body),
    });
  }
}

beforeEach(() => {
  mockFetch.mockReset();
});

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AssemblyDashboard />
    </MemoryRouter>,
  );
}

describe('AssemblyDashboard', () => {
  it('loads and displays station selector', async () => {
    setupFetch({ body: [makeStation()] });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Hip-Hop Vibes')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Select station')).toBeInTheDocument();
    expect(screen.getByText('Assembly Dashboard')).toBeInTheDocument();
  });

  it('shows placeholder when no station selected', async () => {
    setupFetch({ body: [makeStation()] });

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Hip-Hop Vibes')).toBeInTheDocument();
    });

    // Assemble button should be disabled
    expect(screen.getByText('Assemble')).toBeDisabled();
  });

  it('loads timeline when station is selected', async () => {
    const stations = [makeStation()];
    const timeline = makeTimeline();
    const history = [makeHistoryItem()];

    setupFetch(
      { body: stations },           // getStations
      { body: timeline },            // getTimeline
      { body: history },             // getTimelineHistory
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Hip-Hop Vibes')).toBeInTheDocument();
    });

    // Select the station
    fireEvent.change(screen.getByLabelText('Select station'), {
      target: { value: 'station-1' },
    });

    await waitFor(() => {
      expect(screen.getByText('Kill Bill')).toBeInTheDocument();
    });

    expect(screen.getByText('SZA')).toBeInTheDocument();
    expect(screen.getByText('Frank Ocean')).toBeInTheDocument();
    expect(screen.getByText('2 songs')).toBeInTheDocument();
    expect(screen.getByText('3 segments')).toBeInTheDocument();
  });

  it('shows no-timeline message when station has no timeline', async () => {
    setupFetch(
      { body: [makeStation()] },
      { status: 404, body: { error: 'No timeline found' } },
      { body: [] },
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Hip-Hop Vibes')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Select station'), {
      target: { value: 'station-1' },
    });

    await waitFor(() => {
      expect(screen.getByText(/No timeline yet/)).toBeInTheDocument();
    });
  });

  it('triggers assembly and shows result', async () => {
    const result = makeAssembleResult();

    setupFetch(
      { body: [makeStation()] },                               // getStations
      { status: 404, body: { error: 'No timeline' } },         // getTimeline (none yet)
      { body: [] },                                              // getTimelineHistory
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Hip-Hop Vibes')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Select station'), {
      target: { value: 'station-1' },
    });

    await waitFor(() => {
      expect(screen.getByText(/No timeline yet/)).toBeInTheDocument();
    });

    // Now set up assembly response
    setupFetch(
      { status: 201, body: result },  // triggerAssembly
      { body: [makeHistoryItem()] },   // getTimelineHistory refresh
    );

    fireEvent.click(screen.getByText('Assemble'));

    await waitFor(() => {
      expect(screen.getByText(/Assembly complete/)).toBeInTheDocument();
    });

    expect(screen.getByText('Kill Bill')).toBeInTheDocument();

    // Verify POST was called
    const assembleCalls = mockFetch.mock.calls.filter(
      (c: [string, RequestInit?]) => c[0].includes('/assemble'),
    );
    expect(assembleCalls).toHaveLength(1);
    expect(assembleCalls[0][1]?.method).toBe('POST');
  });

  it('shows error when assembly fails', async () => {
    setupFetch(
      { body: [makeStation()] },
      { status: 404, body: { error: 'No timeline' } },
      { body: [] },
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Hip-Hop Vibes')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Select station'), {
      target: { value: 'station-1' },
    });

    await waitFor(() => {
      expect(screen.getByText(/No timeline yet/)).toBeInTheDocument();
    });

    setupFetch({ status: 400, body: { error: 'Station has no tracks' } });

    fireEvent.click(screen.getByText('Assemble'));

    await waitFor(() => {
      expect(screen.getByText('Station has no tracks')).toBeInTheDocument();
    });
  });

  it('shows history and allows viewing a past timeline', async () => {
    const currentTimeline = makeTimeline();
    const historyItems = [
      makeHistoryItem({ id: 'timeline-1' }),
      makeHistoryItem({ id: 'timeline-old', created_at: '2026-03-10T08:00:00Z', entry_count: 3, total_duration_ms: 300000 }),
    ];

    setupFetch(
      { body: [makeStation()] },
      { body: currentTimeline },
      { body: historyItems },
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Hip-Hop Vibes')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Select station'), {
      target: { value: 'station-1' },
    });

    await waitFor(() => {
      expect(screen.getByText('Kill Bill')).toBeInTheDocument();
    });

    // Expand history
    fireEvent.click(screen.getByText(/History/));

    // Should see history items
    await waitFor(() => {
      expect(screen.getByText('3 entries')).toBeInTheDocument();
    });

    // Click old timeline
    const oldTimeline = makeTimeline({
      id: 'timeline-old',
      entries: [
        { type: 'segment', segment_id: 'SEG-SI-002', audio_url: '/audio/intro2.wav', duration_ms: 9000 },
        { type: 'song', canonical_id: 'drake-god', artist: 'Drake', title: "God's Plan", duration_ms: 200000 },
        { type: 'segment', segment_id: 'SEG-SO-002', audio_url: '/audio/outro2.wav', duration_ms: 7000 },
      ],
    });

    setupFetch({ body: oldTimeline });

    // Find and click the old timeline button
    const historyButtons = screen.getAllByRole('button').filter(
      (b) => b.textContent?.includes('3 entries'),
    );
    fireEvent.click(historyButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("God's Plan")).toBeInTheDocument();
    });

    // Back to current button should be visible
    expect(screen.getByText(/Back to current/)).toBeInTheDocument();
  });

  it('shows segment type badge in segment blocks', async () => {
    setupFetch(
      { body: [makeStation()] },
      { body: makeTimeline() },
      { body: [makeHistoryItem()] },
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Hip-Hop Vibes')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Select station'), {
      target: { value: 'station-1' },
    });

    await waitFor(() => {
      // Segment IDs shown as badge text
      expect(screen.getByText('SEG-SI-001')).toBeInTheDocument();
      expect(screen.getByText('SEG-TR-001')).toBeInTheDocument();
      expect(screen.getByText('SEG-SO-001')).toBeInTheDocument();
    });
  });

  it('shows loading state while stations load', () => {
    // Don't resolve the fetch
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    renderDashboard();

    expect(screen.getByText('Loading stations...')).toBeInTheDocument();
  });

  it('disables assemble button while assembling', async () => {
    setupFetch(
      { body: [makeStation()] },
      { status: 404, body: { error: 'No timeline' } },
      { body: [] },
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Hip-Hop Vibes')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Select station'), {
      target: { value: 'station-1' },
    });

    await waitFor(() => {
      expect(screen.getByText(/No timeline yet/)).toBeInTheDocument();
    });

    // Make assembly hang
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    fireEvent.click(screen.getByText('Assemble'));

    await waitFor(() => {
      expect(screen.getByText('Assembling...')).toBeInTheDocument();
      expect(screen.getByText('Assembling...')).toBeDisabled();
    });
  });

  it('formats durations correctly in timeline entries', async () => {
    const timeline = makeTimeline({
      entries: [
        { type: 'segment', segment_id: 'SEG-SI-001', audio_url: '/audio/x.wav', duration_ms: 65000 },
        { type: 'song', canonical_id: 'test-song', artist: 'Test', title: 'Song', duration_ms: 3661000 },
      ],
    });

    setupFetch(
      { body: [makeStation()] },
      { body: timeline },
      { body: [] },
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Hip-Hop Vibes')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Select station'), {
      target: { value: 'station-1' },
    });

    await waitFor(() => {
      expect(screen.getByText('1:05')).toBeInTheDocument();  // 65s
      expect(screen.getByText('61:01')).toBeInTheDocument();  // 3661s
    });
  });
});
