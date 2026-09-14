/** Seconds throughout. Commands reject when the backend cannot complete them. */
export type AudioStatus = { playing: boolean; currentTime: number; duration: number; didJustFinish: boolean; error: string | null };
export type AudioSource = { uri: string; title?: string };
export interface AudioPlayer {
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(seconds: number): Promise<void>;
  getStatus(): Promise<AudioStatus>;
  remove(): Promise<void>;
}
export function validateSource(source: AudioSource) {
  if (!source || typeof source.uri !== "string" || !source.uri || source.uri.includes("\0")) throw new Error("Audio requires a URI or absolute desktop file path");
}
export function validateTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error("Seek position must be a finite, nonnegative number of seconds");
}
