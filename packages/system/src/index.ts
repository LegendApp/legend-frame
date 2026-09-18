import Native from "./NativeDesktopSystem";
import { onDesktopEvent } from "@legendapp/frame-desktop-app";
export type SystemInfo = { osVersion: string; architecture: string; locale: string; dark: boolean; idleSeconds: number; onBattery: boolean; batteryLevel: number | null };
export type SystemEvent = { type: "sleep" | "wake" | "lock" | "unlock" | "powerChanged" | "appearanceChanged" | "displaysChanged" };
export type DockMenuItem = { id: string; title: string; enabled?: boolean; checked?: boolean };
async function call<T = void>(method: string, args: object = {}): Promise<T> { return JSON.parse(await Native.call(method, JSON.stringify(args))); }
export const getSystemInfo = () => call<SystemInfo>("info");
export const getLoginItemStatus = () => call<"enabled" | "disabled" | "requiresApproval" | "notFound" | "unavailable">("loginStatus");
export const setLaunchAtLogin = (enabled: boolean) => call("login", { enabled });
export const setDockBadge = (label: string) => call("badge", { label });
export async function requestAttention(critical = false) {
  const id = await call<number>("attention", { critical });
  return { remove: () => call("cancelAttention", { id }) };
}
export async function preventSleep(reason: string, kind: "display" | "system" = "display") {
  if (!reason.trim()) throw new Error("A reason is required");
  const id = await call<number>("preventSleep", { reason, kind }); let removed = false;
  return { async remove() { if (!removed) { await call("allowSleep", { id }); removed = true; } } };
}
let dockSequence = 0;
export async function setDockMenu(items: DockMenuItem[], handler: (id: string) => void) {
  const owner = `dock-${Date.now()}-${++dockSequence}`;
  const ids = new Set<string>();
  for (const item of items) { if (!item.id || !item.title || ids.has(item.id)) throw new Error("Dock items need unique ids and titles"); ids.add(item.id); }
  const subscription = onDesktopEvent(event => { if (event.type === "dockAction" && event.owner === owner && typeof event.id === "string") handler(event.id); });
  try { await call("dockMenu", { items, owner }); } catch (error) { subscription.remove(); throw error; }
  let removed = false;
  return { async remove() { if (!removed) { await call("clearDockMenu", { owner }); subscription.remove(); removed = true; } } };
}
export async function onSystemEvent(handler: (event: SystemEvent) => void) {
  const types = ["sleep", "wake", "lock", "unlock", "powerChanged", "appearanceChanged", "displaysChanged"];
  const subscription = onDesktopEvent(event => { if (types.includes(event.type)) handler(event as SystemEvent); });
  try { await call("observe"); } catch (error) { subscription.remove(); throw error; }
  return subscription;
}
