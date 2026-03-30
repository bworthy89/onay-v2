import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getStation,
  createStation,
  updateStation,
  deleteStation,
  replaceTracklist,
  type StationWithTracklist,
  type Track,
  type ReplaceTrackData,
} from '../api';

interface TrackDraft {
  key: string;
  canonical_id: string;
  artist: string;
  title: string;
  duration_ms: number;
  isrc: string;
  // present on tracks loaded from the server
  id?: string;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseDuration(str: string): number | null {
  const parts = str.split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s)) return (m * 60 + s) * 1000;
  }
  const ms = parseInt(str, 10);
  if (!isNaN(ms) && ms > 0) return ms;
  return null;
}

function generateCanonicalId(artist: string, title: string, isrc?: string): string {
  const base = `${artist.toLowerCase()} - ${title.toLowerCase()}`;
  return isrc ? `${base} [${isrc.toUpperCase()}]` : base;
}

function trackToReplaceData(t: TrackDraft): ReplaceTrackData {
  return {
    canonical_id: t.canonical_id,
    artist: t.artist,
    title: t.title,
    duration_ms: t.duration_ms,
    ...(t.isrc ? { isrc: t.isrc } : {}),
  };
}

let keyCounter = 0;
function nextKey(): string {
  return `track-${++keyCounter}`;
}

function serverTrackToDraft(t: Track): TrackDraft {
  return {
    key: nextKey(),
    id: t.id,
    canonical_id: t.canonical_id,
    artist: t.artist,
    title: t.title,
    duration_ms: t.duration_ms,
    isrc: t.isrc ?? '',
  };
}

