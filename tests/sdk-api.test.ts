import { beforeEach, expect, mock, test } from "bun:test";
const calls: { native: string; method: string; args: any }[] = [];
const handlers = new Map<string, (args: any) => unknown | Promise<unknown>>();
const subscriptions = new Map<string, Set<(event: any) => void>>();
const moduleObjects = new Map<string, any>();
function module(name: string) {
  if (!moduleObjects.has(name)) moduleObjects.set(name, new Proxy({ name }, { get(target, key) {
    if (key === "name") return target.name;
    return async (...args: any[]) => {
      const method = key === "call" ? args[0] : String(key);
      const value = key === "call" ? JSON.parse(args[1]) : args;
      calls.push({ native: name, method, args: value });
      const result = await handlers.get(`${name}.${method}`)?.(value);
      return key === "call" ? JSON.stringify(result ?? null) : result;
    };
  } }));
  return moduleObjects.get(name);
}
function emit(name: string, event: string, value: unknown) {
  for (const listener of subscriptions.get(`${name}.${event}`) ?? []) listener(value);
}
mock.module("react-native", () => ({
  Platform: { OS: "macos" },
  TurboModuleRegistry: { getEnforcing: module },
  NativeEventEmitter: class {
    constructor(private native: { name: string }) {}
    addListener(event: string, listener: (event: any) => void) {
      const key = `${this.native.name}.${event}`;
      if (!subscriptions.has(key)) subscriptions.set(key, new Set());
      subscriptions.get(key)!.add(listener);
      return { remove: () => subscriptions.get(key)!.delete(listener) };
    }
  },
}));
const app = await import("../packages/desktop-app/src/index");
const windows = await import("../packages/desktop-windows/src/index");
const files = await import("../packages/file-system/src/index");
const clipboard = await import("../packages/clipboard/src/index");
const links = await import("../packages/desktop-links/src/index");
const { secureStorage } = await import("../packages/secure-storage/src/index");
const shortcuts = await import("../packages/desktop-shortcuts/src/index");
const menus = await import("../packages/native-menu/src/index");
const context = await import("../packages/context-menu/src/index");
const dialogs = await import("../packages/file-dialog/src/index");
beforeEach(() => { calls.length = 0; handlers.clear(); subscriptions.clear(); });
const tick = () => Bun.sleep(1);
function nativeError(code: string) { return Object.assign(new Error(code), { code }); }

