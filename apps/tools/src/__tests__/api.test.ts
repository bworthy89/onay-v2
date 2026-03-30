import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSegments, updateSegment, deleteSegment, bulkApprove, getStats,
  getTimeline, getTimelineHistory, getTimelineById, triggerAssembly,
} from '../api';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

beforeEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  };
}

describe('api client', () => {
  describe('getSegments', () => {
    it('fetches segments with no filters', async () => {
      const payload = { segments: [], total: 0 };
      mockFetch.mockResolvedValueOnce(jsonResponse(payload));

      const result = await getSegments();
      expect(mockFetch).toHaveBeenCalledWith('/api/segments', undefined);
      expect(result).toEqual(payload);
    });

    it('builds query params from filters', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ segments: [], total: 0 }));

      await getSegments({ type: 'transition', genre: 'hip-hop', qualityMin: 0.5, limit: 10, offset: 20 });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('type=transition');
      expect(url).toContain('genre=hip-hop');
      expect(url).toContain('qualityMin=0.5');
      expect(url).toContain('limit=10');
      expect(url).toContain('offset=20');
    });

    it('omits undefined filter params', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ segments: [], total: 0 }));

      await getSegments({ type: 'ad_lib' });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('type=ad_lib');
      expect(url).not.toContain('genre');
      expect(url).not.toContain('mood');
    });
  });

  describe('updateSegment', () => {
    it('sends PUT with JSON body', async () => {
      const updated = { segment_id: 'SEG-TR-001', status: 'approved' };
      mockFetch.mockResolvedValueOnce(jsonResponse(updated));

      const result = await updateSegment('SEG-TR-001', { status: 'approved' });

      expect(mockFetch).toHaveBeenCalledWith('/api/segments/SEG-TR-001', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      expect(result).toEqual(updated);
    });

    it('encodes segment ID in URL', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}));

      await updateSegment('SEG/TR-001', { status: 'rejected' });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toBe('/api/segments/SEG%2FTR-001');
    });
  });

  describe('deleteSegment', () => {
    it('sends DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(undefined) });

      await deleteSegment('SEG-TR-001');

      expect(mockFetch).toHaveBeenCalledWith('/api/segments/SEG-TR-001', { method: 'DELETE' });
    });
  });

  describe('bulkApprove', () => {
    it('sends POST with threshold', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ approved_count: 5 }));

      const result = await bulkApprove(0.7);

      expect(mockFetch).toHaveBeenCalledWith('/api/segments/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality_threshold: 0.7 }),
      });
      expect(result.approved_count).toBe(5);
    });
  });

  describe('getStats', () => {
    it('fetches stats', async () => {
      const stats = { total: 100, by_type: { transition: 30 }, avg_quality: 0.75, total_duration_ms: 300000 };
      mockFetch.mockResolvedValueOnce(jsonResponse(stats));

      const result = await getStats();

      expect(mockFetch).toHaveBeenCalledWith('/api/segments/stats', undefined);
      expect(result).toEqual(stats);
    });
  });

  describe('getTimeline', () => {
    it('fetches current timeline for station', async () => {
      const timeline = { id: 'tl-1', station_id: 's-1', created_at: '2026-03-01', entries: [] };
      mockFetch.mockResolvedValueOnce(jsonResponse(timeline));

      const result = await getTimeline('s-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/stations/s-1/timeline', undefined);
      expect(result).toEqual(timeline);
    });

    it('encodes station ID', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({ id: 'tl-1', entries: [] }));

      await getTimeline('s/1');

      expect(mockFetch.mock.calls[0][0]).toBe('/api/stations/s%2F1/timeline');
    });
  });

  describe('getTimelineHistory', () => {
    it('fetches history with limit', async () => {
      const history = [{ id: 'tl-1', created_at: '2026-03-01', entry_count: 5, total_duration_ms: 100000 }];
      mockFetch.mockResolvedValueOnce(jsonResponse(history));

      const result = await getTimelineHistory('s-1', 10);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/api/stations/s-1/timeline/history');
      expect(url).toContain('limit=10');
      expect(result).toEqual(history);
    });

    it('omits limit when not provided', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await getTimelineHistory('s-1');

      expect(mockFetch.mock.calls[0][0]).toBe('/api/stations/s-1/timeline/history');
    });
  });

  describe('getTimelineById', () => {
    it('fetches timeline by ID', async () => {
      const timeline = { id: 'tl-1', station_id: 's-1', entries: [] };
      mockFetch.mockResolvedValueOnce(jsonResponse(timeline));

      const result = await getTimelineById('tl-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/timelines/tl-1', undefined);
      expect(result).toEqual(timeline);
    });
  });

  describe('triggerAssembly', () => {
    it('sends POST to assemble endpoint', async () => {
      const result = { id: 'tl-1', station_id: 's-1', entries: [], stats: {} };
      mockFetch.mockResolvedValueOnce(jsonResponse(result, 201));

      const response = await triggerAssembly('s-1');

      expect(mockFetch).toHaveBeenCalledWith('/api/stations/s-1/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(response).toEqual(result);
    });
  });

  describe('error handling', () => {
    it('throws on non-ok response with error message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Segment not found' }),
      });

      await expect(getStats()).rejects.toThrow('Segment not found');
    });

    it('throws generic message when response has no error field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('invalid json')),
      });

      await expect(getStats()).rejects.toThrow('Request failed: 500');
    });
  });
});
