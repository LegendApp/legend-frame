import React, { useState } from "react";
import { Button, StyleSheet, Text, TurboModuleRegistry, View } from "react-native";
import type { TurboModule } from "react-native";
interface Host extends TurboModule { describe(): string; }
const host = TurboModuleRegistry.getEnforcing<Host>("NativeLegendRuntime");
const runtime = JSON.parse(host.describe());
export default function App() {
  const [clicks, setClicks] = useState(0);
  return <View style={styles.root}>
    <Text style={styles.title}>Hello, Legend on Windows</Text>
    <Text>Runtime: {runtime.mode}</Text>
    <Button title={`Clicked ${clicks} times`} onPress={() => setClicks(value => value + 1)} />
    <Text>Edit App.tsx to test Fast Refresh.</Text>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16, padding: 24 }, title: { fontSize: 28, fontWeight: "600" } });
