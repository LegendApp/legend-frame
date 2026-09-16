import type { NativeMenuConfig, NativeMenuItem, NativeMenuItemPatch } from "./api";
type Item = NativeMenuItem & { _legendOwner: string; _legendMenu: string };
type Menu = Omit<NativeMenuConfig, "items"> & { items: Item[] };
const titleKey = (title = "") => title.replaceAll("…", "...").trim().toLowerCase();
function insertion<T extends { title?: string }>(items: T[], placement?: { before?: string; after?: string }) {
  for (const position of ["before", "after"] as const) {
    const title = placement?.[position];
    if (title) { const index = items.findIndex(item => titleKey(item.title) === titleKey(title)); if (index >= 0) return index + (position === "after" ? 1 : 0); }
  }
  return items.length;
}
/** Recompute owners' contributions so removing a binding restores the original item. */
export type MenuDiagnostic = { code: "E_MENU_TARGET_NOT_FOUND"; ownerId: string; menuId: string; itemId: string; targets: string[] };
export function composeWindowsMenus(owners: ReadonlyMap<string, NativeMenuConfig[]>, diagnose: (diagnostic: MenuDiagnostic) => void = diagnostic => console.warn("Windows menu target not found", diagnostic)): Menu[] {
  const result: Menu[] = [];
  for (const [owner, configs] of owners) for (const config of configs) {
    let menu = result.find(menu => config.systemMenu === "app" ? menu.systemMenu === "app" : menu.title === config.title);
    if (!menu) {
      menu = { ...config, items: [] };
      result.splice(config.systemMenu === "app" ? 0 : insertion(result, config.placement), 0, menu);
    }
    for (const input of config.items) {
      // Public menu contributions are flat on Windows; AppKit system submenus
      // have no counterpart. Reject before publishing rather than dropping them.
      if ((input.targetPath?.length ?? 0) > 1) throw Object.assign(new Error(`Windows menu ${config.id}/${input.id} does not support nested targetPath: ${input.targetPath!.join(" > ")}`), { code: "E_MENU_TARGET_UNSUPPORTED" });
      const candidates = input.targetPath?.length ? input.targetPath : [input.targetTitle, ...(input.targetTitles ?? [])].filter((title): title is string => !!title);
      const targets = !!(input.targetTitle || input.targetTitles?.length || input.targetPath?.length);
      const target = candidates.map(title => menu.items.find(item => titleKey(item.title) === titleKey(title))).find(Boolean);
      if (targets && !target) { diagnose({ code: "E_MENU_TARGET_NOT_FOUND", ownerId: owner, menuId: config.id, itemId: input.id, targets: candidates }); continue; }
      const identity = input.targetPath?.length && target ? { _legendOwner: target._legendOwner, _legendMenu: target._legendMenu, id: target.id, payload: target.payload } : { _legendOwner: owner, _legendMenu: config.id, id: input.id };
      const item: Item = { ...target, ...input, ...identity };
      if (target) {
        const index = menu.items.indexOf(target);
        menu.items.splice(index, 1);
        menu.items.splice(input.placement ? insertion(menu.items, input.placement) : index, 0, item);
      } else menu.items.splice(insertion(menu.items, input.placement), 0, item);
    }
  }
  return result;
}
export function patchWindowsMenus(menus: NativeMenuConfig[], patches: NativeMenuItemPatch[]): NativeMenuConfig[] {
  return menus.map(menu => ({ ...menu, items: menu.items.map(item => patches.reduce((item, patch) => patch.id === item.id ? { ...item, ...patch } : item, item)) }));
}
