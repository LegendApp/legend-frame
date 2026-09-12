import Native from "./NativeDesktopLinks";
import { callApp, onDesktopEvent, type DesktopEvent } from "@legend-apps/desktop-app";
export type OpenEvent = { type: "openFile" | "openURL"; id: string; url: string };
function url(value: string) { if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) throw new Error("URL must include a scheme"); return value; }
async function call<T = void>(method: string, args: object = {}): Promise<T> { return JSON.parse(await Native.call(method, JSON.stringify(args))) as T; }
export const openURL = (value: string) => call("open", { url: url(value) });
export const canOpenURL = (value: string) => call<boolean>("canOpen", { url: url(value) });
export const noteRecentDocument = (value: string) => call("noteRecent", { url: url(value) });
export const clearRecentDocuments = () => call("clearRecent");
export const getRecentDocuments = () => call<string[]>("recent");
/** Subscribe before fetching queued launches; event ids deduplicate the overlap. */
export async function onOpen(listener: (event: OpenEvent) => void) {
  const seen = new Set<string>(); let removed = false;
  function deliver(event: DesktopEvent) {
    if (removed || (event.type !== "openFile" && event.type !== "openURL") || !event.id || seen.has(event.id)) return;
    seen.add(event.id);
    if (seen.size > 200) seen.delete(seen.values().next().value!);
    listener(event as OpenEvent);
  }
  const subscription = onDesktopEvent(deliver);
  try { for (const event of await callApp<DesktopEvent[]>("pendingURLs")) deliver(event); }
  catch (error) { subscription.remove(); throw error; }
  return { remove() { removed = true; subscription.remove(); } };
}
