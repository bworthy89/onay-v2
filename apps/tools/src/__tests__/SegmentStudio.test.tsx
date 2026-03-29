import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SegmentStudio } from '../pages/SegmentStudio';
import type { Segment } from '../api';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function makeSegment(id: string, overrides: Partial<Segment> = {}): Segment {
  return {
    segment_id: id,
    type: 'transition',
    genre_tags: [],
    mood_tags: [],
    artist_refs: [],
    energy_level: 3,
    duration_ms: 5000,
    quality_score: 0.7,
    exaggeration_level: 0.5,
    created_at: '2026-03-01T00:00:00Z',
    usage_count: 0,
    audio_url: null,
    script_text: `Script for ${id}`,
    status: 'pending',
    ...overrides,
  };
}

const mockStats = {
  total: 2,
  by_type: { transition: 2 },
  avg_quality: 0.7,
  total_duration_ms: 10000,
};

beforeEach(() => {
  mockFetch.mockReset();
});

function setupDefaultResponses() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes('/api/segments/stats')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(mockStats) });
    }
    if (url.includes('/api/segments')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          segments: [makeSegment('SEG-001'), makeSegment('SEG-002')],
          total: 2,
        }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  });
}

describe('SegmentStudio', () => {
  it('renders header', async () => {
    setupDefaultResponses();
    render(<SegmentStudio />);

    expect(screen.getByText('Segment Studio')).toBeInTheDocument();
    expect(screen.getByText(/review queue/i)).toBeInTheDocument();
  });

  it('fetches and displays segments', async () => {
    setupDefaultResponses();
    render(<SegmentStudio />);

    await waitFor(() => {
      expect(screen.getByText('Script for SEG-001')).toBeInTheDocument();
      expect(screen.getByText('Script for SEG-002')).toBeInTheDocument();
    });
  });

  it('fetches and displays stats', async () => {
    setupDefaultResponses();
    render(<SegmentStudio />);

    await waitFor(() => {
      // Stats bar shows "Avg Quality" label next to the value
      expect(screen.getByText('Avg Quality')).toBeInTheDocument();
      // Total count from stats
      expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    });
  });

  it('shows error on fetch failure', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/segments/stats')) {
        return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'Server error' }) });
      }
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ error: 'Server error' }) });
    });

    render(<SegmentStudio />);

    await waitFor(() => {
      expect(screen.getByText(/Server error/)).toBeInTheDocument();
    });
  });

  it('shows empty state when no segments', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/segments/stats')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(mockStats) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ segments: [], total: 0 }),
      });
    });

    render(<SegmentStudio />);

    await waitFor(() => {
      expect(screen.getByText('No segments found.')).toBeInTheDocument();
    });
  });

  it('renders bulk approve controls', async () => {
    setupDefaultResponses();
    render(<SegmentStudio />);

    expect(screen.getByText('Approve All')).toBeInTheDocument();
    expect(screen.getByText(/bulk approve/i)).toBeInTheDocument();
  });

  it('performs bulk approve', async () => {
    setupDefaultResponses();
    render(<SegmentStudio />);

    await waitFor(() => {
      expect(screen.getByText('Script for SEG-001')).toBeInTheDocument();
    });

    // Override fetch for the bulk approve call
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/segments/bulk-approve' && opts?.method === 'POST') {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ approved_count: 3 }) });
      }
      if (url.includes('/api/segments/stats')) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(mockStats) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ segments: [makeSegment('SEG-001'), makeSegment('SEG-002')], total: 2 }),
      });
    });

    fireEvent.click(screen.getByText('Approve All'));

    await waitFor(() => {
      expect(screen.getByText(/Approved 3 segment/)).toBeInTheDocument();
    });
  });
});
