import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { create } from "../packages/cli/src/create";
import { run } from "../packages/cli/src/commands";
import { buildWindows, nodeCommand, prepareWindows } from "../packages/cli/src/windows";
import { availablePort } from "../packages/cli/src/local";
import { readJson, writeJson, stateFile, projectEnvironment } from "../packages/cli/src/project";
const framework = path.resolve(import.meta.dir, "..");
const prepareOnly = process.argv.includes("--prepare-only");
if (!prepareOnly && process.platform !== "win32") throw new Error("Native acceptance requires Windows. Use --prepare-only for generation/bundling.");
process.env.LEGEND_PLATFORM = "windows";
const at = process.argv.indexOf("--project");
const root = path.resolve(at < 0 ? `.legend/windows-features/WindowsFeatures${Date.now()}` : process.argv[at + 1]!);
await run(framework, ["bun", "scripts/pack.ts", "--platform=windows"]);
await create(root, path.join(framework, "artifacts/packages/manifest.json"), "windows", true);
const pkg = readJson(path.join(root, "package.json"));
for (const name of ["@legend-apps/file-dialog", "@legend-apps/desktop-windows"]) pkg.dependencies[name] = pkg.overrides[name];
writeJson(path.join(root, "package.json"), pkg); await run(root, ["bun", "install"]);
const token = crypto.randomUUID();
let finish!: (value: any) => void;
const result = new Promise<any>(resolve => finish = resolve);
let latestReport: any;
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, async fetch(request) {
  if (request.method !== "POST" || new URL(request.url).pathname !== `/${token}`) return new Response("Not found", { status: 404 });
  const report = latestReport = await request.json(); if (report.error || report.passed) finish(report); return new Response("ok");
} });
const reportURL = `http://127.0.0.1:${server.port}/${token}`;
const sampleFile = path.join(root, ".legend/windows-feature-sample.txt");
writeFileSync(path.join(root, "App.tsx"), `import { useEffect, useState } from 'react';
import { View, Text, Appearance } from 'react-native';
import { Button, TextInput, Select } from '@legend-apps/ui';
import * as Clipboard from '@legend-apps/clipboard';
import * as SecureStore from '@legend-apps/secure-storage';
import * as Linking from '@legend-apps/desktop-links';
import * as Files from '@legend-apps/file-dialog';
import * as Windows from '@legend-apps/desktop-windows';
const options = [{label:'First',value:'first'},{label:'Second',value:'second'}];
export default function App({windowId='main'}: {windowId?: string}) {
 return windowId==='main' ? <Main/> : <Text>Secondary window acceptance</Text>;
}
function Main() {
 const [launchURLs,setLaunchURLs]=useState<string[]>([]);
 useEffect(()=>{let removed=false;let subscription: {remove():void}|undefined;
  void Linking.onOpen(event=>setLaunchURLs(current=>current.includes(event.url)?current:[...current,event.url])).then(value=>{if(removed)value.remove();else subscription=value;});
  return ()=>{removed=true;subscription?.remove();};
 },[]);
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
  const displays=await Windows.getDisplays();
  if(!displays.length||!displays.every(d=>d.scale>0&&d.frame.width>0&&d.workArea.height>0)) throw Error('Invalid displays');
  const child='acceptance-window';
  try {
   await Windows.openWindow({id:child,title:'Window acceptance',width:500,height:400,minWidth:300,minHeight:200,maxWidth:900,maxHeight:700,resizable:true,alwaysOnTop:false});
   if(!(await Windows.listWindows()).some(w=>w.id===child)) throw Error('Secondary window missing');
   await Windows.setWindowOptions(child,{title:'Changed title',resizable:false,alwaysOnTop:true});
   const changed=await Windows.getWindow(child);
   if(changed.title!=='Changed title'||changed.resizable||!changed.alwaysOnTop) throw Error('Window options ignored');
   await Windows.setWindowOptions(child,{resizable:true,alwaysOnTop:false});
   await Windows.setWindowFrame(child,{x:displays[0].workArea.x+40,y:displays[0].workArea.y+40,width:600,height:450});
   const moved=await Windows.getWindow(child);
   if(moved.frame.width!==600||moved.frame.height!==450) throw Error('Window frame ignored');
   await Windows.centerWindow(child);
   await Windows.setFullscreen(child,true); if(!(await Windows.getWindow(child)).fullscreen) throw Error('Fullscreen ignored');
   await Windows.setFullscreen(child,false); if((await Windows.getWindow(child)).fullscreen) throw Error('Fullscreen restore failed');
  } finally {await Windows.closeWindow(child);await Windows.showWindow('main');}
  const system=Appearance.getColorScheme();
  for(const theme of ['dark','light',null] as const) {
   await new Promise<void>((resolve,reject)=>{
    const expected=theme??system, before=Appearance.getColorScheme();
    const timer=setTimeout(()=>{subscription.remove();reject(Error('Appearance change event missing'));},5000);
    const subscription=Appearance.addChangeListener(event=>{if(event.colorScheme===expected){clearTimeout(timer);subscription.remove();resolve();}});
    Appearance.setColorScheme(theme);
    if(Appearance.getColorScheme()!==expected){clearTimeout(timer);subscription.remove();reject(Error('Appearance override ignored'));}
    // Resetting to the already-effective system theme needs no redundant event.
    if(before===expected){clearTimeout(timer);subscription.remove();resolve();}
   });
  }
  setAPI(true);
 })().catch(error=>fetch(${JSON.stringify(reportURL)},{method:'POST',body:JSON.stringify({error:String(error)})}));},[]);
 useEffect(()=>{const passed=api&&pressed&&text==='Native edit'&&value==='second'&&launchURLs.includes('legend-probe://first')&&launchURLs.includes('legend-probe://second');
  void fetch(${JSON.stringify(reportURL)},{method:'POST',body:JSON.stringify({passed,api,launchURLs,checks:['clipboard','credentials','linking','files','windows','appearance','simultaneous-launch-forwarding','button','text-input','select'],hermes:!!(globalThis as any).HermesInternal})});
 },[api,pressed,text,value,launchURLs]);
 return <View style={{padding:30,gap:20}}><Text>Windows native acceptance</Text><Button testID='legend-button' onPress={()=>setPressed(true)}>Native button</Button><TextInput testID='legend-input' defaultValue='Initial' onChangeText={setText}/><Select testID='legend-select' options={options} value={value} onValueChange={setValue}/><Text>{api?'APIs passed':'Checking APIs'} {text} {value}</Text></View>;
}`);
let metro: ReturnType<typeof Bun.spawn> | undefined, app: ReturnType<typeof Bun.spawn> | undefined;
const clients: ReturnType<typeof Bun.spawn>[] = [];
async function until(check: () => boolean, label: string) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) { if (latestReport?.error) throw new Error(latestReport.error); if (check()) return; await Bun.sleep(100); }
  throw new Error(`Timed out: ${label}`);
}
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
    const startClient = (url: string) => {
      const child = Bun.spawn([path.join(product.app, "MyApp.exe"), url], { cwd: product.app,
        env: { ...process.env, ...projectEnvironment(root), LEGEND_METRO_PORT: String(port) }, stdout: "inherit", stderr: "inherit" });
      clients.push(child); return child;
    };
    const first = startClient("legend-probe://first"), second = startClient("legend-probe://second");
    await until(() => [first, second].filter(child => child.exitCode === null).length === 1, "one primary instance");
    app = first.exitCode === null ? first : second;
    const forwarded = first === app ? second : first;
    if (forwarded.exitCode !== 0) throw new Error("Secondary launch failed to forward");
    await until(() => latestReport?.api && latestReport?.launchURLs?.includes("legend-probe://first") && latestReport?.launchURLs?.includes("legend-probe://second"), "queued and forwarded launches in the primary");
    await run(root, ["pwsh.exe", "-NoProfile", "-File", path.join(framework, "scripts/windows-feature-controls.ps1"), "-AppProcess", String(app.pid)], { capture: true });
    const report = await Promise.race([result, Bun.sleep(60_000).then(() => { throw new Error("Timed out waiting for Windows native callbacks"); })]);
    if (!report.passed || !report.hermes) throw new Error(JSON.stringify(report));
    // Terminating the owner abandons its mutex. A new process must recover without
    // an existing window/property or a manual registry cleanup.
    app.kill(); await app.exited; latestReport = undefined;
    app = startClient("legend-probe://recovered");
    await until(() => latestReport?.api && latestReport?.launchURLs?.includes("legend-probe://recovered"), "restart after owner termination");
    report.checks.push("single-instance-crash-recovery");
    writeJson(stateFile(root, "features-results.json"), report);
    console.log(`PASS Windows native acceptance: ${report.checks.join(", ")}`);
  }
} finally {
  for (const client of clients) if (client.exitCode === null) { client.kill(); await client.exited; }
  if (metro) { metro.kill(); await metro.exited; }
  await server.stop(true);
}
