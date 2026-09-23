import { getDisplays, listWindows, openWindow, setWindowFrame, showWindow, onWindowEvent } from "@legendapp/spark/windows";
import { notes } from "./store";
import { WindowSession } from "./window-session";
export const desktop = true;
const session = new WindowSession(notes, {
  list: listWindows,
  workAreas: async () => (await getDisplays()).map(display => display.workArea),
  show: showWindow,
  frame: setWindowFrame,
  open: window => openWindow({ id: window.id, title: window.id === "settings" ? "Notes Settings" : "Notes", width: window.frame.width, height: window.frame.height, props: window.id === "settings" ? { settings: true } : { noteId: window.noteId } }),
});
export const openNote = (noteId: string) => session.openNote(noteId);
export const openSettings = () => session.openSettings();
export const showNotebook = () => showWindow("main");
export const restoreSession = session.restore;
export const flushSession = session.quit;
export function watchSession(onError: (message: string) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const subscription = onWindowEvent(event => {
    if (!session.known(event.windowId) || !["move", "resize", "closed"].includes(event.type)) return;
    clearTimeout(timer);
    timer = setTimeout(() => { void session.restore().then(session.capture).catch(error => onError(String(error))); }, 150);
  });
  return { remove() { clearTimeout(timer); subscription.remove(); } };
}
