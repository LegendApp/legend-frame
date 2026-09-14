import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, TextInput, Select } from "@legend-apps/ui";
import * as Clipboard from "@legend-apps/clipboard";
import * as SecureStore from "@legend-apps/secure-storage";
import * as Linking from "@legend-apps/desktop-links";

const themes = [{ label: "System", value: "system" }, { label: "Light", value: "light" }, { label: "Dark", value: "dark" }];

export default function Settings() {
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("system");
  const [status, setStatus] = useState("Preferences are held in memory for this demo.");
  const [busy, setBusy] = useState(false);
  async function action(work: () => Promise<string>) {
    setBusy(true);
    try { setStatus(await work()); } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  return <ScrollView contentInsetAdjustmentBehavior="always" contentContainerStyle={styles.page}>
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.title}>Settings</Text>
      <Text style={styles.description}>One screen shared across mobile, web, and desktop.</Text>
      <Text style={styles.label}>Display name</Text>
      <TextInput accessibilityLabel="Display name" defaultValue="" onChangeText={setName} style={styles.field} testID="settings-name" />
      <Text style={styles.label}>Appearance preference</Text>
      <Select accessibilityLabel="Appearance preference" options={themes} value={theme} onValueChange={setTheme} style={styles.field} testID="settings-theme" />
      <Text style={styles.description}>Hello {name || "there"}. Preferred appearance: {theme}.</Text>
      <View style={styles.actions}>
        <Button style={styles.button} disabled={busy} onPress={() => void action(async () => {
          if (!await Clipboard.setStringAsync(JSON.stringify({ name, theme }))) throw new Error("The browser did not permit clipboard access.");
          return "Copied preferences.";
        })}>Copy preferences</Button>
        <Button style={styles.button} disabled={busy} onPress={() => void action(async () => {
          if (!await SecureStore.isAvailableAsync()) return "Secure storage is unavailable on this platform.";
          const key = `settings-demo-${Date.now()}`;
          // A disposable synthetic value; no real credentials are entered or displayed.
          try {
            await SecureStore.setItemAsync(key, "demo");
            if (await SecureStore.getItemAsync(key) !== "demo") throw new Error("Secure storage check failed.");
            return "Secure storage verified; demo value removed.";
          } finally { await SecureStore.deleteItemAsync(key); }
        })}>Check secure storage</Button>
        <Button style={styles.button} disabled={busy} onPress={() => void action(async () => {
          await Linking.openURL("https://legendapp.com"); return "Opened Legend.";
        })}>Open Legend</Button>
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.status} testID="settings-status">{status}</Text>
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  page: { flexGrow: 1, padding: 24, backgroundColor: "#f2f4f8", alignItems: "center" },
  panel: { width: "100%", maxWidth: 680, padding: 24, gap: 12, backgroundColor: "white", borderRadius: 12 },
  title: { fontSize: 28, fontWeight: "600", color: "#182235" },
  label: { marginTop: 8, fontSize: 15, fontWeight: "600", color: "#26344d" },
  description: { color: "#44536c", fontSize: 15 },
  field: { width: "100%" }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  button: { width: 210 },
  status: { color: "#26344d", fontSize: 14, marginTop: 12 },
});
