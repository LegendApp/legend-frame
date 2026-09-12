import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { DragDropView } from "@legend-apps/desktop/drag-drop";
import { registerGlobalShortcut } from "@legend-apps/desktop/global-shortcuts";
import { runCommand, spawn } from "@legend-apps/desktop/processes";
import { showMessage } from "@legend-apps/desktop/dialogs";
import * as clipboard from "@legend-apps/desktop/clipboard";
import * as system from "@legend-apps/desktop/system";
import * as windows from "@legend-apps/desktop/windows";
import { openDatabase } from "@legend-apps/desktop/sqlite";
import { WebView } from "@legend-apps/desktop/webview";
const webSource = { html: `<html><body style="font:16px system-ui;padding:16px"><h3>Embedded WebKit</h3><button onclick="window.ReactNativeWebView.postMessage('Hello from WebView')">Send a message to React Native</button></body></html>` };
const dragSource = { text: "Hello from the desktop kitchen sink" };
const dockItems = [{ id: "show", title: "Show kitchen sink" }, { id: "checked", title: "Checked item", checked: true }];
type Removable = { remove(): unknown };
export function Expansion({ report }: { report: (value: unknown) => void }) {
  const [style, setStyle] = useState(false);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [login, setLogin] = useState("Loading…");
  const [hotkey, setHotkey] = useState(false);
  const resources = useRef<Removable[]>([]);
  const shortcut = useRef<Awaited<ReturnType<typeof registerGlobalShortcut>> | undefined>(undefined);
  const dock = useRef<Removable | undefined>(undefined);
  const child = useRef<Awaited<ReturnType<typeof spawn>> | undefined>(undefined);
  const mounted = useRef(false);
  const act = useCallback(async (action: () => Promise<unknown>) => { try { report(await action()); } catch (error) { report(String(error)); } }, [report]);
  useEffect(() => {
    mounted.current = true; let disposed = false;
    void system.getLoginItemStatus().then(value => { if (!disposed) setLogin(value); }).catch(report);
    void system.onSystemEvent(report).then(value => { if (disposed) value.remove(); else resources.current.push(value); }).catch(report);
    return () => { disposed = true; mounted.current = false; for (const resource of resources.current) void resource.remove(); resources.current = []; void shortcut.current?.remove(); void child.current?.terminate(); };
  }, [report]);
  async function toggleShortcut() {
    setBusy(true);
    try {
      if (shortcut.current) { await shortcut.current.remove(); shortcut.current = undefined; setHotkey(false); }
      else {
        const value = await registerGlobalShortcut("Cmd+Shift+F12", () => report("Global shortcut fired"));
        if (!mounted.current) await value.remove(); else { shortcut.current = value; setHotkey(true); }
      }
    } finally { if (mounted.current) setBusy(false); }
  }
  async function sql() {
    const db = await openDatabase("kitchen.sqlite");
    try {
      await db.execute("CREATE TABLE IF NOT EXISTS visits (id INTEGER PRIMARY KEY, label TEXT)");
      await db.execute("INSERT INTO visits(label) VALUES (?)", ["Hello SQLite"]);
      return (await db.execute("SELECT count(*) AS count FROM visits")).rows;
    } finally { db.close(); }
  }
  return <View style={styles.section}>
    <Text style={styles.heading}>Window styling</Text>
    <View style={styles.row}>
      <Button title={style ? "Default title bar" : "Overlay title bar"} onPress={() => void act(async () => { await windows.setWindowOptions("main", { titleBarStyle: style ? "default" : "overlay" }); setStyle(!style); })} />
      <Button title="Floating child" onPress={() => void act(() => windows.openWindow({ id: "floating", parentId: "main", title: "Floating child", width: 500, height: 350, minWidth: 300, alwaysOnTop: true, material: "sidebar" }))} />
      <Button title="Modal window" onPress={() => void act(() => windows.openWindow({ id: "modal", parentId: "main", modal: true, title: "Modal window", width: 450, height: 300 }))} />
    </View>
    <Text style={styles.heading}>Drag and drop</Text>
    <DragDropView onDrop={event => { setOver(false); report(event); }} onDragEnter={() => setOver(true)} onDragLeave={() => setOver(false)} style={[styles.drop, over && styles.over]}>
      <Text style={styles.text}>Drop files, URLs or text here</Text>
    </DragDropView>
    <DragDropView source={dragSource} onDragEnd={report} style={styles.drop}><Text style={styles.text}>Drag this text into another app</Text></DragDropView>
    <View style={styles.row}>
      <Button title={hotkey ? "Remove global shortcut" : "Register ⌘⇧F12"} disabled={busy} onPress={() => void act(toggleShortcut)} />
      <Button title="Run /usr/bin/uname" onPress={() => void act(() => runCommand({ executable: "/usr/bin/uname", args: ["-a"] }))} />
      <Button title="Stream a process" disabled={busy} onPress={() => void act(async () => {
        setBusy(true);
        try { child.current = await spawn({ executable: "/bin/sh", args: ["-c", "printf 'First output\\n'; sleep 1; printf 'Second output\\n'"], timeoutMs: 5000 }, report); return await child.current.exited; }
        finally { child.current = undefined; if (mounted.current) setBusy(false); }
      })} />
      <Button title="Cancel process" onPress={() => void act(async () => child.current?.terminate())} />
    </View>
    <Text style={styles.heading}>Dialogs and rich clipboard</Text>
    <View style={styles.row}>
      <Button title="Confirmation sheet" onPress={() => void act(() => showMessage({ title: "Keep these changes?", message: "Native sheet with explicit buttons and checkbox.", windowId: "main", buttons: ["Cancel", "Keep"], defaultButton: 1, cancelButton: 0, checkbox: { label: "Remember my choice" } }))} />
      <Button title="Copy rich text" onPress={() => void act(() => clipboard.writeClipboard({ text: "Hello desktop", html: "<b>Hello desktop</b>", rtf: "{\\rtf1\\ansi Hello desktop}" }))} />
      <Button title="Read clipboard" onPress={() => void act(clipboard.readClipboard)} />
    </View>
    <Text style={styles.heading}>Dock, startup and power</Text>
    <Text style={styles.text}>Launch at login: {login}</Text>
    <View style={styles.row}>
      <Button title="System state" onPress={() => void act(system.getSystemInfo)} />
      <Button title="Dock badge" onPress={() => void act(() => system.setDockBadge("3"))} />
      <Button title="Clear badge" onPress={() => void act(() => system.setDockBadge(""))} />
      <Button title="Dock menu" onPress={() => void act(async () => { await dock.current?.remove(); const value = await system.setDockMenu(dockItems, id => { report(id); void windows.showWindow(); }); dock.current = value; resources.current.push(value); })} />
      <Button title="Prevent sleep for 5 seconds" onPress={() => void act(async () => { const value = await system.preventSleep("Kitchen sink demonstration"); resources.current.push(value); setTimeout(() => void value.remove(), 5000); })} />
      <Button title={login === "enabled" ? "Disable launch at login" : "Enable launch at login"} disabled={login === "unavailable" || login === "Loading…"} onPress={() => void act(async () => { await system.setLaunchAtLogin(login !== "enabled"); setLogin(await system.getLoginItemStatus()); })} />
    </View>
    <Text style={styles.heading}>SQLite</Text><Button title="Insert and count persisted rows" onPress={() => void act(sql)} />
    <Text style={styles.heading}>WebView</Text>
    <WebView source={webSource} style={styles.web} onMessage={event => report(event.nativeEvent.data)} onShouldStartLoadWithRequest={request => request.url === "about:blank"} />
  </View>;
}
const styles = StyleSheet.create({ text: { color: "#152238" }, section: { gap: 16 }, row: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, heading: { fontSize: 18, fontWeight: "600", color: "#152238" }, drop: { padding: 24, borderWidth: 1, borderColor: "#8091aa", borderRadius: 8 }, over: { backgroundColor: "#dbeafe" }, web: { height: 220, flex: 0 } });
