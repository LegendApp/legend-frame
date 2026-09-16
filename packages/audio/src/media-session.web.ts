import { validateSession, type MediaCommand, type MediaCommandName, type MediaSession, type MediaSessionOptions } from "./media-types";
let owner: object | undefined, explicit = false;
export const hasExplicitMediaSession = () => explicit;
export const claimPlayerMediaSession = (player: object) => { owner = player; };
export const ownsPlayerMediaSession = (player: object) => owner === player;
export const releasePlayerMediaSession = (player: object) => { if (owner === player) owner = undefined; };
const actions: Record<MediaCommandName, MediaSessionAction> = { play: "play", pause: "pause", nextTrack: "nexttrack", previousTrack: "previoustrack", seekTo: "seekto" };
export async function createMediaSession(options: MediaSessionOptions, onCommand: (command: MediaCommand) => void): Promise<MediaSession> {
  validateSession(options);
  const available = typeof navigator === "undefined" ? undefined : navigator.mediaSession;
  if (!available) throw Object.assign(new Error("Browser media sessions are unavailable"), { code: "E_UNAVAILABLE" });
  const media = available;
  const id = {}; let removed = false, state: MediaSessionOptions = { commands: ["play", "pause"] };
  const clearActions = () => { for (const action of Object.values(actions)) { try { media.setActionHandler(action, null); } catch {} } };
  function apply(patch: MediaSessionOptions) {
    state = { ...state, ...patch };
    const metadata = state.metadata ?? {};
    media.metadata = new MediaMetadata({ title: metadata.title, artist: metadata.artist, album: metadata.albumTitle, artwork: metadata.artworkUrl ? [{ src: metadata.artworkUrl }] : [] });
    media.playbackState = state.playbackState === "playing" ? "playing" : state.playbackState === "paused" ? "paused" : "none";
    if (media.setPositionState) {
      if (state.duration && (state.playbackRate ?? 1) > 0) media.setPositionState({ duration: state.duration, position: Math.min(state.position ?? 0, state.duration), playbackRate: state.playbackRate ?? 1 });
      else media.setPositionState();
    }
    clearActions();
    for (const command of state.commands ?? []) media.setActionHandler(actions[command], details => {
      if (owner === id && !removed) onCommand({ command, ...(details.seekTime === undefined ? {} : { position: details.seekTime }) });
    });
  }
  owner = id; explicit = true;
  try { apply(options); } catch (error) { clearActions(); media.metadata = null; media.playbackState = "none"; owner = undefined; explicit = false; throw error; }
  return {
    async update(patch) { if (removed || owner !== id) throw new Error("Media session has been removed or replaced"); validateSession(patch); apply(patch); },
    async remove() { if (removed) return; removed = true; if (owner !== id) return; clearActions(); media.metadata = null; media.playbackState = "none"; media.setPositionState?.(); owner = undefined; explicit = false; },
  };
}
