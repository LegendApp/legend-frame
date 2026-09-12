import Native from "./NativeDesktopNotifications";
import { onDesktopEvent } from "@legend-apps/desktop-app";

export type NotificationPermission = "notDetermined" | "denied" | "authorized" | "provisional" | "unknown";
export type DesktopNotification = {
  id: string;
  title: string;
  body?: string;
  subtitle?: string;
  sound?: boolean;
  /** Deliver after this many seconds, or immediately when omitted. */
  delay?: number;
  data?: Record<string, string>;
};
export type NotificationResponse = { type: "notificationResponse"; id: string; notificationId: string; action: "open" | "dismiss"; data: Record<string, string> };
async function call<T = void>(method: string, args: object = {}): Promise<T> {
  return JSON.parse(await Native.call(method, JSON.stringify(args))) as T;
}
function validId(id: string) {
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(id)) throw new Error("Notification id must contain 1–100 letters, numbers, dots, underscores or hyphens");
  return id;
}
export const getNotificationPermission = () => call<NotificationPermission>("permission");
/** Call from an explicit user action. Go shares its host's OS permission. */
export const requestNotificationPermission = () => call<NotificationPermission>("requestPermission");
export function showNotification(notification: DesktopNotification) {
  validId(notification.id);
  if (!notification.title?.trim()) throw new Error("Notification title is required");
  if (notification.delay !== undefined && (!Number.isFinite(notification.delay) || notification.delay < 1)) throw new Error("Notification delay must be at least one second");
  if (notification.data && Object.values(notification.data).some(value => typeof value !== "string")) throw new Error("Notification data values must be strings");
  return call("show", notification);
}
/** Removes pending and delivered notifications with this project-scoped id. */
export const cancelNotification = (id: string) => call("cancel", { id: validId(id) });
export const clearNotifications = () => call("clear");
export const getPendingNotifications = () => call<string[]>("pending");
export const getDeliveredNotifications = () => call<string[]>("delivered");
/** Subscribe before draining cold-launch responses; each subscription deduplicates overlap. */
export async function onNotificationResponse(listener: (response: NotificationResponse) => void) {
  let removed = false;
  const seen = new Set<string>();
  function receive(response: NotificationResponse) {
    if (removed || seen.has(response.id)) return;
    seen.add(response.id);
    if (seen.size > 256) seen.delete(seen.values().next().value!);
    listener(response);
  }
  const sub = onDesktopEvent(event => { if (event.type === "notificationResponse") receive(event as NotificationResponse); });
  try { for (const response of await call<NotificationResponse[]>("responses")) receive(response); }
  catch (error) { sub.remove(); throw error; }
  return { remove() { removed = true; sub.remove(); } };
}
