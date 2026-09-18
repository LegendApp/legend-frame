import { useEffect } from "react";
import { Platform } from "react-native";
import { beforeWindowClose, setWindowTitle, onWindowEvent } from "@legendapp/frame-desktop-windows";
import { beforeQuit } from "@legendapp/frame-desktop-app";
import { configureMenus, clearMenus, addNativeMenuActionListener } from "@legendapp/frame-native-menu";
import { registerShortcut, parseAccelerator } from "@legendapp/frame-desktop-shortcuts";
import { mountSerial } from "./lifetime";
import type { LifecycleProps } from "./lifecycle-types";
let activeMenuOwner: string | undefined;
export function Lifecycle({ title, windowId = "main", flush, quit, commands, onError }: LifecycleProps) {
  useEffect(() => { void setWindowTitle(windowId, title).catch(error => onError(String(error))); }, [title, windowId, onError]);
  useEffect(() => mountSerial(`window-${windowId}`, async retain => {
    const owner = `example-${windowId}`;
    const menu = () => {
      if (activeMenuOwner && activeMenuOwner !== owner) clearMenus(activeMenuOwner);
      configureMenus(owner, [{ id: "file", title: "File", items: commands.map(({ id, title, key }) => ({ id, title, shortcut: parseAccelerator(`${Platform.OS === "windows" ? "Control" : "Command"}+${key}`) })) }]);
      activeMenuOwner = owner;
    };
    menu();
    await retain(Promise.resolve({ remove: () => { clearMenus(owner); if (activeMenuOwner === owner) activeMenuOwner = undefined; } }));
    await retain(Promise.resolve(addNativeMenuActionListener(event => { if (event.ownerId === owner) commands.find(command => command.id === event.itemId)?.run(); })));
    await retain(Promise.resolve(onWindowEvent(event => { if (event.windowId === windowId && event.type === "focus") menu(); })));
    const guarded = (save: () => Promise<boolean>) => async () => {
      try { return await save(); } catch (error) { onError(String(error)); return false; }
    };
    await retain(beforeWindowClose(windowId, guarded(flush)));
    if (windowId === "main") await retain(beforeQuit(guarded(quit ?? flush)));
    for (const command of commands) await retain(registerShortcut(`${Platform.OS === "windows" ? "Control" : "Command"}+${command.key}`, command.run, { windowId }));
  }, onError), [windowId, flush, quit, commands, onError]);
  return null;
}
