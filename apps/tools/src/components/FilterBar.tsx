import { SEGMENT_TYPES, type SegmentFilters, type SegmentType } from '../api';

interface FilterBarProps {
  filters: SegmentFilters;
  onChange: (filters: SegmentFilters) => void;
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  const update = (patch: Partial<SegmentFilters>) => {
    onChange({ ...filters, ...patch, offset: 0 });
  };

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 border-b border-onay-border">
      <div className="flex flex-col gap-1">
        <label htmlFor="filter-type" className="text-xs text-onay-muted uppercase tracking-wider">Type</label>
        <select
          id="filter-type"
          value={filters.type ?? ''}
          onChange={(e) => update({ type: (e.target.value || undefined) as SegmentType | undefined })}
          className="bg-onay-card border border-onay-border text-onay-text rounded px-2 py-1.5 text-sm"
        >
          <option value="">All</option>
          {SEGMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-genre" className="text-xs text-onay-muted uppercase tracking-wider">Genre</label>
        <input
          id="filter-genre"
          type="text"
          placeholder="e.g. hip-hop"
          value={filters.genre ?? ''}
          onChange={(e) => update({ genre: e.target.value || undefined })}
          className="bg-onay-card border border-onay-border text-onay-text rounded px-2 py-1.5 text-sm w-32"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-mood" className="text-xs text-onay-muted uppercase tracking-wider">Mood</label>
        <input
          id="filter-mood"
          type="text"
          placeholder="e.g. chill"
          value={filters.mood ?? ''}
          onChange={(e) => update({ mood: e.target.value || undefined })}
          className="bg-onay-card border border-onay-border text-onay-text rounded px-2 py-1.5 text-sm w-32"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-quality" className="text-xs text-onay-muted uppercase tracking-wider">
          Min Quality: {(filters.qualityMin ?? 0).toFixed(1)}
        </label>
        <input
          id="filter-quality"
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={filters.qualityMin ?? 0}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            update({ qualityMin: val > 0 ? val : undefined });
          }}
          className="w-32 accent-onay-gold"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="filter-search" className="text-xs text-onay-muted uppercase tracking-wider">Search</label>
        <input
          id="filter-search"
          type="text"
          placeholder="Search scripts..."
          value={filters.search ?? ''}
          onChange={(e) => update({ search: e.target.value || undefined })}
          className="bg-onay-card border border-onay-border text-onay-text rounded px-2 py-1.5 text-sm w-48"
        />
      </div>
    </div>
  );
}
