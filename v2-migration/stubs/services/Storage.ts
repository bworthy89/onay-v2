// Storage.ts — Stub for v2. Replace with your new persistence layer.
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

export const StorageKeys = {
  USER: 'user',
  STATIONS: 'stations',
  RECENTLY_PLAYED: 'recentlyPlayed',
  SELECTED_STATION: 'selectedStation',
  SELECTED_VIBE: 'selectedVibe',
  APPLE_MUSIC_AUTHORIZED: 'appleMusicAuthorized',
  ONBOARDING_COMPLETE: 'onboardingComplete',
  BROADCAST_HISTORY: 'broadcastHistory',
} as const;

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
  storage.delete(key);
}

export function clearUserData(): void {
  const user = storage.getString(StorageKeys.USER);
  storage.clearAll();
  if (user) storage.set(StorageKeys.USER, user);
}
