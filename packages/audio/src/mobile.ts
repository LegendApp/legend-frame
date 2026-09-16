import { validateVolume, validateMetadata } from "./media-types";
import { statusListeners } from "./status-listeners";
export type * from "./media-types";
export { createMediaSession } from "./media-session-unavailable";
import { createAudioPlayer as createExpoPlayer, setAudioModeAsync } from "expo-audio";
import { validateSource, validateTime, type AudioPlayer, type AudioSource } from "./types";
export type { AudioPlayer, AudioSource, AudioStatus } from "./types";
export async function createAudioPlayer(source: AudioSource): Promise<AudioPlayer> {
  validateSource(source);
  await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: "doNotMix" });
  const player = createExpoPlayer(source.uri);
  let removed = false;
  let ended = false;
  let failed = false;
  const subscription = player.addListener("playbackStatusUpdate", status => { if (status.didJustFinish) ended = true; failed = status.playbackState === "error"; });
  const alive = () => { if (removed) throw new Error("Audio player has been removed"); };
  try {
    if (!player.isLoaded) await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { loaded.remove(); reject(new Error("Audio loading timed out")); }, 15_000);
      const loaded = player.addListener("playbackStatusUpdate", status => {
        if (status.isLoaded || status.playbackState === "error") { clearTimeout(timer); loaded.remove(); if (status.isLoaded) resolve(); else reject(new Error("Audio could not be loaded")); }
      });
    });
    player.setActiveForLockScreen(true, { title: source.title ?? "Music" });
  } catch (error) { subscription.remove(); player.remove(); throw error; }
  const read = async () => { alive(); const status = player.currentStatus; return { playing: status.playing, currentTime: status.currentTime, duration: status.duration, didJustFinish: ended, error: failed ? "Audio could not be decoded or loaded" : null, volume: player.volume }; };
  const listeners = statusListeners(read);
  return {
    async setVolume(volume) { alive(); validateVolume(volume); player.volume = volume; },
    async setMetadata(metadata) { alive(); validateMetadata(metadata); player.updateLockScreenMetadata(metadata); },
    addListener(event, listener) { if (event !== "playbackStatusUpdate") throw new TypeError("Unknown audio event"); return listeners.add(listener); },
    async play() { alive(); ended = false; player.play(); },
    async pause() { alive(); player.pause(); },
    async seekTo(seconds) { alive(); validateTime(seconds); ended = false; await player.seekTo(seconds); },
    getStatus: read,
    async remove() { if (!removed) { removed = true; listeners.close(); subscription.remove(); player.clearLockScreenControls(); player.remove(); } },
  };
}
