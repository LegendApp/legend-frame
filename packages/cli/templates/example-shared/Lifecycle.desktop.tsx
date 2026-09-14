import { useEffect } from "react";
import { Platform } from "react-native";
import { beforeWindowClose, setWindowTitle, onWindowEvent } from "@legend-apps/desktop-windows";
import { beforeQuit } from "@legend-apps/desktop-app";
import { configureMenus, clearMenus, addNativeMenuActionListener } from "@legend-apps/native-menu";
import { registerShortcut } from "@legend-apps/desktop-shortcuts";
import { mountSerial } from "./lifetime";
import type { LifecycleProps } from "./lifecycle-types";
export function Lifecycle({ title, windowId = "main", flush, commands, onError }: LifecycleProps) {
  useEffect(() => { void setWindowTitle(windowId, title).catch(error => onError(String(error))); }, [title, windowId, onError]);
  useEffect(() => mountSerial(`window-${windowId}`, async retain => {
    const owner = `example-${windowId}`;
    const menu = () => configureMenus(owner, [{ id: "file", title: "File", items: commands.map(({ id, title }) => ({ id, title })) }]);
    menu();
    await retain(Promise.resolve({ remove: () => clearMenus(owner) }));
    await retain(Promise.resolve(addNativeMenuActionListener(event => { if (event.ownerId === owner) commands.find(command => command.id === event.itemId)?.run(); })));
    await retain(Promise.resolve(onWindowEvent(event => { if (event.windowId === windowId && event.type === "focus") menu(); })));
    await retain(beforeWindowClose(windowId, flush));
    if (windowId === "main") await retain(beforeQuit(flush));
    for (const command of commands) await retain(registerShortcut(`${Platform.OS === "windows" ? "Control" : "Command"}+${command.key}`, command.run, { windowId }));
  }, onError), [windowId, flush, commands, onError]);
  return null;
}
