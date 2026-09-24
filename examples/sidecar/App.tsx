import { useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { Button } from "@legendapp/spark-ui";
import { getHelper, stopHelper } from "./service";
/** Root of a standalone example app. Owns the service for its lifetime. */
export default function App() {
  const [input, setInput] = useState("00 01 7f 80 ff"), [status, setStatus] = useState("Stopped"), [busy, setBusy] = useState(false);
  useEffect(() => () => { void stopHelper().catch(console.error); }, []);
  async function action(run: () => Promise<string>) { setBusy(true); try { setStatus(await run()); } catch (error) { setStatus(String(error)); } finally { setBusy(false); } }
  function bytes() { const hex = input.replace(/\s/g, ""); if (!/^(?:[0-9a-fA-F]{2})*$/.test(hex)) throw Error("Enter pairs of hexadecimal digits"); return Uint8Array.from(hex.match(/../g) ?? [], value => parseInt(value, 16)); }
  return <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
    <Text style={{ fontSize: 24 }}>App-owned helper</Text><Text>The worker is a native executable. Requests use bounded, versioned messages over stdin/stdout.</Text>
    <TextInput accessibilityLabel="Hex bytes" value={input} onChangeText={setInput} style={{ borderWidth: 1, padding: 12 }} />
    <View style={{ gap: 8 }}>
      <Button disabled={busy} onPress={() => void action(async () => { await getHelper(); return "Ready (protocol 1)"; })}>Start and await readiness</Button>
      <Button disabled={busy} onPress={() => void action(async () => { const result = await (await getHelper()).request("echo", bytes()); return `Echo: ${Array.from(result, byte => byte.toString(16).padStart(2, "0")).join(" ")}`; })}>Echo binary data</Button>
      <Button disabled={busy} onPress={() => void action(async () => { const result = await (await getHelper()).request("hash", bytes()); return `FNV-1a: ${Array.from(result, byte => byte.toString(16).padStart(2, "0")).join("")}`; })}>Compute checksum</Button>
      <Button disabled={busy} onPress={() => void action(async () => { await (await getHelper()).request("crash"); return "Unexpected success"; })}>Simulate helper crash</Button>
      <Button disabled={busy} onPress={() => void action(async () => { await (await getHelper()).request("hang"); return "Unexpected success"; })}>Simulate request timeout</Button>
      <Button disabled={busy} onPress={() => void action(async () => { await stopHelper(); await getHelper(); return "Restarted and ready"; })}>Restart explicitly</Button>
      <Button disabled={busy} onPress={() => void action(async () => { await stopHelper(); return "Stopped"; })}>Stop helper</Button>
    </View><Text accessibilityLiveRegion="polite" selectable>{status}</Text>
  </ScrollView>;
}
