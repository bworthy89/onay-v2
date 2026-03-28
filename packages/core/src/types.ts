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
  audio_url: string;
  script_text: string;
}

export type TimelineEntry =
  | {
      type: 'song';
      canonical_id: string;
      artist: string;
      title: string;
      isrc?: string;
      duration_ms: number;
    }
  | {
      type: 'segment';
      segment_id: string;
      audio_url: string;
      duration_ms: number;
    };

export interface TimelineManifest {
  station_id: string;
  created_at: string;
  entries: TimelineEntry[];
}

export interface TracklistEntry {
  canonical_id: string;
  artist: string;
  title: string;
  isrc?: string;
  duration_ms: number;
}

export interface RotationSchedule {
  frequency: string;
  time_of_day_target: string;
  days: string[];
}

// ---------------------------------------------------------------------------
// Vibes
// ---------------------------------------------------------------------------

export const VIBES = [
  'morning', 'chill', 'workout', 'lateNight', 'party', 'general',
  'focus', 'feelGood', 'throwback', 'elevated', 'melancholy', 'sunday',
] as const;

export type Vibe = (typeof VIBES)[number];

export interface Station {
  station_id: string;
  name: string;
  description: string;
  genre_tags: string[];
  mood_tags: string[];
  cover_art_url: string;
  rotation_schedule: RotationSchedule;
  tracklist: TracklistEntry[];
  provider_availability: {
    apple_music: Record<string, string | null>;
    spotify: Record<string, string | null>;
  };
}
