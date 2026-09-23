import { spawnProcess, processLog } from "../packages/cli/src/process.ts";
import { setTimeout as sleep } from "node:timers/promises";
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { analyze, build } from "../packages/cli/src/build.ts";
import { readJson, writeJson } from "../packages/cli/src/project.ts";
import { run } from "../packages/cli/src/commands.ts";
// Run after test:runtimes --release. The managed fixture deliberately retains
// tasks.ts and every SDK dependency while its entry stops importing those tasks.
const root = path.resolve(process.argv[2] ?? "/tmp/SparkRuntimesProbe");
if (!existsSync(path.join(root, ".spark/kitchen-sink.json"))) throw new Error("Use the managed runtimes test fixture.");
const full = readJson(path.join(root, ".spark/release-build.json"));
for (const name of ["@react-native-runtimes/core", "react-native-nitro-modules"]) {
  if (!full.runtime.modules[name]) throw new Error("First run the Runtimes-enabled Release proof.");
}
const proof = path.join(root, ".spark/runtimes-proof");
cpSync(full.app, path.join(proof, "with-runtimes.app"), { recursive: true, verbatimSymlinks: true });
const appFile = path.join(root, "App.tsx"), original = readFileSync(appFile);
const workerFile = path.join(root, "pruning-worker.ts");
if (existsSync(workerFile)) throw new Error("Unexpected existing pruning-worker.ts");
try {
  writeFileSync(workerFile, 'import { runtimeFunction } from "@react-native-runtimes/core"; export const workerOnly = runtimeFunction(async () => { const { readText } = require("@legendapp/spark/files"); return readText("/tmp/worker-only.txt"); });\n');
  writeFileSync(appFile, 'import React from "react"; import { Text } from "react-native"; import { ThreadedRuntime } from "@react-native-runtimes/core"; import { workerOnly } from "./pruning-worker"; export default function App() { return <Text onPress={() => ThreadedRuntime.run("pruning", workerOnly)}>Worker</Text>; }\n');
  const used = await analyze(root);
  for (const name of ["@react-native-runtimes/core", "react-native-nitro-modules", "@legendapp/spark-file-system"]) {
    if (!used.included.some(pkg => pkg.name === name)) throw new Error(`${name} was pruned despite worker reachability`);
  }
  writeFileSync(appFile, 'import React from "react"; import { Text } from "react-native"; export default function App() { return <Text>Production without workers</Text>; }\n');
  const built = await build(root, "release");
  const report = readJson(path.join(root, ".spark/selection-report.json"));
  const forbidden = ["@react-native-runtimes/core", "react-native-nitro-modules"];
  for (const name of forbidden) {
    if (built.runtime.modules[name] || !report.excluded.includes(name)) throw new Error(`${name} survived native pruning`);
  }
  if (report.sources.some((source: string) => /react-native-runtimes|react-native-nitro-modules|\/tasks.ts$/.test(source))) throw new Error("Unused runtime JS survived graph selection");
  const executable = (await run(root, ["/usr/libexec/PlistBuddy", "-c", "Print CFBundleExecutable", path.join(built.app, "Contents/Info.plist")], { capture: true })).trim();
  const binary = path.join(built.app, "Contents/MacOS", executable);
  const symbols = await run(root, ["nm", binary], { capture: true });
  if (/OBJC_CLASS_\$_ThreadedRuntime|OBJC_CLASS_\$_NitroModules|HybridThreadedRuntimeFunctions/.test(symbols)) throw new Error("Runtime native code survived linking");
  const log = processLog(path.join(proof, "pruned-launch.log"));
  const child = spawnProcess([binary], { cwd: root, stdout: log, stderr: log });
  try {
    await sleep(5000);
    if (child.exitCode !== null || child.signalCode !== null) throw new Error("Pruned Release app exited during startup");
    const output = readFileSync(log.file, "utf8");
    if (/Unhandled JS Exception|RCTFatal|Terminating app due to uncaught exception/.test(output)) throw new Error("Pruned app failed to start its JS");
  } finally { child.kill(); await child.exited; }
  const outcome = { passed: true, workerOnlyNativeDependencyRetained: true, excluded: forbidden, linkedSymbolsAbsent: true, standaloneLaunch: true, app: built.app };
  writeJson(path.join(proof, "pruned.json"), outcome);
  console.log(JSON.stringify(outcome, null, 2));
} finally {
  writeFileSync(appFile, original);
  rmSync(workerFile, { force: true });
  // Do not let an interactive Metro session use a stale production registry.
  rmSync(path.join(root, ".threaded-runtime/entry.js"), { force: true });
}
