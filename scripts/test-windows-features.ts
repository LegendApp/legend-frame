import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { create } from "../packages/cli/src/create";
import { run } from "../packages/cli/src/commands";
import { buildWindows, nodeCommand, prepareWindows } from "../packages/cli/src/windows";
import { availablePort } from "../packages/cli/src/local";
import { readJson, writeJson, stateFile } from "../packages/cli/src/project";
import { launch } from "../packages/cli/src/dev";
const framework = path.resolve(import.meta.dir, "..");
const prepareOnly = process.argv.includes("--prepare-only");
if (!prepareOnly && process.platform !== "win32") throw new Error("Native acceptance requires Windows. Use --prepare-only for generation/bundling.");
process.env.LEGEND_PLATFORM = "windows";
const at = process.argv.indexOf("--project");
const root = path.resolve(at < 0 ? `.legend/windows-features/WindowsFeatures${Date.now()}` : process.argv[at + 1]!);
await run(framework, ["bun", "scripts/pack.ts", "--platform=windows"]);
await create(root, path.join(framework, "artifacts/packages/manifest.json"), "windows", true);
const pkg = readJson(path.join(root, "package.json")); pkg.dependencies["@legend-apps/file-dialog"] = pkg.overrides["@legend-apps/file-dialog"];
writeJson(path.join(root, "package.json"), pkg); await run(root, ["bun", "install"]);
const token = crypto.randomUUID();
let finish!: (value: any) => void;
const result = new Promise<any>(resolve => finish = resolve);
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
  if (request.method !== "POST" || new URL(request.url).pathname !== `/${token}`) return new Response("Not found", { status: 404 });
  const report = await request.json(); if (report.error || report.passed) finish(report); return new Response("ok");
} });
const reportURL = `http://127.0.0.1:${server.port}/${token}`;
const sampleFile = path.join(root, ".legend/windows-feature-sample.txt");
writeFileSync(path.join(root, "App.tsx"), `import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Button, TextInput, Select } from '@legend-apps/ui';
import * as Clipboard from '@legend-apps/clipboard';
import * as SecureStore from '@legend-apps/secure-storage';
import * as Linking from '@legend-apps/desktop-links';
import * as Files from '@legend-apps/file-dialog';
const options = [{label:'First',value:'first'},{label:'Second',value:'second'}];
export default function App() {
 const [api,setAPI]=useState(false), [pressed,setPressed]=useState(false), [text,setText]=useState(''), [value,setValue]=useState('first');
 useEffect(()=>{void (async()=>{
  const original=await Clipboard.getStringAsync();
  try { await Clipboard.setStringAsync('Legend native probe'); if(await Clipboard.getStringAsync()!=='Legend native probe') throw Error('Clipboard round trip failed'); } finally { await Clipboard.setStringAsync(original); }
  const key='probe-${token}';
  try {await SecureStore.setItemAsync(key,'native secret'); if(await SecureStore.getItemAsync(key)!=='native secret') throw Error('Credential round trip failed');} finally {await SecureStore.deleteItemAsync(key);}
  if(await SecureStore.getItemAsync(key)!==null) throw Error('Credential removal failed');
  if(!await Linking.canOpenURL('https://example.com')) throw Error('No HTTPS handler');
  await Files.writeTextFile(${JSON.stringify(sampleFile)},'before');
  if(!await Files.writeTextFileIfUnchanged(${JSON.stringify(sampleFile)},'before','after')) throw Error('File save failed');
  if(await Files.writeTextFileIfUnchanged(${JSON.stringify(sampleFile)},'wrong','lost')) throw Error('File conflict was ignored');
  if(await Files.readTextFile(${JSON.stringify(sampleFile)})!=='after') throw Error('File contents changed');
  setAPI(true);
 })().catch(error=>fetch(${JSON.stringify(reportURL)},{method:'POST',body:JSON.stringify({error:String(error)})}));},[]);
 useEffect(()=>{if(api&&pressed&&text==='Native edit'&&value==='second') void fetch(${JSON.stringify(reportURL)},{method:'POST',body:JSON.stringify({passed:true,checks:['clipboard','credentials','linking','files','button','text-input','select'],hermes:!!(globalThis as any).HermesInternal})});},[api,pressed,text,value]);
 return <View style={{padding:30,gap:20}}><Text>Windows native acceptance</Text><Button testID='legend-button' onPress={()=>setPressed(true)}>Native button</Button><TextInput testID='legend-input' defaultValue='Initial' onChangeText={setText}/><Select testID='legend-select' options={options} value={value} onValueChange={setValue}/><Text>{api?'APIs passed':'Checking APIs'} {text} {value}</Text></View>;
}`);
let metro: ReturnType<typeof Bun.spawn> | undefined, app: ReturnType<typeof Bun.spawn> | undefined;
try {
  await prepareWindows(root, "dev");
  await run(root, nodeCommand(root, "expo", "expo", ["export:embed", "--entry-file", "index.ts", "--platform", "windows", "--dev", "true", "--max-workers", "2", "--bundle-output", stateFile(root, "features.js")]), { capture: true });
  if (prepareOnly) console.log(`PASS Windows feature project and bundle: ${root}`);
  else {
    const product = await buildWindows(root, "dev", false), port = await availablePort();
    writeJson(stateFile(root, "session.json"), { compatible: true, target: "test", port });
    const log = Bun.file(stateFile(root, "features-metro.log"));
    metro = Bun.spawn(nodeCommand(root, "expo", "expo", ["start", "--localhost", "--port", String(port), "--max-workers", "2"]), { cwd: root, env: { ...process.env, CI: "1" }, stdout: log, stderr: log });
    for (let i = 0; i < 120; i++) {
      if (await fetch(`http://127.0.0.1:${port}/status`).then(r => r.ok, () => false)) break;
      await Bun.sleep(500);
    }
    app = await launch(root, product.app, port);
    await run(root, ["pwsh.exe", "-NoProfile", "-File", path.join(framework, "scripts/windows-feature-controls.ps1"), "-AppProcess", String(app.pid)], { capture: true });
    const report = await Promise.race([result, Bun.sleep(60_000).then(() => { throw new Error("Timed out waiting for Windows native callbacks"); })]);
    writeJson(stateFile(root, "features-results.json"), report);
    if (!report.passed || !report.hermes) throw new Error(JSON.stringify(report));
    console.log(`PASS Windows native acceptance: ${report.checks.join(", ")}`);
  }
} finally {
  if (app && app.exitCode === null) { app.kill(); await app.exited; }
  if (metro) { metro.kill(); await metro.exited; }
  await server.stop(true);
}
