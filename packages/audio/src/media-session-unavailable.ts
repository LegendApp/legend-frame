import type { MediaCommand, MediaSession, MediaSessionOptions } from "./media-types";
/** Expo Audio owns mobile transport controls; it cannot attach an external engine. */
export async function createMediaSession(_options: MediaSessionOptions, _onCommand: (command: MediaCommand) => void): Promise<MediaSession> {
  throw Object.assign(new Error("Standalone media sessions support desktop and web. On mobile use the audio player's Expo-backed controls."), { code: "E_UNAVAILABLE" });
}
