import { NativeEventEmitter, Platform } from "react-native";
import Native from "./NativeDesktopShortcuts";
import { parseAccelerator } from "./accelerator";
export { parseAccelerator } from "./accelerator";
const emitter = new NativeEventEmitter(Native);
export type ShortcutOptions = { windowId?: string; repeat?: boolean };
/** Focused-app shortcuts, consumed natively before insertion into text fields. */
export async function registerShortcut(accelerator: string, handler: () => void, options: ShortcutOptions = {}) {
  const id = `shortcut-${Date.now()}-${++nextID}`;
  const parsed = parseAccelerator(Platform.OS === "windows" ? accelerator.replace(/commandorcontrol|cmdorctrl/ig, "Control") : accelerator);
  let removed = false;
  const subscription = emitter.addListener("shortcut", (event: { id: string }) => { if (!removed && event.id === id) handler(); });
  try { await Native.call("register", JSON.stringify({ id, ...parsed, ...options })); }
  catch (error) { subscription.remove(); throw error; }
  return { async remove() {
    if (removed) return;
    removed = true; subscription.remove(); await Native.call("remove", JSON.stringify({ id }));
  } };
}
let nextID = 0;
