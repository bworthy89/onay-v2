// SessionMemory.ts — Stub for v2. Used by ArchiveScreen.

export interface SessionSnapshot {
  stationId: string;
  stationName: string;
  vibe: string;
  tracksPlayed: string[];
  startedAt: number;
  endedAt?: number;
}

export interface SessionMemoryState {
  sessions: SessionSnapshot[];
  lastStationId: string | null;
}

export function getSessionHistory(): SessionSnapshot[] {
  return [];
}

export function saveSession(_session: SessionSnapshot): void {
  // TODO: Implement
}

export function getPreviousSession(): SessionSnapshot | null {
  return null;
}

export function loadSessionMemory(): SessionMemoryState | null {
  // TODO: Load from persistent storage
  return null;
}
