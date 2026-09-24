import { prepareWindowsGeometry } from "./windows-geometry";
import { copyHelpers } from "./helpers";
import { registerWindowsAssociations } from "./windows-associations";
import { checkExpoDesktopNode } from "./expo-node";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type { WindowsArchitecture } from "./platform.ts";
import { run } from "./commands.ts";
import { prepareConfig, nativePackages, runtimeFor, stateFile, readJson, writeJson, validateBuildModules, goConfigurationIssues, readAppConfig, type Runtime } from "./project.ts";

// Windows .cmd shims are shell programs; run the package's actual JS entry.
export function nodeCommand(root: string, name: string, bin: string, args: string[] = []) {
  const req = createRequire(path.join(root, "package.json"));
  const file = req.resolve(`${name}/package.json`), pkg = readJson(file);
  return ["node", path.resolve(path.dirname(file), typeof pkg.bin === "string" ? pkg.bin : pkg.bin[bin]), ...args];
}
export async function prepareWindows(root: string, mode: "go" | "dev") {
  await checkExpoDesktopNode(root);
  prepareConfig(root);
  prepareWindowsGeometry(root);
  const packages = nativePackages(root);
  validateBuildModules(mode, packages);
  if (mode === "go") {
    const issues = goConfigurationIssues(readAppConfig(root));
    if (issues.length) throw new Error(`Build the prebuilt runtime from a generic SDK starter: ${issues.join("; ")}`);
  }
  const runtime = runtimeFor(root, packages, mode);
  writeJson(stateFile(root, "windows-build-input.json"), runtime);
  writeJson(stateFile(root, "native-selection.json"), { included: packages.map(pkg => ({ name: pkg.name, root: pkg.root })), excluded: [] });
  const manifest = readFileSync(path.join(root, "package.json"), "utf8");
  try {
    await run(root, nodeCommand(root, "expo-desktop", "expo-desktop", ["prebuild", "--platform", "windows", "--template", "expo-desktop-template-bare-minimum@54.81.1-beta.6", "--no-install"]), { env: { CI: "1" }, capture: true });
    // The beta template expands all-platform dependencies. Keep the consumer's installed graph.
  } finally {
    writeFileSync(path.join(root, "package.json"), manifest);
  }
  return runtime;
}
export async function buildWindows(root: string, mode: string, force: boolean): Promise<{ app: string; runtime: Runtime }> {
  if (mode !== "go" && mode !== "dev") throw new Error("Windows currently supports prebuilt runtimes and development builds. Use spark build --dev; production builds and packaging are not implemented.");
  if (process.platform !== "win32") throw new Error("Windows native builds require Windows x64 or ARM64. Project generation and Metro bundle checks can run on macOS.");
  for (const tool of ["node", "bun", "pwsh.exe", "dotnet.exe"]) if (!Bun.which(tool)) throw new Error(`Missing ${tool}. See docs/windows-slice.md for the Windows native prerequisites.`);
  const expected = runtimeFor(root, nativePackages(root), mode);
  const record = stateFile(root, `${mode}-build.json`);
  if (!force && existsSync(record)) {
    const old = readJson(record);
    if (old.runtime.arch === expected.arch && old.runtime.fingerprint === expected.fingerprint && existsSync(path.join(old.app, "MyApp.exe"))) { if (mode === "dev") await registerWindowsAssociations(root, old.app); return old; }
  }
  const runtime = await prepareWindows(root, mode);
  const target = runtime.arch === "arm64" ? "ARM64" : "x64";
  await run(root, nodeCommand(root, "react-native", "react-native", ["run-windows", "--arch", target, "--no-packager", "--no-launch", "--no-deploy", "--no-telemetry", "--logging", "--buildLogDirectory", stateFile(root, "logs/msbuild")]), { capture: true });
  if (runtimeFor(root, nativePackages(root), mode).fingerprint !== runtime.fingerprint) throw new Error("Native inputs changed during the build. Retry; no Windows runtime was registered.");
  const products: string[] = [];
  function visit(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() && !["Generated Files", "node_modules", "packages"].includes(entry.name)) visit(file);
      else if (entry.isFile() && isWindowsDebugProduct(path.relative(path.join(root, "windows"), file), runtime.arch)) products.push(file);
    }
  }
  visit(path.join(root, "windows"));
  if (products.length !== 1) throw new Error(`Expected one Windows Debug/${target} MyApp.exe; found ${products.length}. Inspect .spark/logs.`);
  const app = stateFile(root, `products/${runtime.arch}/${mode}/SparkWindows`), pending = `${app}.pending`;
  rmSync(pending, { recursive: true, force: true });
  mkdirSync(path.dirname(pending), { recursive: true });
  cpSync(path.dirname(products[0]!), pending, { recursive: true });
  copyHelpers(root, pending, readAppConfig(root).expo.extra?.spark?.helpers, "windows");
  writeJson(path.join(pending, "spark-runtime.json"), runtime);
  rmSync(app, { recursive: true, force: true });
  // Copy only after a complete build, keeping Go and dev products independent.
  const { renameSync } = await import("node:fs"); renameSync(pending, app);
  const result = { app, runtime };
  writeJson(record, result);
  if (mode === "dev") await registerWindowsAssociations(root, app);
  console.log(`Built ${app}`);
  return result;
}

export function isWindowsDebugProduct(relativeFile: string, arch: WindowsArchitecture): boolean {
  const parts = relativeFile.toLowerCase().split(/[\\/]/);
  const architectureIndex = parts.indexOf(arch);
  return parts.at(-1) === "myapp.exe" && architectureIndex >= 0 && parts.indexOf("debug", architectureIndex + 1) > architectureIndex;
}
