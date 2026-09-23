import { useState } from "react";
import { Platform, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "@legendapp/spark/ui";
import { Integration } from "./Integration";
import { sessionFor } from "./sessions";
import { useDocument } from "./useDocument";
export default function App({ windowId = "main", windowProps }: { windowId?: string; windowProps?: { documentId?: string } }) {
  const documentId = windowProps?.documentId ?? "main";
  const [session] = useState(() => sessionFor(documentId));
  const state = useDocument(session);
  const [guardsReady, setGuardsReady] = useState(Platform.OS !== "macos");
  const copy = ["ios", "android", "web"].includes(Platform.OS);
  return <SafeAreaView style={styles.root}>
    <View style={styles.header}>
      <Text style={styles.title}>{state.file.name}{session.dirty ? " •" : ""}</Text>
      <Text>{copy ? "Open imports a copy. Save exports your text." : state.file.location ?? "Choose a location when saving."}</Text>
      <View style={styles.toolbar}>
        <Button disabled={state.busy || !guardsReady} onPress={() => { void session.newDocument(); }}>New</Button>
        <Button disabled={state.busy || !guardsReady} onPress={() => { void session.open(); }}>Open</Button>
        <Button disabled={state.busy || !guardsReady} onPress={() => { void session.save(); }}>{copy ? "Save a copy" : "Save"}</Button>
        {!copy ? <Button disabled={state.busy || !guardsReady} onPress={() => { void session.save(true); }}>Save As</Button> : null}
      </View>
      <Integration session={session} windowId={windowId} documentId={documentId} onReady={setGuardsReady} />
      {state.error ? <Text accessibilityRole="alert" style={styles.error}>{state.error}</Text> : null}
    </View>
    <TextInput testID="document-body" accessibilityLabel="Document text" multiline editable={guardsReady} value={state.text} onChangeText={session.edit} textAlignVertical="top" style={styles.editor} autoCapitalize="none" autoCorrect={false} />
    <Text style={styles.status}>{state.busy ? "Working…" : session.dirty ? "Unsaved changes" : "Saved"} · {state.text.length} characters</Text>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#faf9f6" }, header: { padding: 20, gap: 10 }, title: { fontSize: 24, fontWeight: "600", color: "#222" },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, editor: { flex: 1, marginHorizontal: 20, padding: 16, borderWidth: 1, borderColor: "#bbb", borderRadius: 6, backgroundColor: "white", color: "#222", fontSize: 16 },
  error: { color: "#ad2020" }, status: { padding: 16, color: "#555" },
});
