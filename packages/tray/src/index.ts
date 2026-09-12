import Native from "./NativeDesktopTray";
import { onDesktopEvent } from "@legend-apps/desktop-app";

export type TrayMenuItem = { id: string; title: string; enabled?: boolean; checked?: boolean; items?: TrayMenuItem[] } | { separator: true };
export type TrayOptions = { id: string; title?: string; /** SF Symbol name. */ symbol?: string; tooltip?: string; menu?: TrayMenuItem[] };
export type TrayAction = { trayId: string; itemId?: string; type: "trayClick" | "trayAction" };
async function call<T = void>(method: string, args: object): Promise<T> { return JSON.parse(await Native.call(method, JSON.stringify(args))) as T; }
function validate(options: Partial<TrayOptions>) {
  if (options.id !== undefined && !/^[a-zA-Z0-9_-]{1,100}$/.test(options.id)) throw new Error("Invalid tray id");
  if (options.title !== undefined && typeof options.title !== "string") throw new Error("Tray title must be a string");
  const ids = new Set<string>();
  function menu(items: TrayMenuItem[], depth: number) {
    if (depth > 5) throw new Error("Tray menus support at most five levels");
    for (const item of items) {
      if ("separator" in item) continue;
      if (!item.id || ids.has(item.id) || !item.title) throw new Error("Tray menu items need unique ids and titles");
      ids.add(item.id);
      if (item.items) menu(item.items, depth + 1);
    }
  }
  if (options.menu) menu(options.menu, 1);
}
export async function createTray(options: TrayOptions, onAction: (action: TrayAction) => void = () => {}) {
  validate(options);
  if (!options.id || (!options.title && !options.symbol)) throw new Error("Tray needs an id and a title or symbol");
  let removed = false;
  let queue: Promise<unknown> = Promise.resolve();
  const sub = onDesktopEvent(event => {
    if (!removed && event.trayId === options.id && (event.type === "trayClick" || event.type === "trayAction")) onAction(event as TrayAction);
  });
  try { await call("create", options); } catch (error) { sub.remove(); throw error; }
  return {
    async update(changes: Omit<Partial<TrayOptions>, "id">) {
      if (removed) throw new Error("Tray was removed");
      validate(changes);
      const next = queue.then(() => call("update", { ...changes, id: options.id }));
      queue = next.catch(() => {});
      await next;
    },
    async remove() {
      if (removed) return;
      removed = true; sub.remove();
      await queue; await call("remove", { id: options.id });
    },
  };
}
