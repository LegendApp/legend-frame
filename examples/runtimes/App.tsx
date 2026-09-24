import React, { useEffect, useRef, useState } from "react";
import { Button, DevSettings, ScrollView, Text, View } from "react-native";
import { ThreadedRuntime } from "@react-native-runtimes/core";
import { getDirectory, writeText, remove, exists } from "@legendapp/spark/files";
import { identify, heavy, echo, fail, readNativeFile } from "./tasks";
import KitchenSink from "./KitchenSink";

type Result = { name: string; passed: boolean; detail?: unknown; error?: string };
const worker = "spark-background-proof";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function Heartbeat() {
  const [ticks, setTicks] = useState(0);
  useEffect(() => { const timer = setInterval(() => setTicks(n => n + 1), 100); return () => clearInterval(timer); }, []);
  return <Text style={{ color: "#152238", fontSize: 20 }}>Main React heartbeat: {ticks}</Text>;
}
export default function App(props: { launchArguments?: string[] }) {
  const [results, setResults] = useState<Result[]>([]), [running, setRunning] = useState(false), [kitchen, setKitchen] = useState(false);
  const started = useRef(false);
  const args = props.launchArguments ?? [];
  const reportIndex = args.indexOf("--spark-runtimes-report");
  const reportPath = reportIndex >= 0 ? args[reportIndex + 1] : undefined;
  async function run() {
    if (started.current) return;
    started.current = true; setRunning(true); setResults([]);
    const output: Result[] = [];
    let reloading = false;
    const check = async (name: string, action: () => Promise<unknown>) => {
      try { output.push({ name, passed: true, detail: await action() }); }
      catch (error) { output.push({ name, passed: false, error: String(error) }); }
      setResults([...output]);
    };
    try {
      if (reportPath && args.includes("--spark-runtimes-reload")) {
        const marker = `${reportPath}.before-reload`;
        if (!(await exists(marker))) {
          await ThreadedRuntime.run("reload-survivor", identify);
          await writeText(marker, "worker started");
          reloading = true;
          DevSettings.reload();
          return;
        }
        await check("Main app reload destroys existing workers", async () => {
          const names = await ThreadedRuntime.getRuntimeNames();
          assert(!names.includes("reload-survivor"), `Old worker survived reload: ${names}`);
          return names;
        });
      }
      await check("Secondary Hermes runtime identity and isolated heap", async () => {
        const mainBefore = identify();
        const first = await ThreadedRuntime.run(worker, identify);
        const second = await ThreadedRuntime.run(worker, identify);
        const main = identify();
        assert(!first.isMain && first.name === worker, `Executed on wrong runtime: ${JSON.stringify(first)}`);
        assert(first.calls === 1 && second.calls === 2 && main.calls === mainBefore.calls + 1, "Heap state was shared or runtime wasn't reused");
        return { first, second, main };
      });
      await check("CPU-heavy imported JS leaves main JS responsive", async () => {
        let ticks = 0, last = Date.now(), maxGap = 0;
        const timer = setInterval(() => { const now = Date.now(); maxGap = Math.max(maxGap, now - last); last = now; ticks++; }, 25);
        let result;
        try { result = await ThreadedRuntime.run(worker, heavy, 2000); }
        finally { clearInterval(timer); }
        assert(result.name === worker && !result.isMain && result.iterations > 0, "Work didn't execute in worker");
        assert(ticks >= 20 && maxGap < 500, `Main JS stalled: ${ticks} ticks, ${maxGap}ms max gap`);
        return { ...result, mainThreadTicks: ticks, maxMainThreadGapMs: maxGap };
      });
      await check("Async timers and structured results", async () => {
        const value = { message: "Hello from macOS", count: 42 };
        const result = await ThreadedRuntime.run(worker, echo, value);
        assert(result.name === worker && JSON.stringify(result.value) === JSON.stringify(value), "Result mismatch");
        return result;
      });
      await check("Thrown worker errors reject the caller", async () => {
        let message = "";
        try { await ThreadedRuntime.run(worker, fail); } catch (error) { message = String(error); }
        assert(message.includes("Intentional worker error"), `Error not forwarded: ${message}`);
        return message;
      });
      await check("Worker can call a native filesystem module", async () => {
        const file = `${await getDirectory("temp")}/runtimes-proof.txt`;
        await writeText(file, "native file IO from secondary Hermes");
        try { const text = await ThreadedRuntime.run(worker, readNativeFile, file); assert(text === "native file IO from secondary Hermes", "Native module returned wrong data"); return text; }
        finally { await remove(file); }
      });
      await check("Destroy unregisters runtime; recreation starts with fresh state", async () => {
        await ThreadedRuntime.destroy(worker);
        assert(!(await ThreadedRuntime.getRuntimeNames()).includes(worker), "Destroyed runtime remains registered");
        const result = await ThreadedRuntime.run(worker, identify);
        assert(!result.isMain && result.calls === 1, `Runtime heap wasn't reset: ${JSON.stringify(result)}`);
        return result;
      });
    } finally {
      if (reloading) return;
      await ThreadedRuntime.destroy(worker);
      if (reportPath) await writeText(reportPath, JSON.stringify({ passed: output.every(r => r.passed), results: output }, null, 2));
      started.current = false; setRunning(false);
    }
  }
  useEffect(() => { if (reportPath) void run(); }, [reportPath]);
  if (kitchen) return <KitchenSink {...props} />;
  return <ScrollView style={{ flex: 1, backgroundColor: "#f3f5fa" }} contentContainerStyle={{ padding: 28, gap: 18 }}>
    <Text style={{ fontSize: 28, color: "#152238", fontWeight: "700" }}>Margelo Runtimes · macOS proof</Text>
    <Text style={{ color: "#152238" }}>A second Hermes runtime runs CPU-heavy JavaScript while this React counter keeps updating.</Text>
    <Heartbeat />
    <Button title={running ? "Running native checks…" : "Run background execution checks"} disabled={running} onPress={() => void run()} />
    <Button title="Open desktop kitchen sink" disabled={running} onPress={() => setKitchen(true)} />
    {results.map(result => <View key={result.name} style={{ padding: 14, backgroundColor: "white", borderRadius: 8, gap: 6 }}>
      <Text style={{ color: result.passed ? "#16703b" : "#a51e2c", fontWeight: "600" }}>{result.passed ? "PASS" : "FAIL"} · {result.name}</Text>
      <Text selectable style={{ color: "#152238" }}>{result.error ?? JSON.stringify(result.detail)}</Text>
    </View>)}
  </ScrollView>;
}
