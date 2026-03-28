// AudioCoordinator.ts — Stub for v2.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SegmentCallback = (segment: any) => void;

export interface AudioCoordinator {
  synthesizeAndPlay(text: string, options?: { delivery?: string }): Promise<void>;
  activateDuckingSession(): Promise<void>;
  deactivateDuckingSession(): Promise<void>;
  cancelPendingTimer(): void;
  handleTrackStart(trackInfo: unknown, nextTrack?: unknown, onSegmentReady?: SegmentCallback): Promise<unknown>;
  handleTrackChangeWithResult(trackInfo: unknown, prevTrack?: unknown, onSegmentReady?: SegmentCallback, isManualSkip?: boolean): Promise<unknown>;
  handleEjectComplete(): Promise<void>;
  setVibe(vibe: string): void;
  setIsAppActiveCheck(fn: () => boolean): void;
}

export function createAudioCoordinator(): AudioCoordinator {
  return {
    synthesizeAndPlay: async () => {},
    activateDuckingSession: async () => {},
    deactivateDuckingSession: async () => {},
    cancelPendingTimer: () => {},
    handleTrackStart: async () => null,
    handleTrackChangeWithResult: async () => null,
    handleEjectComplete: async () => {},
    setVibe: () => {},
    setIsAppActiveCheck: () => {},
  };
}

export const audioCoordinator: AudioCoordinator = createAudioCoordinator();
