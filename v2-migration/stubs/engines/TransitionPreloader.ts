// TransitionPreloader.ts — Stub for v2.

export type PreloaderState = 'idle' | 'generating' | 'ready' | 'fired' | 'done';

export interface TransitionPreloader {
  startForTrack(trackId: string, duration: number): void;
  reset(): void;
  getState(): PreloaderState;
  revalidateNextTrack(): Promise<void>;
}

export function createTransitionPreloader(): TransitionPreloader {
  return {
    startForTrack: () => {},
    reset: () => {},
    getState: () => 'idle',
    revalidateNextTrack: async () => {},
  };
}
