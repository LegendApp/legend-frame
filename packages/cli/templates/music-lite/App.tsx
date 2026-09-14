import { Activation } from "./Activation";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Platform, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { Button } from "@legend-apps/ui";
import { Lifecycle } from "./shared/Lifecycle";
import { useModel } from "./shared/useModel";
import { mountSerial } from "./shared/lifetime";
import { music, dirty } from "./store";
import { importTracks } from "./assets";
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export default function App({ windowId = "main" }: { windowId?: string }) {
  const state = useModel(music);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const commands = useMemo(() => [{ id: "import", title: "Import tracks…", key: "O", run: () => {
    setImporting(true); void importTracks().then(music.add).catch(error => setError(String(error))).finally(() => setImporting(false));
  } }], []);
  useEffect(() => mountSerial("music-player", async retain => {
    await music.load();
    const timer = setInterval(() => { void music.tick(); }, 500);
    await retain(Promise.resolve({ remove: async () => { clearInterval(timer); await music.dispose(); } }));
  }, setError), []);
  const current = state.tracks.find(track => track.id === state.currentId);
  return <SafeAreaView style={styles.root}>
    <Activation windowId={windowId} onError={setError} />
    <Lifecycle title="Music" windowId={windowId} flush={music.flush} dirty={dirty} commands={commands} onError={setError} />
    <Text style={styles.title}>Music</Text>
    <Text>{["macos", "windows"].includes(Platform.OS) ? "Tracks stay in their original location. Keep those files available." : "Imported audio is stored on this device."}</Text>
    <View style={styles.toolbar}><Button disabled={!state.ready || importing} onPress={commands[0]!.run}>{importing ? "Importing…" : "Import tracks"}</Button></View>
    {error || state.error ? <Text accessibilityRole="alert" style={styles.error}>{error ?? state.error}</Text> : null}
    <FlatList data={state.tracks} keyExtractor={track => track.id} extraData={[state.currentId, state.busy]} renderItem={({ item }) => <View style={[styles.track, item.id === state.currentId && styles.current]}><Text style={styles.name} numberOfLines={2}>{item.name}</Text><Button disabled={state.busy} onPress={() => { void music.play(item.id); }}>Play track</Button></View>} ListEmptyComponent={<Text style={styles.empty}>Import a few audio files to start your queue.</Text>} />
    <View style={styles.player}><Text style={styles.now}>{current?.name ?? "Nothing playing"}</Text><Text accessibilityLiveRegion="none">{time(state.position)} / {time(state.status.duration)}</Text>
      <View style={styles.toolbar}><Button disabled={state.busy || !state.tracks.length} onPress={() => { void (state.status.playing ? music.pause() : music.play()); }}>{state.status.playing ? "Pause" : "Play"}</Button><Button disabled={state.busy || !current || state.status.duration <= 0} onPress={() => { void music.seek(state.status.currentTime - 10); }}>Back 10 seconds</Button><Button disabled={state.busy || !current || state.status.duration <= 0} onPress={() => { void music.seek(Math.min(state.status.duration, state.status.currentTime + 10)); }}>Forward 10 seconds</Button><Button disabled={state.busy || !current || state.status.duration <= 0} onPress={() => { void music.next(); }}>Next track</Button></View>
      <Text>{state.dirty ? "Saving playback position…" : "Queue and position saved"}</Text>
    </View>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 20, gap: 12, backgroundColor: "#faf9f6" }, title: { fontSize: 28, fontWeight: "600", color: "#222" }, toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, track: { flexDirection: "row", alignItems: "center", padding: 12, gap: 12, borderBottomWidth: 1, borderColor: "#ddd" }, name: { flex: 1, fontSize: 16, color: "#222" }, current: { backgroundColor: "#dce9ef" }, player: { padding: 16, gap: 12, backgroundColor: "white", borderRadius: 8 }, now: { fontSize: 18, fontWeight: "600", color: "#222" }, empty: { padding: 24, color: "#555" }, error: { color: "#a32020" } });
