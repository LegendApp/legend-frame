import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prepareKitchenSink } from "./prepare-kitchen-sink";
import { build } from "../packages/cli/src/build";
import { binary, run } from "../packages/cli/src/commands";
import { availablePort } from "../packages/cli/src/local";
import { readJson, writeJson } from "../packages/cli/src/project";

const root = path.resolve(process.argv[2] ?? ".frame/ui-tests/KitchenSink");
await prepareKitchenSink(root);
const pkg = readJson(path.join(root, "package.json"));
pkg.dependencies["@legendapp/frame-sdk-test-driver"] = pkg.overrides["@legendapp/frame-sdk-test-driver"];
writeJson(path.join(root, "package.json"), pkg);
await run(root, ["bun", "install"]);
const driverFile = path.join(root, "test-driver.ts");
const originalDriver = readFileSync(driverFile, "utf8");
writeFileSync(driverFile, 'import driver from "@legendapp/frame-sdk-test-driver";\nexport type TestDriver = typeof driver;\nexport const testDriver = driver;\n');
let metro: ReturnType<typeof Bun.spawn> | undefined;
let app: ReturnType<typeof Bun.spawn> | undefined;
async function waitFor(predicate: () => Promise<boolean>, description: string) {
  for (let i = 0; i < 300; i++) {
    if (await predicate()) return;
    await Bun.sleep(200);
  }
  throw new Error(`Timed out waiting for ${description}`);
}
try {
  const product = await build(root, "dev");
  const port = await availablePort();
  writeJson(path.join(root, ".frame/session.json"), { compatible: true, target: "test", port });
  const log = Bun.file(path.join(root, ".frame/ui-metro.log"));
  metro = Bun.spawn([binary(root, "expo"), "start", "--localhost", "--port", String(port), "--max-workers", "2"], {
    cwd: root, env: { ...process.env, CI: "1" }, stdout: log, stderr: log,
  });
  await waitFor(async () => fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(1000) }).then(r => r.ok, () => false), "Metro");
  const executable = (await run(root, ["/usr/libexec/PlistBuddy", "-c", "Print :CFBundleExecutable", path.join(product.app, "Contents/Info.plist")], { capture: true })).trim();
  const report = path.join(root, `.frame/ui-results-${Date.now()}.json`);
  const output = Bun.file(path.join(root, ".frame/ui-app.log"));
  app = Bun.spawn([path.join(product.app, "Contents/MacOS", executable), "-RCT_jsLocation", `127.0.0.1:${port}`, "--frame-ui-report", report], {
    cwd: root, env: { ...process.env, FRAME_BUNDLE_URL: `http://127.0.0.1:${port}/index.bundle?platform=macos&dev=true&minify=false` }, stdout: output, stderr: output,
  });
  await waitFor(async () => existsSync(report), "native UI checks");
  const result = readJson(report);
  if (!result.passed) throw new Error(`Native UI checks failed: ${JSON.stringify(result)}`);
  for (const name of result.results) console.log(`PASS ${name}`);
  console.log(`Native UI report: ${report}`);
} finally {
  if (app && app.exitCode === null) { app.kill(); await app.exited; }
  if (metro) { metro.kill(); await metro.exited; }
  writeFileSync(driverFile, originalDriver);
}
