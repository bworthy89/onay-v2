// Storage.ts — Stub for v2. Replace with your new persistence layer.
import { createMMKV, type MMKV } from 'react-native-mmkv';

const storage: MMKV = createMMKV({ id: 'onay-default' });
export { storage };

// --- Domain types stored in MMKV ---

export interface Station {
  id: string;
  name: string;
  description?: string;
  genre?: string;
  coverArt?: string;
  artworkUrl?: string;
  trackCount?: number;
  vibe?: string;
  defaultVibe: string;
  createdAt: string;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  playlistId: string | null;
}

export interface OnaySuggestion {
  stationId?: string;
  message?: string;
  timestamp?: number;
  playlistTitle?: string;
  playlistDescription?: string;
  conversationalResponse?: string;
  suggestedVibe?: string;
  generatedAt?: number;
  uid?: string;
  tracks: { id: string; title: string; artistName: string; artworkUrl?: string }[];
}

export interface UserProfile {
  uid?: string;
  email?: string;
  name?: string;
  displayName?: string;
  photoURL?: string;
  appleMusicAuthorized?: boolean;
  spotifyAuthorized?: boolean;
  onboardingComplete?: boolean;
  defaultVibe?: string;
  createdAt?: string | number;
}

// --- Storage keys ---

export const StorageKeys = {
  USER: 'user',
  STATIONS: 'stations',
  RECENTLY_PLAYED: 'recentlyPlayed',
  SELECTED_STATION: 'selectedStation',
  SELECTED_VIBE: 'selectedVibe',
  APPLE_MUSIC_AUTHORIZED: 'appleMusicAuthorized',
  ONBOARDING_COMPLETE: 'onboardingComplete',
  BROADCAST_HISTORY: 'broadcastHistory',
  CACHED_PLAYLISTS: 'cachedPlaylists',
  ONAY_SUGGESTION: 'onaySuggestion',
} as const;

// --- Low-level primitives ---

export function getString(key: string): string | undefined {
  return storage.getString(key);
}

export function setString(key: string, value: string): void {
  storage.set(key, value);
}

export function getBoolean(key: string): boolean {
  return storage.getBoolean(key) ?? false;
}

export function setBoolean(key: string, value: boolean): void {
  storage.set(key, value);
}

export function getObject<T>(key: string): T | null {
  try {
    const raw = storage.getString(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function setObject(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

export function remove(key: string): void {
  storage.remove(key);
}

export function clearUserData(): void {
  const user = storage.getString(StorageKeys.USER);
  storage.clearAll();
  if (user) storage.set(StorageKeys.USER, user);
}

// --- Domain helpers ---

export function getUser(): UserProfile | null {
  return getObject<UserProfile>(StorageKeys.USER);
}

export function setUser(user: UserProfile): void {
  setObject(StorageKeys.USER, user);
}

export function getStations(): Station[] {
  return getObject<Station[]>(StorageKeys.STATIONS) ?? [];
}

export function setStations(stations: Station[]): void {
  setObject(StorageKeys.STATIONS, stations);
}

export function addStation(station: Station): void {
  const current = getStations();
  current.push(station);
  setStations(current);
}

export function addRecentlyPlayedTrack(trackId: string): void {
  const current = getObject<string[]>(StorageKeys.RECENTLY_PLAYED) ?? [];
  const updated = [trackId, ...current.filter(id => id !== trackId)].slice(0, 100);
  setObject(StorageKeys.RECENTLY_PLAYED, updated);
}

export interface CachedPlaylist {
  id: string;
  name: string;
  artworkUrl?: string;
  trackCount: number;
}

export function getCachedPlaylists(): CachedPlaylist[] {
  return getObject<CachedPlaylist[]>(StorageKeys.CACHED_PLAYLISTS) ?? [];
}

export function setCachedPlaylists(playlists: CachedPlaylist[]): void {
  setObject(StorageKeys.CACHED_PLAYLISTS, playlists);
}

export function getOnaySuggestion(_uid?: string): OnaySuggestion | null {
  return getObject<OnaySuggestion>(StorageKeys.ONAY_SUGGESTION);
}

export function setOnaySuggestion(uidOrSuggestion: string | OnaySuggestion, maybeSuggestion?: OnaySuggestion): void {
  const suggestion = maybeSuggestion ?? (uidOrSuggestion as OnaySuggestion);
  setObject(StorageKeys.ONAY_SUGGESTION, suggestion);
}
