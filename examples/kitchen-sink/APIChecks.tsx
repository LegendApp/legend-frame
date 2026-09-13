import React, { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { writeText } from "@legend-apps/desktop/files";
import { quit } from "@legend-apps/desktop/app";
import { runAPIChecks } from "./api-checks";
import { testDriver } from "./test-driver";
import type { Check } from "./checks";

async function execute(onResult: (check: Check) => void, expectedInitial?: string | null) {
  const results: Check[] = [];
  await runAPIChecks(async (name, action) => {
    const start = Date.now(); let error: string | undefined;
    try { await action(); } catch (cause) { error = String(cause); }
    const result = { name, passed: error === undefined, error, duration: Date.now() - start };
    results.push(result); onResult(result);
  }, testDriver, expectedInitial);
  return { passed: results.every(check => check.passed), results, nativeDriver: !!testDriver };
}
export function APIChecks({ report, expectedInitial }: { report?: string; expectedInitial?: string | null }) {
  const [results, setResults] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!report) return;
    // A cancelled development mount must not start native mutations.
    const timer = setTimeout(() => {
      void execute(result => setResults(previous => [...previous, result]), expectedInitial)
        .then(outcome => writeText(report, JSON.stringify(outcome, null, 2)))
        .catch(error => writeText(report, JSON.stringify({ passed: false, error: String(error) })))
        .then(() => quit()).catch(console.error);
    }, 500);
    return () => clearTimeout(timer);
  }, [report, expectedInitial]);
  async function run() {
    setRunning(true); setResults([]);
    try { await execute(result => setResults(previous => [...previous, result])); }
    finally { setRunning(false); }
  }
  return <View style={{ gap: 8 }} testID="expo-api-checks">
    {!report && <Button title={running ? "Checking APIs…" : "Run Expo API checks"} disabled={running} onPress={() => void run().catch(console.error)} />}
    {!testDriver && <Text style={styles.note}>Clipboard mutation and injected URL checks run in the dedicated native test build.</Text>}
    {results.map(result => <Text key={result.name} style={result.passed ? styles.passed : styles.failed}>{result.passed ? "PASS" : "FAIL"} {result.name}{result.error ? `: ${result.error}` : ""}</Text>)}
  </View>;
}

const styles = StyleSheet.create({
  note: { color: "#34435a", fontSize: 13 },
  passed: { color: "#17633b", fontSize: 14 },
  failed: { color: "#aa2430", fontSize: 14 },
});
