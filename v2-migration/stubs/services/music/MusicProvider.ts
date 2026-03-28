// MusicProvider.ts — Stub for v2. Abstraction over music playback.

export interface Track {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string;
  artworkUrl?: string;
  durationInSeconds: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artworkUrl?: string;
  trackCount: number;
}

export interface MusicProvider {
  isAvailable(): boolean;
  requestAuthorization(): Promise<boolean>;
  getPlaylists(): Promise<Playlist[]>;
  getPlaylistTracks(playlistId: string): Promise<Track[]>;
  play(trackId: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  skip(): Promise<void>;
  getCurrentTrack(): Track | null;
  isPlaying(): boolean;
  onTrackChanged(callback: (track: Track) => void): () => void;
  onPlaybackStateChanged(callback: (state: string) => void): () => void;
}

// TODO: Implement your music provider
export const musicProvider: MusicProvider = {
  isAvailable: () => false,
  requestAuthorization: async () => false,
  getPlaylists: async () => [],
  getPlaylistTracks: async () => [],
  play: async () => {},
  pause: async () => {},
  resume: async () => {},
  skip: async () => {},
  getCurrentTrack: () => null,
  isPlaying: () => false,
  onTrackChanged: () => () => {},
  onPlaybackStateChanged: () => () => {},
};
