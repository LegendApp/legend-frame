import { useMemo, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Button } from "@legendapp/spark/ui";
import { io } from "./shared/io";
import { Lifecycle } from "./shared/Lifecycle";
import { compare } from "./compare";
import { Git } from "./Git";
const clean = () => false, flush = async () => true;
export default function App({ windowId = "main" }: { windowId?: string }) {
  const [left, setLeft] = useState({ name: "Original", text: "A shared application\nNative platform behavior\n" });
  const [right, setRight] = useState({ name: "Changed", text: "A shared application\nNative platform behavior\nOne codebase\n" });
  const [error, setError] = useState<string | null>(null);
  const [patch, setPatch] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const commands = useMemo(() => [{ id: "open", title: "Open original…", key: "O", run: () => open("left") }], []);
  async function open(side: "left" | "right") {
    setBusy(true); setError(null);
    try { const file = await io.open(); if (file) { if (file.text.length > 200_000) throw new Error("Choose a file smaller than 200,000 characters."); (side === "left" ? setLeft : setRight)({ name: file.file.name, text: file.text }); setPatch(null); } }
    catch (error) { setError(String(error)); } finally { setBusy(false); }
  }
  const comparison = useMemo(() => { try { return { rows: compare(left.text, right.text), error: null }; } catch (error) { return { rows: [], error: String(error) }; } }, [left.text, right.text]);
  const patchLines = useMemo(() => patch?.split("\n"), [patch]);
  return <SafeAreaView style={styles.root}>
    <Lifecycle title="Diff" windowId={windowId} flush={flush} dirty={clean} commands={commands} onError={setError} />
    <Text style={styles.title}>Diff</Text><Text>{left.name} → {right.name}</Text>
    <View style={styles.toolbar}><Button disabled={busy} onPress={() => { void open("left"); }}>Open original</Button><Button disabled={busy} onPress={() => { void open("right"); }}>Open changed</Button><Button onPress={() => { setLeft(right); setRight(left); setPatch(null); }}>Swap files</Button><Git onResult={setPatch} onError={setError} /></View>
    <Text>− Removed · + Added · unchanged lines have no marker</Text>
    {error || comparison.error ? <Text accessibilityRole="alert" style={styles.error}>{error ?? comparison.error}</Text> : null}
    {patchLines ? <FlatList data={patchLines} keyExtractor={(_, index) => String(index)} renderItem={({ item }) => <Text selectable style={styles.code}>{item || " "}</Text>} /> : <FlatList data={comparison.rows} keyExtractor={(_, index) => String(index)} renderItem={({ item }) => <View style={[styles.line, item.kind === "added" && styles.added, item.kind === "removed" && styles.removed]}>
      <Text style={styles.number}>{item.left ?? ""}</Text><Text style={styles.number}>{item.right ?? ""}</Text><Text selectable style={styles.code}>{item.kind === "added" ? "+ " : item.kind === "removed" ? "− " : "  "}{item.text || " "}</Text>
    </View>} />}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 20, gap: 12, backgroundColor: "#faf9f6" }, title: { fontSize: 28, fontWeight: "600", color: "#222" }, toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, line: { flexDirection: "row", paddingVertical: 3 }, number: { width: 36, color: "#555", textAlign: "right", paddingRight: 8, fontSize: 12 }, code: { flex: 1, flexShrink: 1, fontFamily: "monospace", fontSize: 13, color: "#222" }, added: { backgroundColor: "#ddf4df" }, removed: { backgroundColor: "#f9dddd" }, error: { color: "#a32020" } });
