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
