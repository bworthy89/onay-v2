const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export type SegmentType =
  | 'show_intro'
  | 'show_outro'
  | 'song_intro'
  | 'transition'
  | 'artist_shoutout'
  | 'genre_vibe'
  | 'fun_fact'
  | 'hot_take'
  | 'time_of_day'
  | 'ad_lib'
  | 'seasonal';

export const SEGMENT_TYPES: SegmentType[] = [
  'show_intro', 'show_outro', 'song_intro', 'transition',
  'artist_shoutout', 'genre_vibe', 'fun_fact', 'hot_take',
  'time_of_day', 'ad_lib', 'seasonal',
];

export interface Segment {
  segment_id: string;
  type: SegmentType;
  genre_tags: string[];
  mood_tags: string[];
  artist_refs: string[];
  energy_level: number;
  duration_ms: number;
  quality_score: number;
  exaggeration_level: number;
  created_at: string;
  usage_count: number;
  audio_url: string | null;
  script_text: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface SegmentFilters {
  type?: SegmentType;
  genre?: string;
  mood?: string;
  search?: string;
  qualityMin?: number;
  energyMin?: number;
  energyMax?: number;
  limit?: number;
  offset?: number;
}

export interface SegmentsResponse {
  segments: Segment[];
  total: number;
}

export interface LibraryStats {
  total: number;
  by_type: Record<string, number>;
  avg_quality: number;
  total_duration_ms: number;
}

export interface BulkApproveResponse {
  approved_count: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export async function getSegments(filters: SegmentFilters = {}): Promise<SegmentsResponse> {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.genre) params.set('genre', filters.genre);
  if (filters.mood) params.set('mood', filters.mood);
  if (filters.search) params.set('search', filters.search);
  if (filters.qualityMin !== undefined) params.set('qualityMin', String(filters.qualityMin));
  if (filters.energyMin !== undefined) params.set('energyMin', String(filters.energyMin));
  if (filters.energyMax !== undefined) params.set('energyMax', String(filters.energyMax));
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));
  const qs = params.toString();
  return request<SegmentsResponse>(`/api/segments${qs ? `?${qs}` : ''}`);
}

export async function updateSegment(
  id: string,
  data: Partial<Pick<Segment, 'status' | 'type' | 'genre_tags' | 'mood_tags' | 'artist_refs' | 'energy_level' | 'quality_score' | 'script_text'>>
): Promise<Segment> {
  return request<Segment>(`/api/segments/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteSegment(id: string): Promise<void> {
  return request<void>(`/api/segments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function bulkApprove(threshold: number): Promise<BulkApproveResponse> {
  return request<BulkApproveResponse>('/api/segments/bulk-approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quality_threshold: threshold }),
  });
}

export async function getStats(): Promise<LibraryStats> {
  return request<LibraryStats>('/api/segments/stats');
}

// --- Station types ---

export interface Station {
  station_id: string;
  name: string;
  description: string | null;
  genre_tags: string[];
  mood_tags: string[];
  cover_art_url: string | null;
  rotation_schedule: Record<string, unknown> | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface StationWithTracklist extends Station {
  tracklist: Track[];
}

export interface Track {
  id: string;
  canonical_id: string;
  artist: string;
  title: string;
  isrc: string | null;
  duration_ms: number;
  position: number;
  apple_music_id: string | null;
  spotify_id: string | null;
}

export interface CreateStationData {
  name: string;
  description?: string;
  genre_tags?: string[];
  mood_tags?: string[];
  cover_art_url?: string;
}

export interface UpdateStationData {
  name?: string;
  description?: string | null;
  genre_tags?: string[];
  mood_tags?: string[];
  cover_art_url?: string;
  is_published?: boolean;
}

export interface AddTrackData {
  canonical_id: string;
  artist: string;
  title: string;
  duration_ms: number;
  isrc?: string;
}

export interface ReplaceTrackData {
  canonical_id: string;
  artist: string;
  title: string;
  duration_ms: number;
  isrc?: string;
}

// --- Station API ---

export async function getStations(): Promise<Station[]> {
  return request<Station[]>('/api/stations');
}

export async function getStation(id: string): Promise<StationWithTracklist> {
  return request<StationWithTracklist>(`/api/stations/${encodeURIComponent(id)}`);
}

export async function createStation(data: CreateStationData): Promise<Station> {
  return request<Station>('/api/stations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function updateStation(id: string, data: UpdateStationData): Promise<Station> {
  return request<Station>(`/api/stations/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export async function deleteStation(id: string): Promise<void> {
  return request<void>(`/api/stations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function addTrack(stationId: string, track: AddTrackData): Promise<Track> {
  return request<Track>(`/api/stations/${encodeURIComponent(stationId)}/tracks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(track),
  });
}

export async function replaceTracklist(stationId: string, tracks: ReplaceTrackData[]): Promise<Track[]> {
  return request<Track[]>(`/api/stations/${encodeURIComponent(stationId)}/tracks`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tracks),
  });
}

export async function removeTrack(stationId: string, trackId: string): Promise<void> {
  return request<void>(
    `/api/stations/${encodeURIComponent(stationId)}/tracks/${encodeURIComponent(trackId)}`,
    { method: 'DELETE' },
  );
}

// --- Timeline types ---

export interface TimelineEntry {
  type: 'song' | 'segment';
  // Song fields
  canonical_id?: string;
  artist?: string;
  title?: string;
  isrc?: string;
  // Segment fields
  segment_id?: string;
  audio_url?: string;
  segment_type?: string;
  script_text?: string;
  // Shared
  duration_ms: number;
}

export interface Timeline {
  id: string;
  station_id: string;
  created_at: string;
  entries: TimelineEntry[];
}

export interface TimelineHistoryItem {
  id: string;
  created_at: string;
  entry_count: number;
  total_duration_ms: number;
}

export interface AssembleResult extends Timeline {
  stats: {
    total_duration_ms: number;
    song_count: number;
    segment_count: number;
    segment_ratio: number;
  };
}

// --- Timeline API ---

export async function getTimeline(stationId: string): Promise<Timeline> {
  return request<Timeline>(`/api/stations/${encodeURIComponent(stationId)}/timeline`);
}

export async function getTimelineHistory(stationId: string, limit?: number): Promise<TimelineHistoryItem[]> {
  const params = new URLSearchParams();
  if (limit !== undefined) params.set('limit', String(limit));
  const qs = params.toString();
  return request<TimelineHistoryItem[]>(
    `/api/stations/${encodeURIComponent(stationId)}/timeline/history${qs ? `?${qs}` : ''}`,
  );
}

export async function getTimelineById(id: string): Promise<Timeline> {
  return request<Timeline>(`/api/timelines/${encodeURIComponent(id)}`);
}

export async function triggerAssembly(stationId: string): Promise<AssembleResult> {
  return request<AssembleResult>(`/api/stations/${encodeURIComponent(stationId)}/assemble`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}
