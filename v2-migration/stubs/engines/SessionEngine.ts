// SessionEngine.ts — Stub for v2.

export type SessionPhase = 'coldOpen' | 'opening' | 'mid' | 'late' | 'closing';

export interface SessionEngine {
  isActive(): boolean;
  getCurrentPhase(): SessionPhase;
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
    getTracksPlayed: () => [],
    getCurrentQueueIndex: () => 0,
    advanceTrack: () => {},
    startSession: () => {},
    endSession: () => {},
  };
}
