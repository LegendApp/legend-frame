import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { writeText } from "@legendapp/frame/files";
import { Button } from "@legendapp/frame/ui";
import { runFileStreamChecks } from "./file-stream-checks";
export function FileStreamChecks({ report }: { report?: string }) {
  const [result, setResult] = useState("Ready to test streaming I/O and recycle one disposable test file.");
  const [running, setRunning] = useState(false);
  const run = useCallback(async () => {
    setRunning(true);
    const results: { name: string; passed: boolean; error?: string }[] = [];
    try {
      await runFileStreamChecks(async (name, action) => { try { await action(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: String(error) }); } });
      const value = { passed: results.every(item => item.passed), results };
      setResult(JSON.stringify(value, null, 2)); if (report) await writeText(report, JSON.stringify(value, null, 2));
    } catch (error) { setResult(String(error)); } finally { setRunning(false); }
  }, [report]);
  useEffect(() => { if (report) { const timer = setTimeout(() => void run(), 500); return () => clearTimeout(timer); } }, [report, run]);
  return <View style={{ padding: 16, gap: 12 }}><Button disabled={running} onPress={() => void run()}>Test streaming files and Trash</Button><Text className="text-foreground" selectable>{result}</Text></View>;
}
