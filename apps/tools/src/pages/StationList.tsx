import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getStations, type Station } from '../api';

export function StationList() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStations(await getStations());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-onay-border">
        <div>
          <h1 className="text-xl font-semibold text-onay-text">Stations</h1>
          <p className="text-sm text-onay-muted">Manage radio stations and tracklists</p>
        </div>
        <Link
          to="/stations/new"
          className="px-4 py-2 text-sm rounded bg-onay-gold/20 text-onay-gold border border-onay-gold/40 hover:bg-onay-gold/30"
        >
          Create New Station
        </Link>
      </div>

      {error && (
        <div className="p-4 text-red-400 text-sm">Error: {error}</div>
      )}

      {loading && stations.length === 0 && (
        <p className="p-4 text-onay-muted text-sm">Loading...</p>
      )}

      {!loading && stations.length === 0 && !error && (
        <p className="p-4 text-onay-muted text-sm">No stations yet. Create one to get started.</p>
      )}

      {/* Station Grid */}
      <div className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stations.map((station) => (
          <StationCard key={station.station_id} station={station} />
        ))}
      </div>
    </div>
  );
}

function StationCard({ station }: { station: Station }) {
  return (
    <Link
      to={`/stations/${station.station_id}`}
      className="block border-l-2 border-l-onay-gold border border-onay-border rounded bg-onay-card p-4 hover:border-onay-gold/60 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-sm font-semibold text-onay-text truncate">{station.name}</h2>
        {station.is_published ? (
          <span className="text-xs px-2 py-0.5 rounded border bg-green-900/50 text-green-400 border-green-700 shrink-0">
            Published
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded border bg-onay-card text-onay-muted border-onay-border shrink-0">
            Draft
          </span>
        )}
      </div>

      {station.description && (
        <p className="text-xs text-onay-muted mb-3 line-clamp-2">{station.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {station.genre_tags.map((tag) => (
          <span key={`g-${tag}`} className="text-xs px-1.5 py-0.5 rounded bg-onay-bg border border-onay-border text-onay-muted">
            {tag}
          </span>
        ))}
        {station.mood_tags.map((tag) => (
          <span key={`m-${tag}`} className="text-xs px-1.5 py-0.5 rounded bg-onay-bg border border-onay-border text-onay-gold/70">
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}
