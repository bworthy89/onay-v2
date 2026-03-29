import { useState, useEffect, useCallback } from 'react';
import {
  getSegments,
  getStats,
  bulkApprove,
  type Segment,
  type SegmentFilters,
  type LibraryStats,
} from '../api';
import { StatsBar } from '../components/StatsBar';
import { FilterBar } from '../components/FilterBar';
import { SegmentCard } from '../components/SegmentCard';

const PAGE_SIZE = 20;

export function SegmentStudio() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [filters, setFilters] = useState<SegmentFilters>({ limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk approve state
  const [bulkThreshold, setBulkThreshold] = useState(0.7);
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  const fetchSegments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getSegments(filters);
      setSegments(res.segments);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch segments');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchStats = useCallback(async () => {
    try {
      setStats(await getStats());
    } catch {
      // Stats are non-critical
    }
  }, []);

  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleFiltersChange = (newFilters: SegmentFilters) => {
    setFilters({ ...newFilters, limit: PAGE_SIZE, offset: 0 });
  };

  const handleSegmentUpdated = (updated: Segment) => {
    setSegments((prev) =>
      prev.map((s) => (s.segment_id === updated.segment_id ? updated : s))
    );
    fetchStats();
  };

  const handleBulkApprove = async () => {
    setBulkPending(true);
    setBulkResult(null);
    try {
      const res = await bulkApprove(bulkThreshold);
      setBulkResult(`Approved ${res.approved_count} segment(s)`);
      fetchSegments();
      fetchStats();
    } catch (err) {
      setBulkResult(err instanceof Error ? err.message : 'Bulk approve failed');
    } finally {
      setBulkPending(false);
    }
  };

  const page = Math.floor((filters.offset ?? 0) / PAGE_SIZE);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const goToPage = (p: number) => {
    setFilters((prev) => ({ ...prev, offset: p * PAGE_SIZE }));
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="p-4 border-b border-onay-border">
        <h1 className="text-xl font-semibold text-onay-text">
          Segment Studio
        </h1>
        <p className="text-sm text-onay-muted">Review queue — approve, reject, or regenerate voice segments</p>
      </div>

      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Filters */}
      <FilterBar filters={filters} onChange={handleFiltersChange} />

      {/* Bulk Actions */}
      <div className="flex items-center gap-3 p-4 border-b border-onay-border text-sm">
        <span className="text-onay-muted">Bulk approve pending above</span>
        <input
          type="number"
          min="0"
          max="1"
          step="0.05"
          value={bulkThreshold}
          onChange={(e) => setBulkThreshold(parseFloat(e.target.value) || 0)}
          className="w-20 bg-onay-card border border-onay-border text-onay-text rounded px-2 py-1 text-sm"
        />
        <button
          onClick={handleBulkApprove}
          disabled={bulkPending}
          className="px-3 py-1 rounded bg-onay-gold/20 text-onay-gold border border-onay-gold/40 hover:bg-onay-gold/30 disabled:opacity-50"
        >
          {bulkPending ? 'Approving...' : 'Approve All'}
        </button>
        {bulkResult && (
          <span className="text-xs text-onay-muted">{bulkResult}</span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 text-red-400 text-sm">Error: {error}</div>
      )}

      {/* Segment List */}
      <div className="p-4 space-y-3">
        {loading && segments.length === 0 && (
          <p className="text-onay-muted text-sm">Loading...</p>
        )}

        {!loading && segments.length === 0 && (
          <p className="text-onay-muted text-sm">No segments found.</p>
        )}

        {segments.map((seg) => (
          <SegmentCard
            key={seg.segment_id}
            segment={seg}
            onUpdated={handleSegmentUpdated}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 p-4 border-t border-onay-border text-sm">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 0}
            className="px-2 py-1 rounded border border-onay-border text-onay-muted hover:text-onay-text disabled:opacity-30"
          >
            Prev
          </button>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => {
            // Show pages around current page
            let p: number;
            if (totalPages <= 10) {
              p = i;
            } else if (page < 5) {
              p = i;
            } else if (page > totalPages - 6) {
              p = totalPages - 10 + i;
            } else {
              p = page - 5 + i;
            }
            return (
              <button
                key={p}
                onClick={() => goToPage(p)}
                className={`w-8 h-8 rounded border text-xs ${
                  p === page
                    ? 'border-onay-gold text-onay-gold bg-onay-gold/10'
                    : 'border-onay-border text-onay-muted hover:text-onay-text'
                }`}
              >
                {p + 1}
              </button>
            );
          })}
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="px-2 py-1 rounded border border-onay-border text-onay-muted hover:text-onay-text disabled:opacity-30"
          >
            Next
          </button>
          <span className="text-xs text-onay-muted ml-2">
            {total} total
          </span>
        </div>
      )}
    </div>
  );
}
