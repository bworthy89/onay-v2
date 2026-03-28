import type { Segment, SegmentType } from './types';

export interface SegmentFilter {
  type?: SegmentType;
  genre?: string;
  mood?: string;
  artist?: string;
  energyMin?: number;
  energyMax?: number;
  qualityMin?: number;
  search?: string;
}

const TYPE_ABBREVIATIONS: Record<SegmentType, string> = {
  show_intro: 'SI',
  show_outro: 'SO',
  song_intro: 'SN',
  transition: 'TR',
  artist_shoutout: 'AS',
  genre_vibe: 'GV',
  fun_fact: 'FF',
  hot_take: 'HT',
  time_of_day: 'TD',
  ad_lib: 'AL',
  seasonal: 'SE',
};

export function generateSegmentId(type: SegmentType): string {
  const abbrev = TYPE_ABBREVIATIONS[type];
  const num = Math.floor(Math.random() * 90000) + 10000; // 10000-99999
  return `SEG-${abbrev}-${num}`;
}

export function filterSegments(library: Segment[], filters: SegmentFilter): Segment[] {
  return library.filter((segment) => {
    if (filters.type && segment.type !== filters.type) return false;

    if (filters.genre && !segment.genre_tags.includes(filters.genre)) return false;

    if (filters.mood && !segment.mood_tags.includes(filters.mood)) return false;

    if (filters.artist && !segment.artist_refs.includes(filters.artist)) return false;

    if (filters.energyMin !== undefined && segment.energy_level < filters.energyMin) return false;

    if (filters.energyMax !== undefined && segment.energy_level > filters.energyMax) return false;

    if (filters.qualityMin !== undefined && segment.quality_score < filters.qualityMin) return false;

    if (filters.search && !segment.script_text.toLowerCase().includes(filters.search.toLowerCase()))
      return false;

    return true;
  });
}
