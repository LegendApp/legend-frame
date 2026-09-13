import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { run } from "./commands.ts";
import { prepareConfig, nativePackages, runtimeFor, stateFile, readJson, writeJson, validateBuildModules, goConfigurationIssues, readAppConfig, type Runtime } from "./project.ts";

// Windows .cmd shims are shell programs; run the package's actual JS entry.
export function nodeCommand(root: string, name: string, bin: string, args: string[] = []) {
  const req = createRequire(path.join(root, "package.json"));
  const file = req.resolve(`${name}/package.json`), pkg = readJson(file);
  return ["node", path.resolve(path.dirname(file), typeof pkg.bin === "string" ? pkg.bin : pkg.bin[bin]), ...args];
}
export async function prepareWindows(root: string, mode: "go" | "dev") {
  prepareConfig(root);
  const packages = nativePackages(root);
  validateBuildModules(mode, packages);
  if (mode === "go") {
    const issues = goConfigurationIssues(readAppConfig(root));
    if (issues.length) throw new Error(`Build Go from a generic SDK starter: ${issues.join("; ")}`);
  }
  const runtime = runtimeFor(root, packages, mode);
  writeJson(stateFile(root, "windows-build-input.json"), runtime);
  writeJson(stateFile(root, "native-selection.json"), { included: packages.map(pkg => ({ name: pkg.name, root: pkg.root })), excluded: [] });
  const manifest = readFileSync(path.join(root, "package.json"), "utf8");
  try {
    await run(root, nodeCommand(root, "expo-desktop", "expo-desktop", ["prebuild", "--platform", "windows", "--template", "expo-desktop-template-bare-minimum@54.81.1-beta.5", "--no-install"]), { env: { CI: "1" }, capture: true });
    // The beta template expands all-platform dependencies. Keep the consumer's installed graph.
  } finally {
    writeFileSync(path.join(root, "package.json"), manifest);
  }
  return runtime;
}
export async function buildWindows(root: string, mode: string, force: boolean): Promise<{ app: string; runtime: Runtime }> {
  if (mode !== "go" && mode !== "dev") throw new Error("Windows currently supports Go and development builds. Use legend build --dev; production builds and packaging are not implemented.");
  if (process.platform !== "win32" || process.arch !== "x64") throw new Error("Windows native builds require a Windows x64 machine. Project generation and Metro bundle checks can run on macOS.");
  for (const tool of ["node", "bun", "pwsh.exe", "dotnet.exe"]) if (!Bun.which(tool)) throw new Error(`Missing ${tool}. See docs/windows-slice.md for the Windows native prerequisites.`);
  const expected = runtimeFor(root, nativePackages(root), mode);
  const record = stateFile(root, `${mode}-build.json`);
  if (!force && existsSync(record)) {
    const old = readJson(record);
    if (old.runtime.fingerprint === expected.fingerprint && existsSync(path.join(old.app, "MyApp.exe"))) return old;
  }
  const runtime = await prepareWindows(root, mode);
  await run(root, nodeCommand(root, "react-native", "react-native", ["run-windows", "--arch", "x64", "--no-packager", "--no-launch", "--no-deploy", "--no-telemetry", "--logging", "--buildLogDirectory", stateFile(root, "logs/msbuild")]), { capture: true });
  if (runtimeFor(root, nativePackages(root), mode).fingerprint !== runtime.fingerprint) throw new Error("Native inputs changed during the build. Retry; no Windows runtime was registered.");
  const products: string[] = [];
  function visit(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory() && !["Generated Files", "node_modules", "packages"].includes(entry.name)) visit(file);
      else if (entry.isFile() && entry.name === "MyApp.exe" && /[\\/]x64[\\/].*[\\/]?Debug[\\/]/i.test(file)) products.push(file);
    }
  }
  visit(path.join(root, "windows"));
  if (products.length !== 1) throw new Error(`Expected one Windows Debug/x64 MyApp.exe; found ${products.length}. Inspect .legend/logs.`);
  const app = stateFile(root, `products/${mode}/LegendWindows`), pending = `${app}.pending`;
  rmSync(pending, { recursive: true, force: true });
  mkdirSync(path.dirname(pending), { recursive: true });
  cpSync(path.dirname(products[0]!), pending, { recursive: true });
  writeJson(path.join(pending, "legend-runtime.json"), runtime);
  rmSync(app, { recursive: true, force: true });
  // Copy only after a complete build, keeping Go and dev products independent.
  const { renameSync } = await import("node:fs"); renameSync(pending, app);
  const result = { app, runtime };
  writeJson(record, result);
  console.log(`Built ${app}`);
  return result;
}
