import type { LibraryStats } from '../api';

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface StatsBarProps {
  stats: LibraryStats | null;
}

export function StatsBar({ stats }: StatsBarProps) {
  if (!stats) {
    return (
      <div className="flex gap-6 p-4 border-b border-onay-border text-onay-muted text-sm">
        Loading stats...
      </div>
    );
  }

  const topTypes = Object.entries(stats.by_type)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="flex flex-wrap gap-6 p-4 border-b border-onay-border text-sm">
      <div>
        <span className="text-onay-muted">Total</span>{' '}
        <span className="font-semibold">{stats.total}</span>
      </div>
      <div>
        <span className="text-onay-muted">Avg Quality</span>{' '}
        <span className="font-semibold">{stats.avg_quality.toFixed(2)}</span>
      </div>
      <div>
        <span className="text-onay-muted">Duration</span>{' '}
        <span className="font-semibold">{formatDuration(stats.total_duration_ms)}</span>
      </div>
      {topTypes.map(([type, count]) => (
        <div key={type}>
          <span className="text-onay-muted">{type.replace(/_/g, ' ')}</span>{' '}
          <span className="font-semibold">{count}</span>
        </div>
      ))}
    </div>
  );
}
