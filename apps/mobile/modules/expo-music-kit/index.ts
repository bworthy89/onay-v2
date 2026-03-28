// expo-music-kit — Stub native module for v2.
// TODO: Replace with actual native module implementation.

export interface NowPlaying {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string;
  artworkUrl?: string;
  genreNames?: string[];
  duration: number;
  playbackTime: number;
}

export interface UpcomingTrack {
  id: string;
  title: string;
  artistName: string;
  artworkUrl?: string;
}

export interface MusicPlaylist {
  id: string;
  name: string;
  description?: string;
  artworkUrl?: string;
  trackCount: number;
}

export async function authorize(): Promise<{ status: string; canPlayCatalog?: boolean }> {
  // TODO: Implement MusicKit authorization
  return { status: 'not-determined', canPlayCatalog: false };
}

export async function getNextInQueue(): Promise<NowPlaying | null> {
  return null;
}

export async function skipToPrevious(): Promise<void> {
  // TODO: Implement
}

export async function getUpcomingQueue(): Promise<UpcomingTrack[]> {
  return [];
}

export async function createPlaylist(_name: string, _description?: string, _trackIds?: string[]): Promise<string | null> {
  // TODO: Implement — returns playlist ID
  return null;
}

export async function setTTSVolume(_volume: number): Promise<void> {
  // TODO: Implement
}
