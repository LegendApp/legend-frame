import { hostPlatform, type DesktopPlatform } from "./platform.ts";
import { windowsPins, windowsProjectConfig } from "./windows.ts";
import { cpSync, existsSync, mkdirSync, renameSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { readJson, writeJson, prepareConfig } from "./project.ts";
import { run } from "./commands.ts";

// Resolve relative to the installed CLI so packed consumers use the same starter.
const template = path.resolve(import.meta.dir, "../templates/blank-typescript");

export async function refreshLocalPackages(root: string, manifest: string) {
  const pkg = readJson(path.join(root, "package.json"));
  // The template owns the tested compatibility matrix, not module inclusion.
  const pins = readJson(path.join(template, "package.json")).overrides;
  pkg.overrides = { ...pkg.overrides, ...pins };
  for (const [name, file] of Object.entries(readJson(manifest))) {
    const archive = path.resolve(path.dirname(manifest), file as string);
    pkg.overrides[name] = archive;
    if (pkg.dependencies?.[name]) pkg.dependencies[name] = archive;
  }
  writeJson(path.join(root, "package.json"), pkg);
  await run(root, ["bun", "install"]);
  upgradeManagedEntry(root);
}

export async function create(root: string, archiveManifest: string, platform: DesktopPlatform = hostPlatform()) {
  if (existsSync(path.join(root, "package.json")))
    throw new Error(`Project already exists: ${root}`);
  const archives: Record<string, string> = readJson(archiveManifest);
  const local = Object.fromEntries(
    Object.entries(archives).map(([name, file]) => [
      name,
      path.resolve(path.dirname(archiveManifest), file),
    ]),
  );
  mkdirSync(root, { recursive: true });
  cpSync(template, root, { recursive: true });
  // Keep the ignore file in npm archives; restore its application filename here.
  renameSync(path.join(root, "gitignore"), path.join(root, ".gitignore"));
  const name = path.basename(root).replace(/[^a-zA-Z0-9]/g, "") || "HelloWorld";
  const pkg = readJson(path.join(root, "package.json"));
  pkg.name = name.toLowerCase();
  if (platform === "windows") {
    // Native SDK modules remain opt-in until their Windows implementations exist.
    for (const dependency of ["@legend-apps/desktop", "@react-native-runtimes/core", "react-native-macos"]) delete pkg.dependencies[dependency];
    Object.assign(pkg.dependencies, windowsPins, { "@legend-apps/desktop-host": "0.1.0-prototype.0" });
    rmSync(path.join(root, "App.tsx"));
    renameSync(path.join(root, "App.windows.tsx"), path.join(root, "App.tsx"));
    writeFileSync(path.join(root, "react-native.config.js"), windowsProjectConfig);
    delete pkg.scripts.macos;
    pkg.scripts.windows = "legend dev";
  } else rmSync(path.join(root, "App.windows.tsx"));
  for (const dependency of Object.keys(pkg.dependencies)) {
    if (local[dependency]) pkg.dependencies[dependency] = local[dependency];
  }
  pkg.overrides = {
    ...pkg.overrides,
    ...local,
    react: pkg.dependencies.react,
    "react-native": pkg.dependencies["react-native"],
  };
  writeJson(path.join(root, "package.json"), pkg);
  const config = readJson(path.join(root, "desktop.config.json"));
  config.name = name;
  config.platforms = [platform];
  config.projectId = crypto.randomUUID();
  if (platform === "windows") { delete config.macos; delete config.window; }
  else config.macos.bundleIdentifier = `so.legend.prototype.${name.toLowerCase()}`;
  writeJson(path.join(root, "desktop.config.json"), config);
  prepareConfig(root);
  await run(root, ["bun", "install"]);
  console.log(`Created ${root}.\n\n  cd ${JSON.stringify(root)}\n  bun run ${platform}`);
}

export function upgradeManagedEntry(root: string) {
  const oldMetro = `const { makeMetroConfig } = require("expo-desktop-metro-config");
const { gate } = require("@legend-apps/cli/src/metro-gate.cjs");
const config = makeMetroConfig(__dirname);
config.server = { ...config.server, enhanceMiddleware: (middleware) => gate(__dirname, middleware) };
module.exports = config;
`;
  const oldEntry = 'import { registerRootComponent } from "expo";\nimport App from "./App";\nregisterRootComponent(App);\n';
  const metro = path.join(root, "metro.config.js"), entry = path.join(root, "index.ts");
  // Upgrade only the exact generated pair; customized entries remain user-owned.
  if (existsSync(metro) && existsSync(entry) && readFileSync(metro, "utf8") === oldMetro && readFileSync(entry, "utf8") === oldEntry) {
    for (const file of ["metro.config.js", "index.ts"]) cpSync(path.join(template, file), path.join(root, file));
  }
}