export function StationEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isCreate = !id;

  // Station metadata
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [genreTags, setGenreTags] = useState('');
  const [moodTags, setMoodTags] = useState('');
  const [isPublished, setIsPublished] = useState(false);

  // Tracklist
  const [tracks, setTracks] = useState<TrackDraft[]>([]);

  // Add-track form
  const [newArtist, setNewArtist] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newDuration, setNewDuration] = useState('');
  const [newIsrc, setNewIsrc] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStation = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const station: StationWithTracklist = await getStation(id);
      setName(station.name);
      setDescription(station.description ?? '');
      setGenreTags(station.genre_tags.join(', '));
      setMoodTags(station.mood_tags.join(', '));
      setIsPublished(station.is_published);
      setTracks(station.tracklist.map(serverTrackToDraft));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load station');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadStation();
  }, [loadStation]);

  function parseTags(input: string): string[] {
    return input
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Station name is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (isCreate) {
        const station = await createStation({
          name: name.trim(),
          description: description.trim() || undefined,
          genre_tags: parseTags(genreTags),
          mood_tags: parseTags(moodTags),
        });
        // Save tracks if any were added
        if (tracks.length > 0) {
          try {
            await replaceTracklist(station.station_id, tracks.map(trackToReplaceData));
          } catch (err) {
            // Station was created but tracks failed — navigate to it so user can retry
            setError(err instanceof Error ? err.message : 'Station created but failed to save tracks');
            navigate(`/stations/${station.station_id}`, { replace: true });
            return;
          }
        }
        navigate(`/stations/${station.station_id}`, { replace: true });
      } else {
        await updateStation(id, {
          name: name.trim(),
          description: description.trim() || null,
          genre_tags: parseTags(genreTags),
          mood_tags: parseTags(moodTags),
          is_published: isPublished,
        });
        await replaceTracklist(id, tracks.map(trackToReplaceData));
        // Reload to sync server state
        await loadStation();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save station');
      if (!isCreate) await loadStation();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Delete this station? This cannot be undone.')) return;

    setSaving(true);
    try {
      await deleteStation(id);
      navigate('/stations', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete station');
      setSaving(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateStation(id, { is_published: !isPublished });
      setIsPublished(updated.is_published);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update publish status');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTrack = () => {
    if (!newArtist.trim() || !newTitle.trim() || !newDuration.trim()) return;
    const durationMs = parseDuration(newDuration.trim());
    if (!durationMs) {
      setError('Duration must be m:ss or milliseconds');
      return;
    }
    setTracks((prev) => [
      ...prev,
      {
        key: nextKey(),
        canonical_id: generateCanonicalId(newArtist.trim(), newTitle.trim(), newIsrc.trim() || undefined),
        artist: newArtist.trim(),
        title: newTitle.trim(),
        duration_ms: durationMs,
        isrc: newIsrc.trim(),
      },
    ]);
    setNewArtist('');
    setNewTitle('');
    setNewDuration('');
    setNewIsrc('');
    setError(null);
  };

  const moveTrack = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= tracks.length) return;
    setTracks((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const removeTrackAt = (index: number) => {
    setTracks((prev) => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return <p className="p-4 text-onay-muted text-sm">Loading...</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-onay-border">
        <div>
          <h1 className="text-xl font-semibold text-onay-text">
            {isCreate ? 'Create Station' : 'Edit Station'}
          </h1>
          <p className="text-sm text-onay-muted">
            {isCreate ? 'Set up a new radio station' : name}
          </p>
        </div>
        <div className="flex gap-2">
          {!isCreate && (
            <>
              <button
                onClick={handlePublishToggle}
                disabled={saving}
                className={`px-3 py-1.5 text-sm rounded border disabled:opacity-50 ${
                  isPublished
                    ? 'bg-green-900/40 text-green-400 border-green-700 hover:bg-green-900/60'
                    : 'bg-onay-card text-onay-muted border-onay-border hover:text-onay-text'
                }`}
              >
                {isPublished ? 'Published' : 'Draft'}
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="px-3 py-1.5 text-sm rounded bg-red-900/40 text-red-400 border border-red-700 hover:bg-red-900/60 disabled:opacity-50"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 text-red-400 text-sm">Error: {error}</div>
      )}

      {/* Metadata Form */}
      <div className="p-4 space-y-4 border-b border-onay-border">
        <div>
          <label className="block text-xs text-onay-muted uppercase tracking-wider mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Station name"
            className="w-full bg-onay-card border border-onay-border text-onay-text rounded px-3 py-2 text-sm focus:border-onay-gold outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-onay-muted uppercase tracking-wider mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this station about?"
            rows={3}
            className="w-full bg-onay-card border border-onay-border text-onay-text rounded px-3 py-2 text-sm resize-y focus:border-onay-gold outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-onay-muted uppercase tracking-wider mb-1">Genre Tags</label>
            <input
              type="text"
              value={genreTags}
              onChange={(e) => setGenreTags(e.target.value)}
              placeholder="hip-hop, r&b, soul"
              className="w-full bg-onay-card border border-onay-border text-onay-text rounded px-3 py-2 text-sm focus:border-onay-gold outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-onay-muted uppercase tracking-wider mb-1">Mood Tags</label>
            <input
              type="text"
              value={moodTags}
              onChange={(e) => setMoodTags(e.target.value)}
              placeholder="chill, late-night, vibes"
              className="w-full bg-onay-card border border-onay-border text-onay-text rounded px-3 py-2 text-sm focus:border-onay-gold outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tracklist */}
      <div className="p-4">
        <h2 className="text-sm font-semibold text-onay-text mb-3">
          Tracklist
          {tracks.length > 0 && (
            <span className="text-onay-muted font-normal ml-2">({tracks.length} tracks)</span>
          )}
        </h2>

        {tracks.length === 0 && (
          <p className="text-xs text-onay-muted mb-4">No tracks yet. Add tracks below.</p>
        )}

        {/* Track rows */}
        <div className="space-y-1 mb-4">
          {tracks.map((track, i) => (
            <div
              key={track.key}
              className="flex items-center gap-2 border-l-2 border-l-onay-gold border border-onay-border rounded bg-onay-card px-3 py-2"
            >
              <span className="text-xs text-onay-muted w-6 shrink-0 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-onay-text">{track.artist}</span>
                <span className="text-onay-muted mx-1.5">&mdash;</span>
                <span className="text-sm text-onay-text/80">{track.title}</span>
              </div>
              <span className="text-xs text-onay-muted shrink-0">{formatDuration(track.duration_ms)}</span>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => moveTrack(i, -1)}
                  disabled={i === 0}
                  className="w-6 h-6 text-xs rounded border border-onay-border text-onay-muted hover:text-onay-text disabled:opacity-20"
                  aria-label={`Move ${track.artist} — ${track.title} up`}
                >
                  &#9650;
                </button>
                <button
                  onClick={() => moveTrack(i, 1)}
                  disabled={i === tracks.length - 1}
                  className="w-6 h-6 text-xs rounded border border-onay-border text-onay-muted hover:text-onay-text disabled:opacity-20"
                  aria-label={`Move ${track.artist} — ${track.title} down`}
                >
                  &#9660;
                </button>
                <button
                  onClick={() => removeTrackAt(i)}
                  className="w-6 h-6 text-xs rounded border border-red-700 text-red-400 hover:bg-red-900/40"
                  aria-label={`Remove ${track.artist} — ${track.title}`}
                >
                  &#10005;
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Track Form */}
        <div className="border border-onay-border rounded bg-onay-card p-3">
          <h3 className="text-xs text-onay-muted uppercase tracking-wider mb-2">Add Track</h3>
          <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
            <div>
              <label className="block text-xs text-onay-muted mb-1">Artist</label>
              <input
                type="text"
                value={newArtist}
                onChange={(e) => setNewArtist(e.target.value)}
                placeholder="Artist name"
                className="w-full bg-onay-bg border border-onay-border text-onay-text rounded px-2 py-1.5 text-sm focus:border-onay-gold outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTrack()}
              />
            </div>
            <div>
              <label className="block text-xs text-onay-muted mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Track title"
                className="w-full bg-onay-bg border border-onay-border text-onay-text rounded px-2 py-1.5 text-sm focus:border-onay-gold outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTrack()}
              />
            </div>
            <div>
              <label className="block text-xs text-onay-muted mb-1">Duration</label>
              <input
                type="text"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
                placeholder="3:45"
                className="w-24 bg-onay-bg border border-onay-border text-onay-text rounded px-2 py-1.5 text-sm focus:border-onay-gold outline-none"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTrack()}
              />
            </div>
            <button
              onClick={handleAddTrack}
              className="px-3 py-1.5 text-sm rounded bg-onay-gold/20 text-onay-gold border border-onay-gold/40 hover:bg-onay-gold/30"
            >
              Add
            </button>
          </div>
          <div className="mt-2">
            <label className="block text-xs text-onay-muted mb-1">ISRC (optional)</label>
            <input
              type="text"
              value={newIsrc}
              onChange={(e) => setNewIsrc(e.target.value)}
              placeholder="e.g. USRC12345678"
              className="w-64 bg-onay-bg border border-onay-border text-onay-text rounded px-2 py-1.5 text-sm focus:border-onay-gold outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleAddTrack()}
            />
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 flex items-center gap-3 p-4 border-t border-onay-border bg-onay-bg">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm rounded bg-onay-gold/20 text-onay-gold border border-onay-gold/40 hover:bg-onay-gold/30 disabled:opacity-50"
        >
          {saving ? 'Saving...' : isCreate ? 'Create Station' : 'Save Changes'}
        </button>
        <button
          onClick={() => navigate('/stations')}
          className="px-4 py-2 text-sm rounded border border-onay-border text-onay-muted hover:text-onay-text"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
