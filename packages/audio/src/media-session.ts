import Native from "./NativeFrameAudio";
import { validateSession, type MediaCommand, type MediaSession, type MediaSessionOptions } from "./media-types";
let owner: (() => void) | undefined, sequence = 0;
/** One explicit session owns the app's system media controls, independent of playback. */
export async function createMediaSession(options: MediaSessionOptions, onCommand: (command: MediaCommand) => void): Promise<MediaSession> {
  validateSession(options);
  if (!Native) throw Object.assign(new Error("Media sessions require @legendapp/frame-audio in the native runtime"), { code: "E_UNAVAILABLE" });
  const native = Native, id = `media-${Date.now()}-${++sequence}`;
  let removed = false, timer: ReturnType<typeof setTimeout> | undefined;
  const call = async <T = void>(method: string, args = {}): Promise<T> => JSON.parse(await native.call(method, JSON.stringify({ id, ...args })));
  const stop = () => { removed = true; clearTimeout(timer); };
  await call("sessionCreate", options); owner?.(); owner = stop;
  async function poll() {
    try {
      const commands = await call<MediaCommand[]>("sessionCommands");
      if (!removed) for (const command of commands) { try { onCommand(command); } catch (error) { console.error(error); } }
    } catch (error) { if (!removed) { stop(); console.error(error); } }
    finally { if (!removed) timer = setTimeout(poll, 100); }
  }
  void poll();
  return {
    async update(patch) { if (removed) throw new Error("Media session has been removed or replaced"); validateSession(patch); await call("sessionUpdate", patch); },
    async remove() { if (removed) return; await call("sessionRemove"); stop(); if (owner === stop) owner = undefined; },
  };
}
