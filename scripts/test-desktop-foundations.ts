// Build a custom Kitchen Sink runtime with the native test driver, then exercise
// window, recursive filesystem, and Fabric drag/drop contracts.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { build } from "../packages/cli/src/build";
import { availablePort } from "../packages/cli/src/local";
import { binary, run } from "../packages/cli/src/commands";
import { projectEnvironment } from "../packages/cli/src/project";
if (process.platform !== "darwin") throw new Error("This launcher builds the AppKit test driver on macOS. Run the portable Kitchen Sink checks on Windows.");
const root = path.resolve("examples/kitchen-sink");
const directory = path.resolve(".frame/desktop-foundation-tests");
mkdirSync(directory, { recursive: true });
const manifest = path.join(root, "package.json"), original = readFileSync(manifest, "utf8");
let source: string;
try {
  const pkg = JSON.parse(original); pkg.devDependencies = { ...pkg.devDependencies, "@legendapp/frame-sdk-test-driver": "workspace:*" };
  writeFileSync(manifest, JSON.stringify(pkg, null, 2) + "\n");
  source = (await build(root, "dev")).app;
} finally { writeFileSync(manifest, original); }
const appPath = path.join(directory, "FoundationTests.app");
rmSync(appPath, { recursive: true, force: true }); cpSync(source, appPath, { recursive: true });
const port = await availablePort();
const report = path.join(directory, "report.json"); rmSync(report, { force: true });
const metroLog = Bun.file(path.join(directory, "metro.log"));
const metro = Bun.spawn([binary(root, "expo"), "start", "--localhost", "--port", String(port), "--max-workers", "2"], { cwd: root, env: { ...process.env, CI: "1", FRAME_PLATFORM: "macos" }, stdout: metroLog, stderr: metroLog });
let app: ReturnType<typeof Bun.spawn> | undefined;
try {
  const deadline = Date.now() + 60000;
  while (!await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(1000) }).then(r => r.ok, () => false)) {
    if (Date.now() > deadline || metro.exitCode !== null) throw new Error(`Metro did not start; see ${directory}`);
    await Bun.sleep(250);
  }
  const executable = (await run(directory, ["/usr/libexec/PlistBuddy", "-c", "Print CFBundleExecutable", path.join(appPath, "Contents/Info.plist")], { capture: true })).trim();
  const log = Bun.file(path.join(directory, "app.log"));
  app = Bun.spawn([path.join(appPath, "Contents/MacOS", executable), "-RCT_jsLocation", `127.0.0.1:${port}`, "--frame-foundation-report", report], { cwd: root, env: { ...process.env, ...projectEnvironment(root), FRAME_BUNDLE_URL: `http://127.0.0.1:${port}/index.bundle?platform=macos&dev=true&minify=false` }, stdout: log, stderr: log });
  const end = Date.now() + 90000;
  while (!existsSync(report)) {
    if (Date.now() > end || app.exitCode !== null) throw new Error(`Foundation probe did not report; see ${directory}`);
    await Bun.sleep(250);
  }
  const result = JSON.parse(readFileSync(report, "utf8"));
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) throw new Error("Foundation probe failed");
  if (!result.nativeDriver) throw new Error("Native test driver was not loaded");
} finally {
  if (app) { app.kill(); await app.exited; }
  metro.kill(); await metro.exited;
  rmSync(appPath, { recursive: true, force: true });
}
