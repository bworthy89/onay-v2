// AudioCoordinator.ts — Stub for v2.

export interface AudioCoordinator {
  synthesizeAndPlay(text: string, options?: { delivery?: string }): Promise<void>;
  activateDuckingSession(): Promise<void>;
  deactivateDuckingSession(): Promise<void>;
  cancelPendingTimer(): void;
}

export function createAudioCoordinator(): AudioCoordinator {
  return {
    synthesizeAndPlay: async () => {},
    activateDuckingSession: async () => {},
    deactivateDuckingSession: async () => {},
    cancelPendingTimer: () => {},
  };
}
