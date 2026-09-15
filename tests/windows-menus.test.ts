import { expect, test } from "bun:test";
import { composeWindowsMenus, patchWindowsMenus } from "../packages/native-menu/src/windows-menus";
import type { NativeMenuConfig } from "../packages/native-menu/src/api";
test("Windows menu contributions merge by title and restore targeted items when an owner clears", () => {
  const base: NativeMenuConfig[] = [{ id: "file", title: "File", items: [{ id: "open", title: "Open…", payload: { original: true } }, { id: "save", title: "Save" }] }];
  const owners = new Map<string, NativeMenuConfig[]>([["base", base], ["editor", [{ id: "editor-file", title: "File", items: [
    { id: "custom-open", targetTitles: ["Open..."], title: "Open document", payload: { path: "x" }, shortcut: { key: "o", modifiers: 1 << 20 } },
    { id: "missing", targetTitle: "Absent", title: "Never inserted" }, { id: "recent", title: "Recent", placement: { before: "Save" } },
  ] }]]]);
  const menu = composeWindowsMenus(owners)[0]!;
  expect(menu.items.map(item => item.id)).toEqual(["custom-open", "recent", "save"]);
  expect(menu.items[0]).toMatchObject({ _legendOwner: "editor", _legendMenu: "editor-file", payload: { path: "x" } });
  expect(base[0]!.items[0]!.title).toBe("Open…");
  owners.delete("editor"); expect(composeWindowsMenus(owners)[0]!.items).toHaveLength(2);
  expect(composeWindowsMenus(owners)[0]!.items[0]).toMatchObject({ id: "open", title: "Open…", _legendOwner: "base" });
});
test("Windows menu paths preserve original actions and patches retain null shortcut removal", () => {
  const owners = new Map<string, NativeMenuConfig[]>([["base", [{ id: "file", title: "File", items: [{ id: "save", title: "Save", payload: { original: true } }] }]],
    ["extension", [{ id: "file2", title: "File", items: [{ id: "bound", targetPath: ["Save"], title: "Save all", checked: true }] }]]]);
  expect(composeWindowsMenus(owners)[0]!.items[0]).toMatchObject({ id: "save", title: "Save all", checked: true, _legendOwner: "base", payload: { original: true } });
  const patched = patchWindowsMenus(owners.get("base")!, [{ id: "save", shortcut: null, enabled: false }]);
  expect(patched[0]!.items[0]).toMatchObject({ shortcut: null, enabled: false });
  expect(owners.get("base")![0]!.items[0]!.enabled).toBeUndefined();
});
test("Windows app menu and named root placement have deterministic order", () => {
  const owners = new Map<string, NativeMenuConfig[]>([["app", [
    { id: "file", title: "File", items: [] }, { id: "window", title: "Window", items: [] },
    { id: "edit", title: "Edit", placement: { before: "Window" }, items: [] },
    { id: "app", title: "My app", systemMenu: "app", items: [] },
  ]]]);
  expect(composeWindowsMenus(owners).map(menu => menu.title)).toEqual(["My app", "File", "Edit", "Window"]);
});
