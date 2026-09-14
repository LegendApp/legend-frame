import Native from "./NativeLegendAudio";
import { validateSource, validateTime, type AudioPlayer, type AudioSource, type AudioStatus } from "./types";
export type { AudioPlayer, AudioSource, AudioStatus } from "./types";
let sequence = 0;
export async function createAudioPlayer(source: AudioSource): Promise<AudioPlayer> {
  validateSource(source);
  if (!Native) throw Object.assign(new Error("Audio playback is unavailable. Build a client with @legend-apps/audio."), { code: "E_UNAVAILABLE" });
  const native = Native, id = `audio-${Date.now()}-${++sequence}`;
  let removed = false;
  const call = async <T = void>(method: string, args = {}): Promise<T> => {
    if (removed) throw new Error("Audio player has been removed");
    return JSON.parse(await native.call(method, JSON.stringify({ id, ...args })));
  };
  await call("create", source);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancelled = false;
  try {
    await Promise.race([
      (async () => { while (!cancelled && !await call<boolean>("ready")) await new Promise(resolve => setTimeout(resolve, 50)); })(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Audio loading timed out")), 15_000); }),
    ]);
  } catch (error) { void call("remove").catch(() => {}); throw error; }
  finally { cancelled = true; clearTimeout(timer); }
  return {
    play: () => call("play"), pause: () => call("pause"),
    seekTo: seconds => { validateTime(seconds); return call("seek", { seconds }); },
    getStatus: () => call<AudioStatus>("status"),
    async remove() { if (!removed) { await call("remove"); removed = true; } },
  };
}
