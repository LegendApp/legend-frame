import { Activation } from "./Activation";
import { memo, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Button } from "@legend-apps/ui";
import { io } from "./shared/io";
import { Lifecycle } from "./shared/Lifecycle";
import { useModel } from "./shared/useModel";
import { notes, dirty } from "./store";
import { title, type Note } from "./model";
import { Secondary } from "./Secondary";
const Row = memo(function Row({ note, selected }: { note: Note; selected: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => notes.select(note.id)} style={[styles.row, selected && styles.selected]}>
    <Text numberOfLines={1} style={styles.noteTitle}>{title(note)}</Text>
    <Text numberOfLines={1}>{note.text.split("\n").slice(1).join(" ") || "Empty note"}</Text>
  </Pressable>;
});
export default function App({ windowId = "main", windowProps }: { windowId?: string; windowProps?: { noteId?: string } }) {
  const state = useModel(notes);
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [trash, setTrash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = state.notes.find(note => note.id === (windowProps?.noteId ?? state.selectedId) && !note.deleted);
  const visible = useMemo(() => state.notes.filter(note => note.deleted === trash && note.text.toLowerCase().includes(query.toLowerCase())), [state.notes, query, trash]);
  const commands = useMemo(() => [
    { id: "new", title: "New note", key: "N", run: () => { setTrash(false); setQuery(""); notes.create(); } },
    { id: "save", title: "Save notes", key: "S", run: () => { void notes.flush(); } },
    { id: "open", title: "Import text…", key: "O", run: () => { void io.open().then(file => { if (file) notes.create(file.text); }).catch(error => setError(String(error))); } },
  ], []);
  useEffect(() => { void notes.load(); }, []);
  const sidebar = !windowProps?.noteId && (width >= 720 || !selected);
  return <SafeAreaView style={styles.root}>
    <Activation windowId={windowId} onError={setError} />
    <Lifecycle title={selected ? `${title(selected)} — Notes` : "Notes"} windowId={windowId} flush={notes.flush} dirty={dirty} commands={commands} onError={setError} />
    <View style={styles.header}><Text style={styles.heading}>Notes</Text><Text accessibilityLiveRegion="polite">{state.saving ? "Saving…" : state.dirty ? "Changes pending" : state.ready ? "Saved on this device" : "Opening notes…"}</Text></View>
    {state.recovered ? <Text style={styles.notice}>Recovered the previous saved snapshot after an incomplete or unreadable write.</Text> : null}
    {error || state.error ? <View style={styles.notice}><Text accessibilityRole="alert">{error ?? state.error}</Text><Button onPress={() => { void notes.flush(); }}>Retry save</Button></View> : null}
    <View style={styles.body}>
      {sidebar ? <View style={[styles.sidebar, width < 720 && { width: "100%" }]}>
        <TextInput accessibilityLabel="Search notes" placeholder="Search notes" value={query} onChangeText={setQuery} style={styles.search} />
        <View style={styles.toolbar}><Button disabled={!state.ready} onPress={commands[0]!.run}>New note</Button><Button disabled={!state.ready} onPress={commands[2]!.run}>Import text</Button><Button onPress={() => setTrash(value => !value)}>{trash ? "Show notes" : "Recently deleted"}</Button></View>
        <FlatList data={visible} keyExtractor={note => note.id} extraData={state.selectedId} renderItem={({ item }) => trash ? <View style={styles.row}><Text>{title(item)}</Text><Button onPress={() => notes.setDeleted(item.id, false)}>Restore</Button></View> : <Row note={item} selected={item.id === state.selectedId} />} ListEmptyComponent={<Text style={styles.notice}>{query ? "No matching notes" : trash ? "No deleted notes" : "Create your first note"}</Text>} />
      </View> : null}
      {(!sidebar || width >= 720) ? selected ? <View style={styles.editorPane}>
        <View style={styles.toolbar}>
          {width < 720 && !windowProps?.noteId ? <Button onPress={() => notes.select(null)}>Back to notes</Button> : null}
          <Button onPress={() => { void io.save({ name: `${title(selected).replace(/[^a-zA-Z0-9 _-]/g, "_")}.md` }, selected.text, "", true).catch(error => setError(String(error))); }}>Export text</Button>
          <Button onPress={() => notes.setDeleted(selected.id, true)}>Delete note</Button>
          <Secondary noteId={selected.id} onError={setError} />
        </View>
        <TextInput key={selected.id} accessibilityLabel="Note text" testID="note-text" multiline value={selected.text} onChangeText={text => notes.edit(selected.id, text)} textAlignVertical="top" style={styles.editor} autoFocus />
      </View> : <View style={styles.editorPane}><Text>Select a note to begin.</Text></View> : null}
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#faf9f6" }, header: { padding: 20, gap: 6 }, heading: { fontSize: 28, fontWeight: "600", color: "#222" },
  body: { flex: 1, flexDirection: "row" }, sidebar: { width: 320, borderRightWidth: 1, borderColor: "#d8d5cf" },
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12 }, search: { padding: 12, margin: 12, backgroundColor: "white", borderWidth: 1, borderColor: "#bbb", borderRadius: 6, color: "#222" },
  row: { padding: 16, gap: 6, borderBottomWidth: 1, borderColor: "#e4e1dc" }, selected: { backgroundColor: "#dce9ef" }, noteTitle: { fontSize: 16, fontWeight: "600", color: "#222" },
  editorPane: { flex: 1, padding: 12 }, editor: { flex: 1, minHeight: 180, padding: 16, fontSize: 17, color: "#222", backgroundColor: "white", borderWidth: 1, borderColor: "#ddd", borderRadius: 6 }, notice: { padding: 12, color: "#854c00" },
});
