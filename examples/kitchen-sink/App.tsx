import { Button } from "./Controls";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
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
import { NativeControls } from "./NativeControls";
import { ExpansionChecks } from "./ExpansionChecks";
import { Expansion } from "./Expansion";
import { Integrations } from "./Integrations";
import { ThemeToggle } from "./ThemeToggle";
import { testDriver } from "./test-driver";

type Props = Partial<app.AppContext> & { windowId?: string; windowProps?: { message?: string; readyFile?: string } };
function argument(args: string[], name: string) { const at = args.indexOf(name); return at < 0 ? undefined : args[at + 1]; }
export default function App(props: Props) {
  const args = props.launchArguments ?? [];
  const report = argument(args, "--legend-test-report");
  if (props.windowId && props.windowId !== "main") return <SecondaryWindow {...props} />;
  const uiReport = argument(args, "--legend-ui-report");
  if (uiReport) return <NativeControls report={uiReport} />;
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
  return <View style={styles.root} className="bg-background" testID="secondary-window">
    <Text style={styles.title} className="text-foreground">Secondary window</Text><Text className="text-muted">{props.windowProps?.message ?? props.windowId}</Text>
    <Button onPress={() => void windows.closeWindow(props.windowId).catch(console.error)}>Close this window</Button>
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
  return <ScrollView style={styles.root} className="bg-background" testID="automated-checks"><Text style={styles.title} className="text-foreground">Native SDK checks</Text>{checks.map(check => <Text key={check.name} className="text-muted">{check.passed ? "PASS" : "FAIL"} {check.name} {check.error}</Text>)}</ScrollView>;
}
function Card({ title, children }: React.PropsWithChildren<{ title: string }>) { return <View style={styles.card} className="bg-surface"><Text style={styles.heading} className="text-foreground">{title}</Text>{children}</View>; }
function KitchenSink({ runtime, projectId }: Props) {
  const [log, setLog] = useState<string[]>([]);
  const [document, setDocument] = useState({ path: "", saved: "", text: "Hello from a native desktop app.\n" });
  const contextMenuAnchor = useRef<View>(null);
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
  return <View style={{ flex: 1 }} className="bg-background">
    <View style={styles.header} className="border-border"><Text style={styles.title} className="text-foreground">Desktop Kitchen Sink</Text><Text className="text-muted">{runtime?.mode ?? "unknown"} · {projectId}</Text><ThemeToggle /></View>
    <ScrollView contentContainerStyle={styles.content} testID="kitchen-sink">
      <Card title="App and windows"><View style={styles.row}>
        <Button onPress={() => void action(() => windows.openWindow({ id: "demo", title: "Kitchen Sink · Second window", props: { message: "Same JavaScript bundle, separate native window." }, restoreFrame: true }))}>Open second window</Button>
        <Button onPress={() => void action(async () => ({ windows: await windows.listWindows(), displays: await windows.getDisplays() }))}>List windows and displays</Button>
        <Button onPress={() => void action(app.quit)}>Quit (checks unsaved edits)</Button>
      </View></Card>
      <Card title="Document, dialogs and filesystem"><Text className="text-muted">{document.path || "Untitled"}{document.text !== document.saved ? " · Unsaved" : ""}</Text>
        <TextInput multiline accessibilityLabel="Document text" testID="document-text" style={styles.editor} className="border-border bg-surface text-foreground" value={document.text} onChangeText={text => setDocument(previous => ({ ...previous, text }))} />
        <View style={styles.row}><Button onPress={() => void action(load)}>Open document</Button><Button onPress={() => void action(save)}>Save document</Button><Button disabled={!document.path} onPress={() => void action(() => revealInFinder(document.path))}>Reveal in Finder</Button><Button onPress={() => void action(() => files.getDirectory("data"))}>App data directory</Button></View>
      </Card>
      <Card title="Settings"><Text className="text-muted">Persistent counter: {count ?? "Loading…"}</Text><Button disabled={count === null} onPress={() => void action(async () => { const value = await settings.update<number>("kitchen-count", count => (count ?? 0) + 1); setCount(value); return value; })}>Increment and persist</Button></Card>
      <Card title="Menus, shortcuts and clipboard"><Text className="text-muted">Use the Document menu or press ⌘⇧K. Right-click-like menus are native popups.</Text><View style={styles.row}>
        <View ref={contextMenuAnchor} collapsable={false} className="max-w-full"><Button onPress={() => contextMenuAnchor.current?.measureInWindow((x, y, _width, height) => void action(() => showContextMenu([{ id: "copy", title: "Copy greeting" }, { id: "checked", title: "Checked item", checked: true }, { id: "disabled", title: "Disabled item", enabled: false }], { x, y: y + height }).then(async selected => { if (selected === "copy") await clipboard.setStringAsync("Hello desktop"); return selected ?? "Context menu cancelled"; })))}>Show context menu</Button></View>
        <Button onPress={() => void action(() => clipboard.setStringAsync("Hello desktop"))}>Copy greeting</Button><Button onPress={() => void action(() => clipboard.getStringAsync())}>Read clipboard</Button><Button onPress={() => void action(clipboard.hasStringAsync)}>Has clipboard text</Button><Button onPress={() => void action(() => clipboard.setStringAsync("<b>Hello desktop</b>", { inputFormat: clipboard.StringFormat.HTML }))}>Copy HTML</Button>
      </View></Card>
      <Card title="Links and documents"><View style={styles.row}><Button onPress={() => void action(() => links.openURL("https://example.com"))}>Open example.com</Button><Button onPress={() => void action(links.getInitialURL)}>Initial URL</Button><Button onPress={() => void action(() => links.canOpenURL("https://example.com"))}>Can open HTTPS</Button><Button onPress={() => void action(links.getRecentDocuments)}>Recent documents</Button></View><Text className="text-muted">Incoming links and files appear in the event log. OS associations require a custom build.</Text></Card>
      <Card title="Secure storage"><TextInput accessibilityLabel="Demo secret" secureTextEntry style={styles.input} className="border-border bg-surface text-foreground" placeholderTextColorClassName="accent-muted" value={secret} onChangeText={setSecret} placeholder="Demo secret (stored in Keychain)" /><View style={styles.row}>
        <Button onPress={() => void action(async () => { await secureStore.setItemAsync("kitchen-demo", secret); return "Stored demo secret"; })}>Store demo secret</Button><Button onPress={() => void action(async () => { setSecret(await secureStore.getItemAsync("kitchen-demo") ?? ""); return "Loaded demo secret"; })}>Load demo secret</Button><Button onPress={() => void action(async () => { await secureStore.deleteItemAsync("kitchen-demo"); setSecret(""); return "Deleted demo secret"; })}>Delete demo secret</Button></View></Card>
      <Card title="Native UI"><NativeControls /></Card>
      <Card title="Expo-aligned APIs"><APIChecks /></Card>
      <Card title="Desktop integrations"><Integrations report={report} />
        <Expansion report={report} /></Card>
      <Card title="Event log"><Button onPress={() => setLog([])}>Clear log</Button>{log.map((line, index) => <Text key={`${index}-${line}`} selectable style={styles.log} className="text-muted">{line}</Text>)}</Card>
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, padding: 24, gap: 16 }, header: { padding: 24, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  content: { padding: 24, gap: 16 }, title: { fontSize: 28, fontWeight: "700" }, heading: { fontSize: 18, fontWeight: "600" },
  card: { padding: 20, borderRadius: 12, gap: 12 }, row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  editor: { height: 150, borderWidth: 1, padding: 12, borderRadius: 6, fontSize: 15 }, input: { borderWidth: 1, padding: 8, borderRadius: 6 }, log: { fontFamily: "Menlo", fontSize: 12 },
});
