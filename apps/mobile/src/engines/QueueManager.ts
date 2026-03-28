// QueueManager.ts — Stub for v2.

export interface QueueManager {
  getQueue(): string[];
  getTrackProfile(trackId: string): { artworkUrl?: string; [key: string]: unknown } | null;
  initializeSession(playlistId: string | null, vibe?: string, stationId?: string, options?: Record<string, unknown>): Promise<void>;
  upgradeQueueInBackground(): Promise<void>;
  enrichExistingSession(playlistId: string): Promise<void>;
}

export function createQueueManager(): QueueManager {
  return {
    getQueue: () => [],
    getTrackProfile: () => null,
    initializeSession: async () => {},
    upgradeQueueInBackground: async () => {},
    enrichExistingSession: async () => {},
  };
}

export const queueManager: QueueManager = createQueueManager();
