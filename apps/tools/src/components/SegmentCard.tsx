import { useState } from 'react';
import type { Segment } from '../api';
import { updateSegment } from '../api';
import { AudioPlayer } from './AudioPlayer';

function qualityColor(score: number): string {
  if (score < 0.5) return 'text-red-400';
  if (score <= 0.8) return 'text-yellow-400';
  return 'text-green-400';
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'approved':
      return { label: 'Approved', cls: 'bg-green-900/50 text-green-400 border-green-700' };
    case 'rejected':
      return { label: 'Rejected', cls: 'bg-red-900/50 text-red-400 border-red-700' };
    default:
      return { label: 'Pending', cls: 'bg-onay-card text-onay-muted border-onay-border' };
  }
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SegmentCardProps {
  segment: Segment;
  onUpdated: (updated: Segment) => void;
}

export function SegmentCard({ segment, onUpdated }: SegmentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (status: 'approved' | 'rejected' | 'pending') => {
    setLoading(status);
    try {
      const updated = await updateSegment(segment.segment_id, { status });
      onUpdated(updated);
    } catch (err) {
      console.error('Failed to update segment:', err);
    } finally {
      setLoading(null);
    }
  };

  const badge = statusBadge(segment.status);
  const scriptPreview =
    !expanded && segment.script_text.length > 150
      ? segment.script_text.slice(0, 150) + '...'
      : segment.script_text;

  return (
    <div className="border-l-2 border-l-onay-gold border border-onay-border rounded bg-onay-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <code className="text-xs text-onay-muted">{segment.segment_id}</code>
        <span className="text-xs px-2 py-0.5 rounded border border-onay-gold text-onay-gold">
          {segment.type.replace(/_/g, ' ')}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded border ${badge.cls}`}>
          {badge.label}
        </span>
      </div>

      {/* Script */}
      <div className="text-sm leading-relaxed">
        <p className="italic text-onay-text/80">{scriptPreview}</p>
        {segment.script_text.length > 150 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-onay-gold mt-1 hover:underline"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {segment.genre_tags.map((tag) => (
          <span key={`g-${tag}`} className="text-xs px-1.5 py-0.5 rounded bg-onay-bg border border-onay-border text-onay-muted">
            {tag}
          </span>
        ))}
        {segment.mood_tags.map((tag) => (
          <span key={`m-${tag}`} className="text-xs px-1.5 py-0.5 rounded bg-onay-bg border border-onay-border text-onay-gold/70">
            {tag}
          </span>
        ))}
        {segment.artist_refs.map((artist) => (
          <span key={`a-${artist}`} className="text-xs px-1.5 py-0.5 rounded bg-onay-gold/10 border border-onay-gold/30 text-onay-gold">
            {artist}
          </span>
        ))}
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-onay-muted">
        <div title={`Energy: ${segment.energy_level}/5`}>
          Energy{' '}
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < segment.energy_level ? 'text-onay-gold' : 'text-onay-border'}>
              {'\u25CF'}
            </span>
          ))}
        </div>
        <div>
          Quality{' '}
          <span className={`font-semibold ${qualityColor(segment.quality_score)}`}>
            {segment.quality_score.toFixed(2)}
          </span>
        </div>
        <div>{formatDuration(segment.duration_ms)}</div>
        <div>Exagg: {segment.exaggeration_level.toFixed(1)}</div>
        <div>Used: {segment.usage_count}x</div>
      </div>

      {/* Audio */}
      <AudioPlayer src={segment.audio_url} />

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => handleAction('approved')}
          disabled={loading !== null}
          className="px-3 py-1 text-xs rounded bg-green-900/40 text-green-400 border border-green-700 hover:bg-green-900/60 disabled:opacity-50"
        >
          {loading === 'approved' ? '...' : 'Approve'}
        </button>
        <button
          onClick={() => handleAction('rejected')}
          disabled={loading !== null}
          className="px-3 py-1 text-xs rounded bg-red-900/40 text-red-400 border border-red-700 hover:bg-red-900/60 disabled:opacity-50"
        >
          {loading === 'rejected' ? '...' : 'Reject'}
        </button>
        <button
          onClick={() => handleAction('pending')}
          disabled={loading !== null}
          className="px-3 py-1 text-xs rounded bg-yellow-900/40 text-yellow-400 border border-yellow-700 hover:bg-yellow-900/60 disabled:opacity-50"
        >
          {loading === 'pending' ? '...' : 'Regenerate'}
        </button>
      </div>
    </div>
  );
}
