import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SegmentCard } from '../components/SegmentCard';
import type { Segment } from '../api';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function makeSegment(overrides: Partial<Segment> = {}): Segment {
  return {
    segment_id: 'SEG-TR-00001',
    type: 'transition',
    genre_tags: ['hip-hop'],
    mood_tags: ['chill'],
    artist_refs: ['SZA'],
    energy_level: 3,
    duration_ms: 6000,
    quality_score: 0.85,
    exaggeration_level: 0.5,
    created_at: '2026-03-01T00:00:00Z',
    usage_count: 2,
    audio_url: null,
    script_text: 'And we keep it rolling with more vibes coming your way...',
    status: 'pending',
    ...overrides,
  };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('SegmentCard', () => {
  it('displays segment metadata', () => {
    render(<SegmentCard segment={makeSegment()} onUpdated={() => {}} />);

    expect(screen.getByText('SEG-TR-00001')).toBeInTheDocument();
    expect(screen.getByText('transition')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('hip-hop')).toBeInTheDocument();
    expect(screen.getByText('chill')).toBeInTheDocument();
    expect(screen.getByText('SZA')).toBeInTheDocument();
    expect(screen.getByText('0.85')).toBeInTheDocument();
    expect(screen.getByText('0:06')).toBeInTheDocument();
  });

  it('shows approved status badge', () => {
    render(<SegmentCard segment={makeSegment({ status: 'approved' })} onUpdated={() => {}} />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('shows rejected status badge', () => {
    render(<SegmentCard segment={makeSegment({ status: 'rejected' })} onUpdated={() => {}} />);
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('truncates long scripts with show more button', () => {
    const longScript = 'A'.repeat(200);
    render(<SegmentCard segment={makeSegment({ script_text: longScript })} onUpdated={() => {}} />);

    expect(screen.getByText('Show more')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Show more'));
    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  it('does not show expand button for short scripts', () => {
    render(<SegmentCard segment={makeSegment({ script_text: 'Short.' })} onUpdated={() => {}} />);
    expect(screen.queryByText('Show more')).not.toBeInTheDocument();
  });

  it('calls approve API on approve click', async () => {
    const updated = makeSegment({ status: 'approved' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(updated) });

    const onUpdated = vi.fn();
    render(<SegmentCard segment={makeSegment()} onUpdated={onUpdated} />);

    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(updated);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/segments/SEG-TR-00001',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ status: 'approved' }),
      })
    );
  });

  it('calls reject API on reject click', async () => {
    const updated = makeSegment({ status: 'rejected' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(updated) });

    const onUpdated = vi.fn();
    render(<SegmentCard segment={makeSegment()} onUpdated={onUpdated} />);

    fireEvent.click(screen.getByText('Reject'));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(updated);
    });
  });

  it('calls regenerate (pending) API on regenerate click', async () => {
    const updated = makeSegment({ status: 'pending' });
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(updated) });

    const onUpdated = vi.fn();
    render(<SegmentCard segment={makeSegment({ status: 'approved' })} onUpdated={onUpdated} />);

    fireEvent.click(screen.getByText('Regenerate'));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(updated);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/segments/SEG-TR-00001',
      expect.objectContaining({
        body: JSON.stringify({ status: 'pending' }),
      })
    );
  });

  it('shows quality in red when below 0.5', () => {
    render(<SegmentCard segment={makeSegment({ quality_score: 0.3 })} onUpdated={() => {}} />);
    const qualityEl = screen.getByText('0.30');
    expect(qualityEl.className).toContain('text-red-400');
  });

  it('shows quality in yellow when between 0.5 and 0.8', () => {
    render(<SegmentCard segment={makeSegment({ quality_score: 0.65 })} onUpdated={() => {}} />);
    const qualityEl = screen.getByText('0.65');
    expect(qualityEl.className).toContain('text-yellow-400');
  });

  it('shows quality in green when above 0.8', () => {
    render(<SegmentCard segment={makeSegment({ quality_score: 0.9 })} onUpdated={() => {}} />);
    const qualityEl = screen.getByText('0.90');
    expect(qualityEl.className).toContain('text-green-400');
  });

  it('shows no audio message when audio_url is null', () => {
    render(<SegmentCard segment={makeSegment({ audio_url: null })} onUpdated={() => {}} />);
    expect(screen.getByText('No audio')).toBeInTheDocument();
  });
});
