import Native from "./NativeDesktopUpdates";
import { onDesktopEvent } from "@legendapp/frame-desktop-app";

export type UpdateStatus = {
  available: boolean;
  reason?: "go" | "development" | "unconfigured";
  started: boolean;
  canCheck: boolean;
  automaticallyChecks: boolean;
  feedURL?: string;
};
export type UpdateEvent = { type: "update"; state: "checking" | "available" | "notAvailable" | "downloading" | "downloaded" | "installing" | "error"; version?: string; message?: string };
async function call<T = void>(method: string, args: object = {}): Promise<T> { return JSON.parse(await Native.call(method, JSON.stringify(args))) as T; }
export const getUpdateStatus = () => call<UpdateStatus>("status");
/** Start Sparkle's scheduler after the application is ready. Safe to call again. */
export const startUpdates = () => call<UpdateStatus>("start");
/** Opens Sparkle's standard check/download/install UI. Resolves when the check starts. */
export const checkForUpdates = () => call("check");
/** Change this only in response to the user's preference; Sparkle persists it. */
export const setAutomaticUpdateChecks = (enabled: boolean) => call("automatic", { enabled });
export function onUpdateEvent(listener: (event: UpdateEvent) => void) {
  return onDesktopEvent(event => { if (event.type === "update") listener(event as UpdateEvent); });
}
