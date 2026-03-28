// TrackInfo.ts — Track metadata type used by BroadcastScreen.

export interface TrackInfo {
  id: string;
  title: string;
  artistName: string;
  albumTitle: string;
  artworkUrl?: string;
  genre?: string;
  genreNames?: string[];
  duration: number;
  isrc?: string;
}
