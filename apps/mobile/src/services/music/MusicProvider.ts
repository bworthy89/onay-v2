// MusicProvider.ts — Stub for v2. Abstraction over music playback.

export { USE_ADAPTR } from '../../config/featureFlags';

export interface Track {
  id: string;
  trackId?: string;
  title: string;
  artistName: string;
  albumTitle: string;
  artworkUrl?: string;
  duration: number;
  durationInSeconds?: number;
  genreNames?: string[];
  playbackTime: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  artworkUrl?: string;
  trackCount: number;
}

export interface AuthorizationResult {
  status: string;
}

export interface PlaybackEvent {
  status: string;
  [key: string]: unknown;
}

export interface TrackProfile {
  artworkUrl?: string;
  [key: string]: unknown;
}

export interface MusicPlayer {
  isAvailable(): boolean;
  isAuthorized(): Promise<boolean>;
  authorize(): Promise<AuthorizationResult>;
  requestAuthorization(): Promise<boolean>;
  getPlaylists(): Promise<Playlist[]>;
  fetchPlaylists(): Promise<Playlist[]>;
  getPlaylistTracks(playlistId: string): Promise<Track[]>;
  play(trackId?: string): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  skip(): Promise<void>;
  getCurrentTrack(): Track | null;
  getNowPlaying(): Promise<Track | null>;
  getPlaybackStatus(): Promise<string | null>;
  getPlaybackTime(): Promise<number>;
  isPlaying(): boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onTrackChanged(callback: (track: any) => void): () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onEjectTrackChanged(callback: (event: any) => void): () => void;
  onPlaybackStateChanged(callback: (event: PlaybackEvent) => void): () => void;
}

// TODO: Implement your music provider
export const musicPlayer: MusicPlayer = {
  isAvailable: () => false,
  isAuthorized: async () => false,
  authorize: async () => ({ status: 'not-determined' }),
  requestAuthorization: async () => false,
  getPlaylists: async () => [],
  fetchPlaylists: async () => [],
  getPlaylistTracks: async () => [],
  play: async () => {},
  pause: async () => {},
  resume: async () => {},
  skip: async () => {},
  getCurrentTrack: () => null,
  getNowPlaying: async () => null,
  getPlaybackStatus: async () => null,
  getPlaybackTime: async () => 0,
  isPlaying: () => false,
  onTrackChanged: () => () => {},
  onEjectTrackChanged: () => () => {},
  onPlaybackStateChanged: () => () => {},
};

/** @deprecated Use musicPlayer instead */
export const musicProvider = musicPlayer;
