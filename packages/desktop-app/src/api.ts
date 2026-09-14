import { NativeEventEmitter } from "react-native";
import Native from "./NativeDesktopApp";
export type AppContext = {
  projectId: string; name: string; version: string;
  runtime: { mode?: string; modules?: Record<string, string> };
  launchArguments: string[];
};
export type DesktopEvent = { type: string; id?: string; url?: string; windowId?: string; [key: string]: unknown };
const events = new NativeEventEmitter(Native);
export async function callApp<T = void>(method: string, args: object = {}): Promise<T> {
  return JSON.parse(await Native.call(method, JSON.stringify(args))) as T;
}
export const getAppContext = () => callApp<AppContext>("context");
export const quit = () => callApp("quit");
export const hide = () => callApp("hide");
export const activate = () => callApp("activate");
export function onDesktopEvent(listener: (event: DesktopEvent) => void) {
  return events.addListener("desktop", listener);
}
export function onAppEvent(listener: (event: DesktopEvent) => void) {
  return onDesktopEvent(event => { if (["activate", "deactivate", "reopen", "beforeQuit", "secondInstance"].includes(event.type)) listener(event); });
}
/** Await registration before enabling edits. A rejection or timeout cancels quit. */
export async function beforeQuit(handler: () => boolean | Promise<boolean>) {
  if (quitHandlerRegistered) throw new Error("A beforeQuit handler is already registered");
  quitHandlerRegistered = true;
  let removed = false;
  const subscription = onDesktopEvent(event => {
    if (event.type === "beforeQuit") void Promise.resolve().then(handler).then(
      allow => callApp("replyQuit", { allow: !removed && allow === true, requestId: event.requestId }),
      () => callApp("replyQuit", { allow: false, requestId: event.requestId }),
    ).catch(console.error);
  });
  try { await callApp("quitGuard", { enabled: true }); }
  catch (error) { subscription.remove(); quitHandlerRegistered = false; throw error; }
  return { async remove() {
    if (removed) return;
    removed = true; subscription.remove(); quitHandlerRegistered = false;
    await callApp("quitGuard", { enabled: false });
  } };
}
let quitHandlerRegistered = false;
