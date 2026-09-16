export type AudioMetadata = { title?: string; artist?: string; albumTitle?: string; artworkUrl?: string };
export type MediaCommandName = "play" | "pause" | "nextTrack" | "previousTrack" | "seekTo";
export type MediaCommand = { command: MediaCommandName; position?: number };
export type MediaSessionOptions = {
  metadata?: AudioMetadata;
  playbackState?: "playing" | "paused" | "stopped";
  position?: number;
  duration?: number;
  playbackRate?: number;
  commands?: MediaCommandName[];
};
export interface MediaSession {
  update(options: MediaSessionOptions): Promise<void>;
  remove(): Promise<void>;
}
export function validateVolume(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new TypeError("Volume must be between 0 and 1");
}
export function validateMetadata(metadata: AudioMetadata) {
  for (const [key, value] of Object.entries(metadata)) {
    if (!["title", "artist", "albumTitle", "artworkUrl"].includes(key) || typeof value !== "string") throw new TypeError("Invalid audio metadata");
  }
  if (metadata.artworkUrl && !/^(https?:\/\/|file:\/\/|\/)/.test(metadata.artworkUrl)) throw new TypeError("Artwork requires an HTTP URL, file URL or absolute path");
}
export function validateSession(options: MediaSessionOptions) {
  if (options.metadata) validateMetadata(options.metadata);
  for (const key of ["position", "duration", "playbackRate"] as const) {
    const value = options[key]; if (value !== undefined && (!Number.isFinite(value) || value < 0)) throw new TypeError(`Invalid media ${key}`);
  }
  if (options.playbackState !== undefined && !["playing", "paused", "stopped"].includes(options.playbackState)) throw new TypeError("Invalid playback state");
  if (options.commands !== undefined && (!Array.isArray(options.commands) || options.commands.some(command => !["play", "pause", "nextTrack", "previousTrack", "seekTo"].includes(command)) || new Set(options.commands).size !== options.commands.length)) throw new TypeError("Invalid media commands");
}
