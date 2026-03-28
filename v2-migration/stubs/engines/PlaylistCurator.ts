// PlaylistCurator.ts — Stub for v2.

export interface PlaylistCurator {
  curateFromPrompt(prompt: string): Promise<string[]>;
}

export function createPlaylistCurator(): PlaylistCurator {
  return {
    curateFromPrompt: async () => [],
  };
}
