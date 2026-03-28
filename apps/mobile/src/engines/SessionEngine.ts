// SessionEngine.ts — Stub for v2.

export type SessionPhase = 'coldOpen' | 'earlySession' | 'build' | 'peak' | 'resolution' | 'signOff' | 'opening' | 'mid' | 'late' | 'closing';

export interface Session {
  id: string;
  stationId: string;
  vibe: string;
  phase: SessionPhase;
  currentPhase: SessionPhase;
  tracksPlayed: string[];
  startedAt: number;
  startTime: number;
  endedAt?: number;
  queuePlan?: { queue: string[]; [key: string]: unknown };
  skippedTracks: string[];
}

export interface SessionEngine {
  isActive(): boolean;
  getCurrentPhase(): SessionPhase;
  getSession(): Session | null;
  getSessionDuration(): number;
  getTracksPlayed(): string[];
  getCurrentQueueIndex(): number;
  advanceTrack(trackId: string): void;
  startSession(stationId: string, vibe: string): void;
  endSession(): void;
}

export function createSessionEngine(): SessionEngine {
  return {
    isActive: () => false,
    getCurrentPhase: () => 'coldOpen',
    getSession: () => null,
    getSessionDuration: () => 0,
    getTracksPlayed: () => [],
    getCurrentQueueIndex: () => 0,
    advanceTrack: () => {},
    startSession: () => {},
    endSession: () => {},
  };
}

export const sessionEngine: SessionEngine = createSessionEngine();
