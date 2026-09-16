import type { AudioStatus } from "./types";
/** Sample status only while observed. No React state or render is involved. */
export function statusListeners(read: () => Promise<AudioStatus>) {
  const listeners = new Set<(status: AudioStatus) => void>();
  let timer: ReturnType<typeof setTimeout> | undefined, closed = false, running = false;
  async function tick() {
    running = true;
    try {
      const status = await read();
      if (!closed) for (const listener of [...listeners]) { try { listener(status); } catch (error) { console.error(error); } }
    } catch (error) { if (!closed) console.error(error); }
    finally { running = false; if (!closed && listeners.size) timer = setTimeout(tick, 250); }
  }
  return {
    add(listener: (status: AudioStatus) => void) {
      if (closed) throw new Error("Audio player has been removed");
      listeners.add(listener); if (!running && !timer) void tick();
      return { remove() { listeners.delete(listener); if (!listeners.size) { clearTimeout(timer); timer = undefined; } } };
    },
    close() { closed = true; clearTimeout(timer); listeners.clear(); },
  };
}
