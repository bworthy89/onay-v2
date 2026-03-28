// fallbacks.ts — Stub for v2. Vibe definitions used by VibePicker and several screens.

export const VIBES = [
  'morning', 'chill', 'workout', 'lateNight', 'party', 'general',
  'focus', 'feelGood', 'throwback', 'elevated', 'melancholy', 'sunday',
] as const;

export type Vibe = (typeof VIBES)[number];

export const VIBE_LABELS: Record<Vibe, string> = {
  morning: 'Morning',
  chill: 'Chill',
  workout: 'Workout',
  lateNight: 'Late Night',
  party: 'Party',
  general: 'General',
  focus: 'Focus',
  feelGood: 'Feel Good',
  throwback: 'Throwback',
  elevated: 'Elevated',
  melancholy: 'Melancholy',
  sunday: 'Sunday',
};

export const VIBE_EMOJIS: Record<Vibe, string> = {
  morning: '🌅',
  chill: '🌊',
  workout: '🔥',
  lateNight: '🌙',
  party: '🎉',
  general: '📻',
  focus: '🎯',
  feelGood: '☀️',
  throwback: '⏪',
  elevated: '✨',
  melancholy: '🌧️',
  sunday: '☕',
};

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
  | 'seasonal'
  | 'cold_open'
  | 'session_close'
  | 'track_story'
  | 'post_track_reflection';

export function getFallbackSegment(_vibe: Vibe, _type?: string): string {
  return "You're listening to ONAY Radio.";
}
