import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as app from "@legend-apps/desktop/app";
import * as windows from "@legend-apps/desktop/windows";
import * as files from "@legend-apps/desktop/files";
import { settings } from "@legend-apps/desktop/settings";
import * as clipboard from "@legend-apps/desktop/clipboard";
import * as links from "@legend-apps/desktop/links";
import * as secureStore from "@legend-apps/desktop/secure-storage";
import { registerShortcut } from "@legend-apps/desktop/shortcuts";
import { showContextMenu } from "@legend-apps/desktop/context-menu";
import { configureMenus, clearMenus, addNativeMenuActionListener } from "@legend-apps/desktop/menus";
import { openFileDialog, saveFileDialog, revealInFinder } from "@legend-apps/desktop/dialogs";
import { runChecks, type Check } from "./checks";
import { APIChecks } from "./APIChecks";
import { ExpansionChecks } from "./ExpansionChecks";
import { Expansion } from "./Expansion";
import { Integrations } from "./Integrations";
import { testDriver } from "./test-driver";

type Props = Partial<app.AppContext> & { windowId?: string; windowProps?: { message?: string; readyFile?: string } };
function argument(args: string[], name: string) { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; }
export default function App(props: Props) {
  const args = props.launchArguments ?? [];
  const report = argument(args, "--legend-test-report");
  if (props.windowId && props.windowId !== "main") return <SecondaryWindow {...props} />;
  const apiReport = argument(args, "--legend-api-report");
  if (apiReport) return <APIChecks report={apiReport} expectedInitial={argument(args, "--legend-api-initial") ?? null} />;
  const expansionReport = argument(args, "--legend-expansion-report");
  if (expansionReport) return <ExpansionChecks report={expansionReport} />;
  if (report) return <AutomatedChecks report={report} args={args} />;
  return <KitchenSink {...props} />;
}
function SecondaryWindow(props: Props) {
  useEffect(() => {
    const file = props.windowProps?.readyFile;
    if (file) void files.writeText(file, props.windowProps?.message ?? "").catch(console.error);
    return () => { if (file) void files.writeText(`${file}.closed`, "unmounted").catch(console.error); };
  }, [props.windowProps?.readyFile, props.windowProps?.message]);
  return <View style={styles.root} testID="secondary-window">
    <Text style={styles.title}>Secondary window</Text><Text style={styles.text}>{props.windowProps?.message ?? props.windowId}</Text>
    <Button title="Close this window" onPress={() => void windows.closeWindow(props.windowId).catch(console.error)} />
  </View>;
}
function AutomatedChecks({ report, args }: { report: string; args: string[] }) {
  const [checks, setChecks] = useState<Check[]>([]);
  useEffect(() => {
    let started = false;
    // Let the main React window mount before opening secondary roots.
    const timer = setTimeout(() => {
      if (started) return; started = true;
      void runChecks(async result => { setChecks(previous => [...previous, result]); await files.writeText(`${report}.progress`, JSON.stringify(result)); }, testDriver, argument(args, "--legend-isolation-expect") ? { expect: argument(args, "--legend-isolation-expect") as "absent" | "present", cleanup: args.includes("--legend-isolation-cleanup") } : undefined)
        .then(async result => {
          await files.writeText(report, JSON.stringify(result, null, 2));
          if (args.includes("--legend-test-quit-on-complete")) { await new Promise(resolve => setTimeout(resolve, 2500)); await app.beforeQuit(() => true); await app.quit(); }
        })
        .catch(error => files.writeText(report, JSON.stringify({ passed: false, error: String(error), results: [] })));
    }, 500);
    return () => clearTimeout(timer);
  }, [report, args]);
  return <ScrollView style={styles.root} testID="automated-checks"><Text style={styles.title}>Native SDK checks</Text>{checks.map(check => <Text key={check.name} style={styles.text}>{check.passed ? "PASS" : "FAIL"} {check.name} {check.error}</Text>)}</ScrollView>;
}
function Card({ title, children }: React.PropsWithChildren<{ title: string }>) { return <View style={styles.card}><Text style={styles.heading}>{title}</Text>{children}</View>; }
function KitchenSink({ runtime, projectId }: Props) {
  const [log, setLog] = useState<string[]>([]);
  const [document, setDocument] = useState({ path: "", saved: "", text: "Hello from a native desktop app.\n" });
  const documentRef = useRef(document); documentRef.current = document;
  const [count, setCount] = useState<number | null>(null);
  const [secret, setSecret] = useState("");
  const report = useCallback((value: unknown) => setLog(previous => [`${new Date().toLocaleTimeString()}  ${typeof value === "string" ? value : JSON.stringify(value)}`, ...previous].slice(0, 60)), []);
  const action = useCallback(async (fn: () => unknown | Promise<unknown>) => { try { const result = await fn(); if (result !== undefined) report(result); } catch (error) { report(String(error)); } }, [report]);
  const load = useCallback(async () => {
    const selected = await openFileDialog({ title: "Open a text document", allowedFileTypes: ["txt", "md", "json"], allowsMultipleSelection: false });
    if (!selected?.[0]) return;
    const path = selected[0]; const text = await files.readText(path);
    setDocument({ path, text, saved: text }); await links.noteRecentDocument(path.startsWith("file://") ? path : `file://${encodeURI(path)}`); report(`Opened ${path}`);
  }, [report]);
  const save = useCallback(async () => {
    const current = documentRef.current;
    const path = current.path || await saveFileDialog({ defaultName: "Hello.txt" });
    if (!path) return;
    await files.writeText(path, current.text); setDocument(previous => ({ ...previous, path, saved: current.text })); report(`Saved ${path}`);
  }, [report]);
  useEffect(() => {
    const removers: Array<() => unknown> = []; let disposed = false;
    function retain(sub: { remove(): unknown }) { if (disposed) void sub.remove(); else removers.push(() => sub.remove()); }
    configureMenus("kitchen-sink", [{ id: "document", title: "Document", items: [{ id: "open", title: "Open…", shortcut: { key: "o" } }, { id: "save", title: "Save…", shortcut: { key: "s" } }] }]);
    retain(addNativeMenuActionListener(event => { if (event.ownerId === "kitchen-sink") void action(event.itemId === "open" ? load : save); }));
    retain(app.onAppEvent(report)); retain(windows.onWindowEvent(report));
    void registerShortcut("Command+Shift+K", () => report("Shortcut: Command+Shift+K")).then(retain).catch(report);
    void links.onOpen(event => { if (event.type === "openFile") report(event); }).then(retain).catch(report);
    retain(links.addEventListener("url", event => report({ url: event.url })));
    void links.getInitialURL().then(url => { if (!disposed && url) report({ initialURL: url }); }).catch(report);
    const confirmClose = () => documentRef.current.text === documentRef.current.saved || new Promise<boolean>(resolve => Alert.alert("Unsaved document", "Discard your changes?", [{ text: "Keep editing", style: "cancel", onPress: () => resolve(false) }, { text: "Discard", style: "destructive", onPress: () => resolve(true) }]));
    void app.beforeQuit(confirmClose).then(retain).catch(report);
    void windows.beforeWindowClose("main", confirmClose).then(retain).catch(report);
    void settings.get<number>("kitchen-count").then(value => { if (!disposed) setCount(value ?? 0); }).catch(report);
    return () => { disposed = true; clearMenus("kitchen-sink"); for (const remove of removers) void remove(); };
  }, [action, load, report, save]);
  useEffect(() => {
    if (!document.path) return;
    let disposed = false; let sub: Awaited<ReturnType<typeof files.watch>> | undefined;
    void files.watch(document.path, path => report(`File changed: ${path}`)).then(value => { sub = value; if (disposed) void value.remove(); }).catch(report);
    return () => { disposed = true; void sub?.remove(); };
  }, [document.path, report]);
  return <View style={{ flex: 1, backgroundColor: "#f4f5f8" }}>
    <View style={styles.header}><Text style={styles.title}>Desktop Kitchen Sink</Text><Text style={styles.text}>{runtime?.mode ?? "unknown"} · {projectId}</Text></View>
    <ScrollView contentContainerStyle={styles.content} testID="kitchen-sink">
      <Card title="App and windows"><View style={styles.row}>
        <Button title="Open second window" onPress={() => void action(() => windows.openWindow({ id: "demo", title: "Kitchen Sink · Second window", props: { message: "Same JavaScript bundle, separate native window." }, restoreFrame: true }))} />
        <Button title="List windows and displays" onPress={() => void action(async () => ({ windows: await windows.listWindows(), displays: await windows.getDisplays() }))} />
        <Button title="Quit (checks unsaved edits)" onPress={() => void action(app.quit)} />
      </View></Card>
      <Card title="Document, dialogs and filesystem"><Text style={styles.text}>{document.path || "Untitled"}{document.text !== document.saved ? " · Unsaved" : ""}</Text>
        <TextInput multiline accessibilityLabel="Document text" testID="document-text" style={styles.editor} value={document.text} onChangeText={text => setDocument(previous => ({ ...previous, text }))} />
        <View style={styles.row}><Button title="Open document" onPress={() => void action(load)} /><Button title="Save document" onPress={() => void action(save)} /><Button title="Reveal in Finder" disabled={!document.path} onPress={() => void action(() => revealInFinder(document.path))} /><Button title="App data directory" onPress={() => void action(() => files.getDirectory("data"))} /></View>
      </Card>
      <Card title="Settings"><Text style={styles.text}>Persistent counter: {count ?? "Loading…"}</Text><Button title="Increment and persist" disabled={count === null} onPress={() => void action(async () => { const value = await settings.update<number>("kitchen-count", count => (count ?? 0) + 1); setCount(value); return value; })} /></Card>
      <Card title="Menus, shortcuts and clipboard"><Text style={styles.text}>Use the Document menu or press ⌘⇧K. Right-click-like menus are native popups.</Text><View style={styles.row}>
        <Button title="Show context menu" onPress={event => void action(() => showContextMenu([{ id: "copy", title: "Copy greeting" }, { id: "checked", title: "Checked item", checked: true }, { id: "disabled", title: "Disabled item", enabled: false }], { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY }).then(async selected => { if (selected === "copy") await clipboard.setStringAsync("Hello desktop"); return selected ?? "Context menu cancelled"; }))} />
        <Button title="Copy greeting" onPress={() => void action(() => clipboard.setStringAsync("Hello desktop"))} /><Button title="Read clipboard" onPress={() => void action(() => clipboard.getStringAsync())} /><Button title="Has clipboard text" onPress={() => void action(clipboard.hasStringAsync)} /><Button title="Copy HTML" onPress={() => void action(() => clipboard.setStringAsync("<b>Hello desktop</b>", { inputFormat: clipboard.StringFormat.HTML }))} />
      </View></Card>
      <Card title="Links and documents"><View style={styles.row}><Button title="Open example.com" onPress={() => void action(() => links.openURL("https://example.com"))} /><Button title="Initial URL" onPress={() => void action(links.getInitialURL)} /><Button title="Can open HTTPS" onPress={() => void action(() => links.canOpenURL("https://example.com"))} /><Button title="Recent documents" onPress={() => void action(links.getRecentDocuments)} /></View><Text style={styles.text}>Incoming links and files appear in the event log. OS associations require a custom build.</Text></Card>
      <Card title="Secure storage"><TextInput accessibilityLabel="Demo secret" secureTextEntry style={styles.input} value={secret} onChangeText={setSecret} placeholder="Demo secret (stored in Keychain)" /><View style={styles.row}>
        <Button title="Store demo secret" onPress={() => void action(async () => { await secureStore.setItemAsync("kitchen-demo", secret); return "Stored demo secret"; })} /><Button title="Load demo secret" onPress={() => void action(async () => { setSecret(await secureStore.getItemAsync("kitchen-demo") ?? ""); return "Loaded demo secret"; })} /><Button title="Delete demo secret" onPress={() => void action(async () => { await secureStore.deleteItemAsync("kitchen-demo"); setSecret(""); return "Deleted demo secret"; })} /></View></Card>
      <Card title="Expo-aligned APIs"><APIChecks /></Card>
      <Card title="Desktop integrations"><Integrations report={report} />
        <Expansion report={report} /></Card>
      <Card title="Event log"><Button title="Clear log" onPress={() => setLog([])} />{log.map((line, index) => <Text key={`${index}-${line}`} selectable style={styles.log}>{line}</Text>)}</Card>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, backgroundColor: "#f4f5f8", gap: 16 }, header: { padding: 24, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#cbd0da" },
  content: { padding: 24, gap: 16 }, title: { fontSize: 28, fontWeight: "700", color: "#152238" }, heading: { fontSize: 18, fontWeight: "600", color: "#152238" }, text: { color: "#34435a" },
  card: { padding: 20, borderRadius: 12, backgroundColor: "white", gap: 12 }, row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  editor: { height: 150, borderWidth: 1, borderColor: "#cbd0da", padding: 12, color: "#152238", borderRadius: 6, fontSize: 15 }, input: { borderWidth: 1, borderColor: "#cbd0da", padding: 8, color: "#152238", borderRadius: 6 }, log: { color: "#34435a", fontFamily: "Menlo", fontSize: 12 },
});
