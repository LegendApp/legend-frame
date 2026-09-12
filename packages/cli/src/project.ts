import { readConfig as readAppConfig, prepareConfig, writeUpdates } from "@legend-apps/desktop-config/config.cjs";
export { readAppConfig, prepareConfig, writeUpdates };
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
  renameSync,
} from "node:fs";
import path from "node:path";

export const VERSION = "0.1.0-prototype.0";
export type Package = { name: string; root: string; json: any };
export type NativePackage = Package & {
  signature: string;
  sdk: boolean;
  requires: string[];
};
export type Runtime = {
  schema: 1;
  framework: string;
  platform: "macos";
  arch: "arm64";
  mode: string;
  fingerprint: string;
  modules: Record<string, string>;
};
export function readJson(file: string): any {
  return JSON.parse(readFileSync(file, "utf8"));
}
export function writeJson(file: string, value: unknown) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n");
  renameSync(temporary, file);
}
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function stateFile(root: string, name: string) {
  return path.join(root, ".legend", name);
}
export function installedPackages(root: string): Package[] {
  const found = new Map<string, Package>();
  const queue = [
    { root, json: readJson(path.join(root, "package.json")), app: true },
  ];
  const visited = new Set<string>();
  while (queue.length) {
    const current = queue.shift()!;
    const req = createRequire(path.join(current.root, "package.json"));
    const names = Object.keys({
      ...current.json.dependencies,
      ...(current.app ? current.json.devDependencies : {}),
      ...current.json.peerDependencies,
    }).sort();
    for (const name of names) {
      let file: string;
      try {
        file = req.resolve(`${name}/package.json`);
      } catch {
        // Packages with exports hiding package.json still have an owning directory.
        try {
          let dir = path.dirname(req.resolve(name));
          while (
            !existsSync(path.join(dir, "package.json")) &&
            dir !== path.dirname(dir)
          )
            dir = path.dirname(dir);
          file = path.join(dir, "package.json");
        } catch {
          if (
            current.app &&
            (current.json.dependencies?.[name] ||
              current.json.devDependencies?.[name])
          )
            throw new Error(
              `Dependency ${name} is not installed yet. Finish the package installation, then retry.`,
            );
          continue;
        }
      }
      const dir = realpathSync(path.dirname(file));
      if (visited.has(dir)) continue;
      visited.add(dir);
      const json = readJson(file);
      const prior = found.get(json.name);
      if (
        prior &&
        prior.json.version !== json.version &&
        (json.codegenConfig ||
          json.legend ||
          existsSync(path.join(dir, "expo-module.config.json")))
      ) {
        throw new Error(
          `Conflicting native versions for ${json.name}: ${prior.json.version} and ${json.version}`,
        );
      }
      found.set(json.name, { name: json.name, root: dir, json });
      queue.push({ root: dir, json, app: false });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function hashFiles(root: string, entries: string[]): string {
  const hash = createHash("sha256");
  function visit(relative: string) {
    const file = path.join(root, relative);
    if (!existsSync(file)) return;
    try {
      const children = readdirSync(file, { withFileTypes: true });
      for (const child of children.sort((a, b) =>
        a.name.localeCompare(b.name),
      )) {
        if (
          ["node_modules", "build", ".git", "Pods"].includes(child.name) ||
          child.isSymbolicLink()
        )
          continue;
        visit(path.join(relative, child.name));
      }
    } catch (error: any) {
      if (error.code !== "ENOTDIR") throw error;
      hash.update(relative).update(readFileSync(file));
    }
  }
  for (const entry of entries.sort()) visit(entry);
  return hash.digest("hex");
}
export function nativePackages(root: string): NativePackage[] {
  const installed = installedPackages(root);
  // Host/CNG code can change the native ABI without adding a TurboModule.
  // Fold it into the mandatory app module's compatibility signature for Go.
  const adapters = installed.filter(pkg => ["@legend-apps/desktop-host", "@legend-apps/desktop-config"].includes(pkg.name))
    .map(pkg => hashFiles(pkg.root, ["package.json", "AppDelegate.mm", ...readdirSync(pkg.root).filter(name => name.endsWith(".cjs"))])).join(":");
  return installed
    .filter(
      (pkg) =>
        pkg.json.codegenConfig ||
        pkg.json.legend?.nativeModules ||
        readdirSync(pkg.root).some(
          (name) =>
            name.endsWith(".podspec") || name === "expo-module.config.json",
        ),
    )
    .map((pkg) => ({
      ...pkg,
      sdk: pkg.json.legend?.sdk === true,
      requires: pkg.json.legend?.requires ?? [],
      signature: (signature => pkg.name === "@legend-apps/desktop-app" ? digest(signature + adapters) : signature)(hashFiles(pkg.root, [
        "package.json",
        "ios",
        "macos",
        "apple",
        "cpp",
        "src",
        "common",
        "expo-module.config.json",
        "react-native.config.js",
        ...readdirSync(pkg.root).filter((name) => name.endsWith(".podspec")),
      ])),
    }));
}
export function dependencyStamp(root: string) {
  return hashFiles(root, [
    "package.json",
    "bun.lock",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "app.json",
    "desktop.config.json",
    "app.config.js",
    "app.config.ts",
    "metro.config.js",
    "react-native.config.js",
  ]);
}
export function selection(
  packages: NativePackage[],
  used: Set<string>,
  include: string[] = [],
) {
  const selected = new Set([
    ...packages.filter((p) => !p.sdk).map((p) => p.name),
    ...used,
    ...include,
  ]);
  const reasons: Record<string, string> = {};
  for (const pkg of packages)
    if (selected.has(pkg.name))
      reasons[pkg.name] = include.includes(pkg.name)
        ? "explicit include"
        : pkg.sdk
          ? "reachable production import"
          : "conservative native dependency";
  let changed = true;
  while (changed) {
    changed = false;
    for (const pkg of packages.filter((p) => selected.has(p.name))) {
      const nativeDeps = [
        ...pkg.requires,
        ...Object.keys({
          ...pkg.json.dependencies,
          ...pkg.json.peerDependencies,
        }).filter((n) => packages.some((p) => p.name === n)),
      ];
      for (const name of nativeDeps) {
        if (!packages.some((p) => p.name === name))
          throw new Error(
            `${pkg.name} requires missing native package ${name}`,
          );
        if (!selected.has(name)) {
          selected.add(name);
          reasons[name] = `native dependency of ${pkg.name}`;
          changed = true;
        }
      }
    }
  }
  for (const name of include)
    if (!packages.some((p) => p.name === name))
      throw new Error(`Explicit native include is not installed: ${name}`);
  return {
    included: packages.filter((p) => selected.has(p.name)),
    excluded: packages.filter((p) => !selected.has(p.name)),
    reasons,
  };
}
export function runtimeFor(
  root: string,
  packages: NativePackage[],
  mode: string,
): Runtime {
  const modules = Object.fromEntries(
    packages.map((p) => [p.name, p.signature]),
  );
  const pins = installedPackages(root)
    .filter((p) =>
      [
        "react",
        "react-native",
        "react-native-macos",
        "expo",
        "@legend-apps/desktop-host",
        "@legend-apps/desktop-config",
      ].includes(p.name),
    )
    .map((p) => [p.name, p.json.version]);
  return {
    schema: 1,
    framework: VERSION,
    platform: "macos",
    arch: "arm64",
    mode,
    modules,
    fingerprint: digest(
      JSON.stringify({
        modules,
        pins,
        config: readAppConfig(root),
        adapter: hashFiles(root, [
          "node_modules/@legend-apps/desktop-host",
          "node_modules/@legend-apps/desktop-config",
        ]),
      }),
    ),
  };
}
export function incompatible(
  runtime: Runtime,
  required: NativePackage[],
): string[] {
  if (
    runtime.schema !== 1 ||
    runtime.framework !== VERSION ||
    runtime.arch !== "arm64" ||
    runtime.platform !== "macos"
  )
    return ["framework runtime version/platform mismatch"];
  return required
    .filter((pkg) => runtime.modules[pkg.name] !== pkg.signature)
    .map((pkg) => pkg.name);
}

export function goConfigurationIssues(config: any): string[] {
  const expo = config.expo ?? config;
  const issues: string[] = [];
  if (expo.scheme || expo.extra?.legend?.documentTypes?.length)
    issues.push("URL schemes and document associations require a custom runtime");
  if (expo.extra?.legend?.customRuntime)
    issues.push("app configuration requires a custom runtime");
  if (
    (expo.plugins ?? []).some(
      (plugin: any) =>
        (Array.isArray(plugin) ? plugin[0] : plugin) !==
        "@legend-apps/desktop-config",
    )
  )
    issues.push("additional configuration plugins require a custom runtime");
  if (
    Object.keys(expo.macos ?? {}).some(
      (key) => !["bundleIdentifier", "infoPlist"].includes(key),
    )
  )
    issues.push("macOS native configuration requires a custom runtime");
  if (
    Object.keys(expo.macos?.infoPlist ?? {}).some(
      (key) => key !== "CFBundleName",
    )
  )
    issues.push(
      "app-specific Info.plist configuration requires a custom runtime",
    );
  return issues;
}

export function validateBuildModules(mode: string, packages: NativePackage[]) {
  if (mode === "go" && packages.some(pkg => pkg.name === "@legend-apps/native-greeting" || pkg.json.legend?.testOnly))
    throw new Error("Build Go from the clean SDK starter, not a custom-module test fixture.");
  if (mode === "release" && packages.some(pkg => pkg.json.legend?.testOnly))
    throw new Error("Test-only native modules cannot be included in distribution builds.");
}

export function projectEnvironment(root: string): Record<string, string> {
  const file = path.join(root, "app.json");
  // Explicit `legend open /path/App.app` also works outside a project.
  if (!existsSync(file) && !existsSync(path.join(root, "desktop.config.json"))) return {};
  const config = readAppConfig(root).expo ?? {};
  const projectId = config.extra?.legend?.projectId ?? config.macos?.bundleIdentifier;
  if (typeof projectId !== "string" || !projectId.length || projectId.length > 200)
    throw new Error("Set extra.legend.projectId to a stable project identifier before launching Go.");
  return {
    LEGEND_WINDOW_CONFIG: JSON.stringify(config.extra?.legend?.window ?? {}),
    LEGEND_PROJECT_ID: projectId,
    LEGEND_PROJECT_NAME: typeof config.name === "string" ? config.name : path.basename(root),
    LEGEND_PROJECT_VERSION: typeof config.version === "string" ? config.version : "0.0.0",
  };
}