test("app context, activation, hide and quit call the native host", async () => {
  handlers.set("NativeDesktopApp.context", () => ({ projectId: "a" }));
  expect((await app.getAppContext()).projectId).toBe("a");
  await app.activate(); await app.hide(); await app.quit();
  expect(calls.map(call => call.method)).toEqual(["context", "activate", "hide", "quit"]);
});
test("quit guards aggregate async result, reject duplicate registration and dispose once", async () => {
  const guard = await app.beforeQuit(async () => true);
  await expect(app.beforeQuit(() => true)).rejects.toThrow("already registered");
  emit("NativeDesktopApp", "desktop", { type: "beforeQuit" }); await tick();
  expect(calls.find(call => call.method === "replyQuit")?.args.allow).toBe(true);
  await guard.remove(); await guard.remove();
  expect(calls.filter(call => call.method === "quitGuard" && !call.args.enabled)).toHaveLength(1);
});
test("throwing or disposed quit guards cancel instead of discarding edits", async () => {
  let guard = await app.beforeQuit(() => { throw new Error("save failed"); });
  emit("NativeDesktopApp", "desktop", { type: "beforeQuit" }); await tick();
  expect(calls.find(call => call.method === "replyQuit")?.args.allow).toBe(false); await guard.remove();
  let finish!: (allow: boolean) => void;
  guard = await app.beforeQuit(() => new Promise<boolean>(resolve => { finish = resolve; }));
  emit("NativeDesktopApp", "desktop", { type: "beforeQuit" }); await tick(); await guard.remove(); finish(true); await tick();
  expect(calls.filter(call => call.method === "replyQuit").at(-1)?.args.allow).toBe(false);
});
test("failed guard registration cleans listeners and permits retry", async () => {
  handlers.set("NativeDesktopApp.quitGuard", () => { throw new Error("bridge"); });
  await expect(app.beforeQuit(() => true)).rejects.toThrow("bridge");
  expect(subscriptions.get("NativeDesktopApp.desktop")?.size).toBe(0);
  handlers.delete("NativeDesktopApp.quitGuard"); await (await app.beforeQuit(() => true)).remove();
});
test("windows validate ids and finite frame sizes before crossing the bridge", () => {
  for (const id of ["", "../window", "main", "x".repeat(101)]) expect(() => windows.openWindow({ id })).toThrow();
  for (const width of [0, NaN, Infinity, 99, 20001]) expect(() => windows.openWindow({ id: "test", width })).toThrow();
  expect(() => windows.setWindowFrame("main", { x: NaN, y: 0, width: 400, height: 400 })).toThrow();
  expect(calls).toHaveLength(0);
});
test("window commands serialize explicit window identity and properties", async () => {
  await windows.openWindow({ id: "secondary", props: { route: "settings" } }); await windows.getWindow(); await windows.listWindows(); await windows.getDisplays();
  await windows.setWindowTitle("secondary", "Settings"); await windows.setWindowFrame("secondary", { x: 1, y: 2, width: 500, height: 300 });
  await windows.minimizeWindow("secondary"); await windows.setFullscreen("secondary", true); await windows.hideWindow("secondary"); await windows.showWindow("secondary"); await windows.closeWindow("secondary");
  expect(calls[0]?.args.props).toEqual({ route: "settings" }); expect(calls[1]?.args.id).toBe("main");
  expect(calls.map(call => call.method)).toEqual(["open", "info", "list", "displays", "title", "frame", "minimize", "fullscreen", "hide", "show", "close"]);
});
test("window close guards handle only their window and coalesce repeated requests", async () => {
  let requests = 0; let finish!: (allow: boolean) => void;
  const guard = await windows.beforeWindowClose("test", () => { requests++; return new Promise<boolean>(resolve => { finish = resolve; }); });
  emit("NativeDesktopApp", "desktop", { type: "beforeClose", windowId: "other" });
  emit("NativeDesktopApp", "desktop", { type: "beforeClose", windowId: "test" });
  emit("NativeDesktopApp", "desktop", { type: "beforeClose", windowId: "test" }); await tick(); expect(requests).toBe(1);
  finish(false); await tick(); expect(calls.find(call => call.method === "replyClose")?.args).toEqual({ id: "test", allow: false });
  await guard.remove();
});
test("filesystem errors preserve permission failures instead of pretending files are absent", async () => {
  handlers.set("NativeDesktopFileSystem.stat", () => { throw nativeError("E_NOT_FOUND"); }); expect(await files.exists("/missing")).toBe(false);
  handlers.set("NativeDesktopFileSystem.stat", () => { throw nativeError("E_PERMISSION"); }); await expect(files.exists("/protected")).rejects.toThrow("E_PERMISSION");
  expect(() => files.readText("relative")).toThrow("absolute"); expect(() => files.writeText("/a\0b", "text")).toThrow();
});
test("filesystem binary and mutation APIs preserve paths and opt-in recursive deletion", async () => {
  await files.getDirectory("data"); await files.readText("file:///tmp/a%20b"); await files.writeText("/a", "text"); await files.readBase64("/a"); await files.writeBase64("/b", "AA==");
  await files.mkdir("/dir"); await files.list("/dir"); await files.copy("/a", "/b"); await files.move("/b", "/c"); await files.remove("/dir"); await files.remove("/dir", { recursive: true });
  expect(calls[1]?.args.path).toBe("file:///tmp/a%20b"); expect(calls.filter(call => call.method === "remove").map(call => call.args.recursive)).toEqual([false, true]);
});
test("watches filter by registration id and remove idempotently", async () => {
  const observed: string[] = []; const first = await files.watch("/first", path => observed.push(path)); const second = await files.watch("/second", path => observed.push(path));
  const firstID = calls[0]?.args.id; const secondID = calls[1]?.args.id;
  emit("NativeDesktopFileSystem", "change", { id: secondID, path: "/second" }); expect(observed).toEqual(["/second"]);
  await first.remove(); await first.remove(); emit("NativeDesktopFileSystem", "change", { id: firstID, path: "/first" }); expect(observed).toHaveLength(1);
  await second.remove(); expect(calls.filter(call => call.method === "unwatch")).toHaveLength(2);
});
test("failed watchers remove their listener", async () => {
  handlers.set("NativeDesktopFileSystem.watch", () => { throw nativeError("E_NOT_FOUND"); });
  await expect(files.watch("/missing/a", () => {})).rejects.toThrow(); expect(subscriptions.get("NativeDesktopFileSystem.change")?.size).toBe(0);
});
test("clipboard and Keychain preserve empty strings and missing values", async () => {
  handlers.set("NativeDesktopClipboard.readText", () => ""); handlers.set("NativeDesktopClipboard.hasText", () => false);
  expect(await clipboard.readClipboardText()).toBe(""); expect(await clipboard.hasClipboardText()).toBe(false); await clipboard.writeClipboardText("hello");
  expect(await secureStorage.get("key")).toBeNull(); await secureStorage.set("key", ""); expect(calls.at(-1)?.args.value).toBe(""); await secureStorage.remove("key");
  expect(() => secureStorage.get("")).toThrow(); expect(() => secureStorage.get("x".repeat(201))).toThrow();
});
test("links deduplicate queued/live overlap and stop delivery on removal", async () => {
  const cold = { type: "openURL" as const, id: "cold", url: "demo://cold" };
  handlers.set("NativeDesktopApp.pendingURLs", () => { emit("NativeDesktopApp", "desktop", cold); return [cold]; });
  const received: import("../packages/desktop-links/src/index").OpenEvent[] = []; const sub = await links.onOpen(event => received.push(event)); expect(received).toEqual([cold]);
  emit("NativeDesktopApp", "desktop", { type: "focus" }); expect(received).toHaveLength(1);
  sub.remove(); emit("NativeDesktopApp", "desktop", { ...cold, id: "warm" }); expect(received).toHaveLength(1);
});
test("links registration failures clean up listeners and URL validation is early", async () => {
  handlers.set("NativeDesktopApp.pendingURLs", () => { throw new Error("bridge"); });
  await expect(links.onOpen(() => {})).rejects.toThrow("bridge"); expect(subscriptions.get("NativeDesktopApp.desktop")?.size).toBe(0);
  expect(() => links.openURL("example.com")).toThrow("scheme"); await links.openURL("https://example.com"); await links.canOpenURL("demo://test"); await links.noteRecentDocument("file:///tmp/a"); await links.getRecentDocuments(); await links.clearRecentDocuments();
});
test("shortcuts dispatch only their registration and clean up on failure/removal", async () => {
  let count = 0; const sub = await shortcuts.registerShortcut("Cmd+K", () => { count++; }); const id = calls[0]?.args.id;
  emit("NativeDesktopShortcuts", "shortcut", { id: "other" }); emit("NativeDesktopShortcuts", "shortcut", { id }); expect(count).toBe(1);
  await sub.remove(); await sub.remove(); emit("NativeDesktopShortcuts", "shortcut", { id }); expect(count).toBe(1);
  handlers.set("NativeDesktopShortcuts.register", () => { throw nativeError("E_SHORTCUT_CONFLICT"); });
  await expect(shortcuts.registerShortcut("Cmd+K", () => {})).rejects.toThrow(); expect(subscriptions.get("NativeDesktopShortcuts.shortcut")?.size).toBe(0);
});
test("context menus validate location, duplicate ids and cancellation", async () => {
  await expect(context.showContextMenu([], { x: NaN, y: 0 })).rejects.toThrow("finite");
  await expect(context.showContextMenu([{ id: "x", title: "A" }, { id: "x", title: "B" }], { x: 0, y: 0 })).rejects.toThrow("unique");
  handlers.set("NativeContextMenu.showMenu", () => ""); expect(await context.showContextMenu([], { x: 0, y: 0 })).toBeNull();
  handlers.set("NativeContextMenu.showMenu", () => "selected"); expect(await context.showContextMenu([{ id: "selected", title: "Select" }], { x: 0, y: 0 })).toBe("selected");
});
test("dialogs parse selected URLs and native cancellation, preserving save conflicts", async () => {
  handlers.set("NativeFileDialog.open", () => '["file:///tmp/example.txt"]'); expect(await dialogs.openFileDialog()).toEqual(["file:///tmp/example.txt"]);
  handlers.set("NativeFileDialog.open", () => "null"); expect(await dialogs.openFileDialog()).toBeNull();
  handlers.set("NativeFileDialog.save", () => '"file:///tmp/save.txt"'); expect(await dialogs.saveFileDialog()).toBe("file:///tmp/save.txt");
  handlers.set("NativeFileDialog.writeTextFileIfUnchanged", () => false); expect(await dialogs.writeTextFileIfUnchanged("/a", "old", "new")).toBe(false);
  handlers.set("NativeFileDialog.readTextFile", () => "text"); expect(await dialogs.readTextFile("/a")).toBe("text"); await dialogs.writeTextFile("/a", "new"); await dialogs.revealInFinder("/a");
});
test("menu owner ids and patch payloads survive native transport", async () => {
  const configuration = [{ id: "file", title: "File", items: [{ id: "save", title: "Save", checked: true }] }];
  menus.configureMenus("owner", configuration); menus.updateMenuItems("owner", [{ id: "save", enabled: false }]); menus.clearMenus("owner"); menus.clearAllMenus();
  expect(calls[0]?.args).toEqual(["owner", JSON.stringify(configuration)]); expect(calls.map(call => call.method)).toEqual(["configureMenus", "updateMenuItems", "clearMenus", "clearAllMenus"]);
  let received: unknown; const sub = menus.addNativeMenuActionListener(event => { received = event; }); const event = { ownerId: "owner", menuId: "file", itemId: "save" };
  emit("NativeMenu", "NativeMenuAction", event); expect(received).toEqual(event); sub.remove();
});
