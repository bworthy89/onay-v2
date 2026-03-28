// QueueManager.ts — Stub for v2.

export interface QueueManager {
  getQueue(): string[];
  getTrackProfile(trackId: string): Record<string, unknown> | null;
  initializeSession(playlistId: string): Promise<void>;
  upgradeQueueInBackground(): Promise<void>;
}

export function createQueueManager(): QueueManager {
  return {
    getQueue: () => [],
    getTrackProfile: () => null,
    initializeSession: async () => {},
    upgradeQueueInBackground: async () => {},
  };
}
