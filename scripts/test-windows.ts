import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { create } from "../packages/cli/src/create.ts";
import { packageManifest } from "../packages/cli/src/local.ts";
import { nativePackages, runtimeFor, incompatible, stateFile, writeJson, readJson, digest } from "../packages/cli/src/project.ts";
import { nodeCommand, prepareWindows } from "../packages/cli/src/windows.ts";
import { run } from "../packages/cli/src/commands.ts";

const { values } = parseArgs({ args: process.argv.slice(2), options: { project: { type: "string" }, "prepare-only": { type: "boolean" } } });
const root = path.resolve(values.project ?? ".legend/windows-probe");
const prepareOnly = !!values["prepare-only"];
if (!prepareOnly && (process.platform !== "win32" || process.arch !== "x64")) throw new Error("Run the native verifier on Windows x64, or pass --prepare-only to check generation and bundles here.");
if (existsSync(path.join(root, "package.json"))) throw new Error("Choose a fresh --project directory; this test installs a native fixture.");
const manifest = packageManifest();
const report: any = { host: process.platform, native: !prepareOnly, passed: false, stages: [] };
let session: Bun.Subprocess<"pipe", "pipe", "pipe"> | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
let originalApp: string | undefined;
let proof: any;
const token = crypto.randomUUID();
async function wait(check: () => boolean | Promise<boolean>, message: string, timeout = 120000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (session && session.exitCode !== null) throw new Error("legend dev exited; inspect .legend/logs/windows-session.log");
    if (await check()) return;
    await Bun.sleep(250);
  }
  throw new Error(message);
}
function stage(name: string) { report.currentStage = name; writeJson(stateFile(root, "windows-verification.json"), report); console.log(name); }
function pass(details?: unknown) { report.stages.push({ name: report.currentStage, passed: true, details }); }
async function bundle() {
  await run(root, nodeCommand(root, "expo", "expo", ["export:embed", "--platform", "windows", "--entry-file", "index.ts", "--bundle-output", stateFile(root, "windows-check.bundle"), "--dev", "true", "--minify", "false", "--max-workers", "2"]), { capture: true });
}
try {
  stage("Create through the framework starter");
  await create(root, manifest, "windows"); pass();
  const cli = path.join(root, "node_modules/@legend-apps/cli/src/index.ts");
  originalApp = readFileSync(path.join(root, "App.tsx"), "utf8");
  const baseline = runtimeFor(root, nativePackages(root), "go");
  let go: any;
  let goHash: string | undefined;
  if (prepareOnly) {
    stage("Prebuild and bundle the integrated Windows starter");
    await prepareWindows(root, "go"); await bundle();
    if (runtimeFor(root, nativePackages(root), "go").fingerprint !== baseline.fingerprint) throw new Error("Native fingerprint changed during prebuild");
    pass();
  } else {
    stage("Build and register Go with legend sdk build-go");
    await run(root, ["bun", cli, "sdk", "build-go", "--project", root]);
    go = readJson(stateFile(root, "go-build.json"));
    goHash = digest(readFileSync(path.join(go.app, "MyApp.exe")).toString("base64"));
    pass({ app: go.app });
    server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
      if (request.method !== "POST" || request.headers.get("x-legend-token") !== token) return new Response("Wrong session", { status: 403 });
      proof = await request.json();
      return new Response("ok");
    } });
    writeFileSync(path.join(root, "Marker.ts"), 'export default "initial";\n');
    writeFileSync(path.join(root, "WindowsExtra.ts"), 'export function greeting() { return null; }\n');
    writeFileSync(path.join(root, "App.tsx"), `import React, { useEffect, useState } from "react";
import { View, Text, Button, TurboModuleRegistry } from "react-native";
import marker from "./Marker";
import { greeting } from "./WindowsExtra";
const host = TurboModuleRegistry.getEnforcing<any>("NativeLegendRuntime");
export default function App() {
  const [clicks, setClicks] = useState(0);
  useEffect(() => {
    void fetch("http://127.0.0.1:${server.port}", { method: "POST", headers: { "Content-Type": "application/json", "x-legend-token": host.session() }, body: JSON.stringify({ native: JSON.parse(host.describe()), marker, greeting: greeting(), hermes: !!(globalThis as any).HermesInternal }) });
  }, [marker]);
  return <View><Text>{marker}</Text><Button title={String(clicks)} onPress={() => setClicks(v => v + 1)} /></View>;
}
`);
    stage("Launch through legend dev and execute the native core with Hermes");
    mkdirSync(stateFile(root, "logs"), { recursive: true });
    session = Bun.spawn(["bun", cli, "dev", "--project", root, "--go", go.app], { cwd: root, env: { ...process.env, LEGEND_SESSION_TOKEN: token }, stdin: "pipe", stdout: "pipe", stderr: "pipe" });
    const { appendFileSync } = await import("node:fs");
    for (const stream of [session.stdout, session.stderr]) void (async () => {
      for await (const chunk of stream) appendFileSync(stateFile(root, "logs/windows-session.log"), chunk);
    })();
    await wait(() => proof?.marker === "initial", "The native Go app did not report");
    if (!proof.hermes || proof.native.fingerprint !== go.runtime.fingerprint || proof.native.mode !== "go") throw new Error("Wrong Go runtime or JavaScript engine");
    pass(proof);
    stage("Fast Refresh in the same Go session");
    writeFileSync(path.join(root, "Marker.ts"), 'export default "refreshed";\n');
    await wait(() => proof?.marker === "refreshed", "Fast Refresh did not reach the native app"); pass(proof);
  }
  stage("Install the existing native-greeting fixture and invalidate Go");
  const archive = path.resolve(path.dirname(manifest), readJson(manifest)["@legend-apps/native-greeting"]);
  await run(root, ["bun", "add", archive]);
  const issues = incompatible(baseline, nativePackages(root), "windows");
  if (!issues.includes("@legend-apps/native-greeting")) throw new Error("Shared compatibility check did not detect the new module");
  if (prepareOnly) {
    writeFileSync(path.join(root, "App.tsx"), 'import React from "react";\nimport { Text } from "react-native";\nimport { getGreeting } from "@legend-apps/native-greeting";\nexport default function App() { return <Text>{getGreeting()}</Text>; }\n');
    pass(issues);
    stage("Prebuild and bundle the custom Windows graph");
    await prepareWindows(root, "dev"); await bundle(); pass();
  } else {
    await wait(() => {
      try { const s = readJson(stateFile(root, "session.json")); return s.target === "go" && !s.compatible && s.reason.includes("native-greeting"); } catch { return false; }
    }, "legend dev did not reject the incompatible Go runtime");
    pass(issues);
    writeFileSync(path.join(root, "WindowsExtra.ts"), 'import { getGreeting } from "@legend-apps/native-greeting";\nexport const greeting = getGreeting;\n');
    stage("Build and switch using the normal dev session b command");
    session!.stdin!.write("b\n");
    await wait(() => proof?.native.mode === "dev" && proof.greeting === "Hello from the custom native module", "The custom runtime did not report", 20 * 60 * 1000);
    const custom = readJson(stateFile(root, "dev-build.json"));
    if (!proof.hermes || proof.native.fingerprint !== custom.runtime.fingerprint) throw new Error("Custom native runtime identity did not match the build");
    if (digest(readFileSync(path.join(go.app, "MyApp.exe")).toString("base64")) !== goHash) throw new Error("The saved Go executable changed");
    pass(proof);
  }
  report.passed = true;
  console.log(prepareOnly ? "PASS: integrated generation, compatibility and Windows bundles. Native execution NOT verified." : "PASS: integrated Windows Go, Hermes, Fast Refresh and custom native module.");
} catch (error) {
  report.error = String(error); process.exitCode = 1; console.error(error);
} finally {
  if (session && session.exitCode === null) {
    session.stdin!.write("q\n");
    await Promise.race([session.exited, Bun.sleep(5000)]);
    if (session.exitCode === null) session.kill();
  }
  server?.stop(true);
  if (originalApp !== undefined) writeFileSync(path.join(root, "App.tsx"), originalApp);
  for (const name of ["Marker.ts", "WindowsExtra.ts"]) rmSync(path.join(root, name), { force: true });
  report.finished = new Date().toISOString(); writeJson(stateFile(root, "windows-verification.json"), report);
  console.log(`Report: ${stateFile(root, "windows-verification.json")}`);
}
