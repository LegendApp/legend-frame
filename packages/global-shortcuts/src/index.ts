import Native from "./NativeDesktopGlobalShortcuts";
import { onDesktopEvent } from "@legend-apps/desktop-app";
import { parseAccelerator } from "./accelerator";
let sequence = 0;
export async function registerGlobalShortcut(accelerator: string, handler: () => void) {
  const parsed = parseAccelerator(accelerator), id = `global-${Date.now()}-${++sequence}`;
  let removed = false;
  const subscription = onDesktopEvent(event => { if (!removed && event.type === "globalShortcut" && event.id === id) handler(); });
  try { await Native.call("register", JSON.stringify({ id, ...parsed })); }
  catch (error) { subscription.remove(); throw error; }
  return { async remove() {
    if (removed) return;
    await Native.call("remove", JSON.stringify({ id })); removed = true; subscription.remove();
  } };
}
