import { validateVolume, validateMetadata } from "./media-types";
import { statusListeners } from "./status-listeners";
import { hasExplicitMediaSession, claimPlayerMediaSession, ownsPlayerMediaSession, releasePlayerMediaSession } from "./media-session.web";
export { createMediaSession } from "./media-session.web";
export type * from "./media-types";
import { validateSource, validateTime, type AudioPlayer, type AudioSource } from "./types";
export type { AudioPlayer, AudioSource, AudioStatus } from "./types";

export async function createAudioPlayer(source: AudioSource): Promise<AudioPlayer> {
  validateSource(source);
  const audio = new Audio(source.uri);
  audio.preload = "metadata";
  let removed = false;
  const pending = new Set<() => void>();
  const alive = () => { if (removed) throw new Error("Audio player has been removed"); };
  const media = navigator.mediaSession;
  if (media && !hasExplicitMediaSession()) {
    claimPlayerMediaSession(audio);
    media.metadata = new MediaMetadata({ title: source.title ?? "Music" });
    media.setActionHandler("play", () => { void audio.play().catch(console.error); });
    media.setActionHandler("pause", () => audio.pause());
    media.setActionHandler("seekto", event => { if (event.seekTime !== undefined) audio.currentTime = event.seekTime; });
  }
  const read = async () => { alive(); return { playing: !audio.paused, currentTime: audio.currentTime, duration: Number.isFinite(audio.duration) ? audio.duration : 0, didJustFinish: audio.ended, error: audio.error?.message ?? null, volume: audio.volume }; };
  const listeners = statusListeners(read);
  return {
    async setVolume(volume) { alive(); validateVolume(volume); audio.volume = volume; },
    async setMetadata(metadata) { alive(); validateMetadata(metadata); if (media && ownsPlayerMediaSession(audio)) media.metadata = new MediaMetadata({ title: metadata.title, artist: metadata.artist, album: metadata.albumTitle, artwork: metadata.artworkUrl ? [{ src: metadata.artworkUrl }] : [] }); },
    addListener(event, listener) { if (event !== "playbackStatusUpdate") throw new TypeError("Unknown audio event"); return listeners.add(listener); },
    async play() { alive(); await audio.play(); }, async pause() { alive(); audio.pause(); },
    async seekTo(seconds) { alive(); validateTime(seconds); if (audio.readyState === 0) await new Promise<void>((resolve, reject) => {
      const clear = () => { clearTimeout(timer); pending.delete(cancel); audio.removeEventListener("loadedmetadata", loaded); audio.removeEventListener("error", failed); };
      const loaded = () => { clear(); resolve(); }; const failed = () => { clear(); reject(new Error("Could not load audio")); };
      const cancel = () => { clear(); reject(new Error("Audio player has been removed")); };
      const timer = setTimeout(() => { clear(); reject(new Error("Audio loading timed out")); }, 15_000);
      pending.add(cancel);
      audio.addEventListener("loadedmetadata", loaded); audio.addEventListener("error", failed);
    }); alive(); audio.currentTime = seconds; },
    getStatus: read,
    async remove() { if (!removed) { removed = true; listeners.close(); for (const cancel of pending) cancel(); audio.pause(); audio.removeAttribute("src"); audio.load(); if (media && ownsPlayerMediaSession(audio)) { for (const action of ["play", "pause", "seekto"] as const) media.setActionHandler(action, null); media.metadata = null; releasePlayerMediaSession(audio); } } },
  };
}
