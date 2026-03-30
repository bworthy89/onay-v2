import { useState, useEffect, useCallback, useRef } from 'react';
import type { Station, Timeline, TimelineEntry, TimelineHistoryItem } from '../api';
import {
  getStations,
  getTimeline,
  getTimelineHistory,
  getTimelineById,
  triggerAssembly,
} from '../api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDurationLong(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

// ---------------------------------------------------------------------------
// SegmentPlayer — inline play/stop for segment blocks
// ---------------------------------------------------------------------------

function SegmentPlayer({ src }: { src?: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  if (!src) return null;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  const handleEnded = () => setPlaying(false);

  return (
    <>
      <audio ref={audioRef} src={src} onEnded={handleEnded} preload="none" />
      <button
        onClick={(e) => { e.stopPropagation(); toggle(); }}
        className="w-6 h-6 flex items-center justify-center rounded bg-onay-bg border border-onay-border hover:border-onay-gold text-xs shrink-0"
        aria-label={playing ? 'Stop segment' : 'Play segment'}
      >
        {playing ? '\u25A0' : '\u25B6'}
      </button>
    </>
  );
}

// ---------------------------------------------------------------------------
// TimelineBlock — renders a single song or segment entry
// ---------------------------------------------------------------------------

function TimelineBlock({ entry, index }: { entry: TimelineEntry; index: number }) {
  if (entry.type === 'song') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-onay-card border border-onay-border rounded">
        <span className="text-xs text-onay-muted w-6 text-right shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-onay-text truncate">{entry.title}</div>
          <div className="text-xs text-onay-muted truncate">{entry.artist}</div>
        </div>
        <span className="text-xs text-onay-muted shrink-0">{formatDuration(entry.duration_ms)}</span>
      </div>
    );
  }

  // Segment entry
  const typeLabel = entry.segment_type
    ? entry.segment_type.replace(/_/g, ' ')
    : entry.segment_id ?? 'segment';

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-onay-card border border-onay-border border-l-2 border-l-onay-gold rounded">
      <span className="text-xs text-onay-muted w-6 text-right shrink-0">{index + 1}</span>
      <SegmentPlayer src={entry.audio_url} />
      <div className="flex-1 min-w-0">
        <span className="text-xs px-2 py-0.5 rounded border border-onay-gold text-onay-gold">
          {typeLabel}
        </span>
        {entry.script_text && (
          <p className="text-xs text-onay-muted mt-1 truncate">{entry.script_text}</p>
        )}
      </div>
      <span className="text-xs text-onay-muted shrink-0">{formatDuration(entry.duration_ms)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimelineView — displays timeline stats + entry list
// ---------------------------------------------------------------------------

function TimelineView({ timeline }: { timeline: Timeline }) {
  const stats = {
    songCount: timeline.entries.filter((e) => e.type === 'song').length,
    segmentCount: timeline.entries.filter((e) => e.type === 'segment').length,
    totalDuration: timeline.entries.reduce((sum, e) => sum + e.duration_ms, 0),
  };

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 text-xs text-onay-muted px-1">
        <span>{stats.songCount} songs</span>
        <span>{stats.segmentCount} segments</span>
        <span>{formatDurationLong(stats.totalDuration)} total</span>
        <span>Created {formatDate(timeline.created_at)}</span>
      </div>

      {/* Entry list */}
      <div className="space-y-1.5">
        {timeline.entries.map((entry, i) => {
          const key = entry.type === 'segment'
            ? `seg-${entry.segment_id}-${i}`
            : `song-${entry.canonical_id}-${i}`;
          return <TimelineBlock key={key} entry={entry} index={i} />;
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssemblyDashboard
// ---------------------------------------------------------------------------

export function AssemblyDashboard() {
  // Station list
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [loadingStations, setLoadingStations] = useState(true);

  // Current timeline
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Assembly
  const [assembling, setAssembling] = useState(false);

  // History
  const [history, setHistory] = useState<TimelineHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [viewingHistoricId, setViewingHistoricId] = useState<string | null>(null);
  const [historicTimeline, setHistoricTimeline] = useState<Timeline | null>(null);
  const [loadingHistoric, setLoadingHistoric] = useState(false);

  // Error / success
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load stations
  useEffect(() => {
    getStations()
      .then((s) => {
        setStations(s);
        setLoadingStations(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load stations');
        setLoadingStations(false);
      });
  }, []);

  // Load current timeline when station changes
  const loadTimeline = useCallback(async (stationId: string) => {
    if (!stationId) {
      setTimeline(null);
      setHistory([]);
      return;
    }
    setLoadingTimeline(true);
    setError(null);
    setSuccess(null);
    setViewingHistoricId(null);
    setHistoricTimeline(null);

    try {
      const tl = await getTimeline(stationId);
      setTimeline(tl);
    } catch {
      // 404 means no timeline yet — that's fine
      setTimeline(null);
    }

    try {
      const h = await getTimelineHistory(stationId, 20);
      setHistory(h);
    } catch {
      setHistory([]);
    }

    setLoadingTimeline(false);
  }, []);

  useEffect(() => {
    if (selectedStationId) {
      loadTimeline(selectedStationId);
    }
  }, [selectedStationId, loadTimeline]);

  // Assemble
  const handleAssemble = async () => {
    if (!selectedStationId) return;
    setAssembling(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await triggerAssembly(selectedStationId);
      setTimeline(result);
      setSuccess(
        `Assembly complete — ${result.stats.song_count} songs, ${result.stats.segment_count} segments`,
      );
      // Refresh history
      try {
        const h = await getTimelineHistory(selectedStationId, 20);
        setHistory(h);
      } catch { /* ignore */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assembly failed');
    } finally {
      setAssembling(false);
    }
  };

  // View historic timeline
  const handleViewHistoric = async (id: string) => {
    if (id === viewingHistoricId) {
      setViewingHistoricId(null);
      setHistoricTimeline(null);
      return;
    }
    setLoadingHistoric(true);
    setViewingHistoricId(id);
    try {
      const tl = await getTimelineById(id);
      setHistoricTimeline(tl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline');
      setViewingHistoricId(null);
      setHistoricTimeline(null);
    } finally {
      setLoadingHistoric(false);
    }
  };

  const handleBackToCurrent = () => {
    setViewingHistoricId(null);
    setHistoricTimeline(null);
  };

  // Which timeline to display
  const displayedTimeline = viewingHistoricId ? historicTimeline : timeline;
  const isViewingHistoric = viewingHistoricId !== null;

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-onay-text">Assembly Dashboard</h1>
          <p className="text-sm text-onay-muted">Assemble show timelines from tracks + segment library</p>
        </div>
      </div>

      {/* Station selector + Assemble button */}
      <div className="flex items-center gap-3">
        <select
          value={selectedStationId}
          onChange={(e) => setSelectedStationId(e.target.value)}
          className="flex-1 bg-onay-card border border-onay-border text-onay-text rounded px-3 py-2 text-sm focus:border-onay-gold outline-none"
          disabled={loadingStations}
          aria-label="Select station"
        >
          <option value="">
            {loadingStations ? 'Loading stations...' : 'Select a station'}
          </option>
          {stations.map((s) => (
            <option key={s.station_id} value={s.station_id}>
              {s.name}
            </option>
          ))}
        </select>

        <button
          onClick={handleAssemble}
          disabled={!selectedStationId || assembling}
          className="px-4 py-2 text-sm rounded bg-onay-gold/20 text-onay-gold border border-onay-gold/40 hover:bg-onay-gold/30 disabled:opacity-50"
        >
          {assembling ? 'Assembling...' : 'Assemble'}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-900/40 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 text-sm text-green-400 bg-green-900/20 border border-green-900/40 rounded">
          {success}
        </div>
      )}

      {/* Loading */}
      {loadingTimeline && (
        <div className="p-4 text-sm text-onay-muted">Loading timeline...</div>
      )}

      {/* Timeline visualization */}
      {!loadingTimeline && selectedStationId && (
        <div className="space-y-4">
          {isViewingHistoric && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToCurrent}
                className="px-3 py-1.5 text-sm rounded border border-onay-border text-onay-muted hover:text-onay-text"
              >
                &larr; Back to current
              </button>
              <span className="text-xs text-onay-muted">
                Viewing historic timeline
              </span>
            </div>
          )}

          {loadingHistoric ? (
            <div className="p-4 text-sm text-onay-muted">Loading timeline...</div>
          ) : displayedTimeline ? (
            <TimelineView timeline={displayedTimeline} />
          ) : (
            <div className="p-8 text-center text-sm text-onay-muted">
              No timeline yet — click Assemble to create one
            </div>
          )}
        </div>
      )}

      {/* History section */}
      {!loadingTimeline && selectedStationId && history.length > 0 && (
        <div className="space-y-3 border-t border-onay-border pt-4">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-sm text-onay-muted hover:text-onay-text"
          >
            {showHistory ? '\u25BC' : '\u25B6'} History ({history.length})
          </button>

          {showHistory && (
            <div className="space-y-1.5">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleViewHistoric(item.id)}
                  className={`w-full text-left flex items-center gap-4 px-4 py-2 rounded border text-sm ${
                    viewingHistoricId === item.id
                      ? 'border-onay-gold bg-onay-gold/10 text-onay-gold'
                      : 'border-onay-border bg-onay-card text-onay-text hover:border-onay-gold/40'
                  }`}
                >
                  <span className="flex-1 truncate">{formatDate(item.created_at)}</span>
                  <span className="text-xs text-onay-muted">{item.entry_count} entries</span>
                  <span className="text-xs text-onay-muted">{formatDurationLong(item.total_duration_ms)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
