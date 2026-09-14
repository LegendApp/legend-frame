import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  goConfigurationIssues,
  hashFiles,
  nativePackages,
  projectEnvironment,
  incompatible,
  selection,
  type NativePackage,
  type Runtime,
} from "../packages/cli/src/project.ts";

function pkg(name: string, sdk = true, requires: string[] = []): NativePackage {
  return {
    name,
    root: `/packages/${name}`,
    json: { name, version: "1.0.0" },
    sdk,
    requires,
    signature: name + "-hash",
  };
}
test("production keeps reachable SDK features and transitive native requirements", () => {
  const graph = [
    pkg("dialogs"),
    pkg("menus"),
    pkg("host"),
    pkg("documents", true, ["dialogs", "host"]),
  ];
  const result = selection(graph, new Set(["documents"]));
  expect(result.included.map((p) => p.name)).toEqual([
    "dialogs",
    "host",
    "documents",
  ]);
  expect(result.excluded.map((p) => p.name)).toEqual(["menus"]);
});
test("retained third-party native packages keep their SDK dependencies", () => {
  const dependency = pkg("custom", false);
  dependency.json.dependencies = { dialogs: "1.0.0" };
  const result = selection(
    [pkg("dialogs"), pkg("menus"), dependency],
    new Set(),
  );
  expect(result.included.map((p) => p.name)).toEqual(["dialogs", "custom"]);
});
test("explicit native-only inclusions survive pruning and missing metadata fails", () => {
  expect(selection([pkg("menus")], new Set(), ["menus"]).excluded).toHaveLength(
    0,
  );
  expect(() => selection([pkg("menus")], new Set(), ["missing"])).toThrow(
    "not installed",
  );
  expect(() =>
    selection([pkg("menus", true, ["missing"])], new Set(["menus"])),
  ).toThrow("requires missing");
});
test("a runtime superset is compatible but missing or modified native code is not", () => {
  const runtime: Runtime = {
    schema: 1,
    framework: "0.1.0-prototype.0",
    platform: "macos",
    arch: "arm64",
    mode: "go",
    fingerprint: "go",
    modules: { dialogs: "dialogs-hash", menus: "menus-hash" },
  };
  expect(incompatible(runtime, [pkg("dialogs")])).toEqual([]);
  expect(incompatible(runtime, [pkg("greeting", false)])).toEqual(["greeting"]);
  expect(
    incompatible(runtime, [{ ...pkg("dialogs"), signature: "changed" }]),
  ).toEqual(["dialogs"]);
});
test("native source content changes invalidate hashes without build-directory noise", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "legend-hash-"));
  try {
    mkdirSync(path.join(root, "ios/build"), { recursive: true });
    writeFileSync(path.join(root, "ios/Module.mm"), "one");
    const initial = hashFiles(root, ["ios"]);
    writeFileSync(path.join(root, "ios/build/cache"), "noise");
    expect(hashFiles(root, ["ios"])).toBe(initial);
    writeFileSync(path.join(root, "ios/Module.mm"), "two");
    expect(hashFiles(root, ["ios"])).not.toBe(initial);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test("Go permits ordinary identity but rejects app-specific native configuration", () => {
  expect(
    goConfigurationIssues({
      expo: {
        macos: {
          bundleIdentifier: "example.app",
          infoPlist: { CFBundleName: "App" },
        },
        plugins: ["@legend-apps/desktop-config"],
      },
    }),
  ).toEqual([]);
  expect(
    goConfigurationIssues({
      expo: { macos: { infoPlist: { CFBundleDocumentTypes: [] } } },
    }),
  ).toHaveLength(1);
  expect(
    goConfigurationIssues({ expo: { plugins: ["third-party-native-plugin"] } }),
  ).toHaveLength(1);
});

test("host-only and CNG-only edits invalidate the Go compatibility signature", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "legend-host-hash-"));
  try {
    writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: { "@legend-apps/desktop-app": "1", "@legend-apps/desktop-host": "1", "@legend-apps/desktop-config": "1" } }));
    for (const name of ["desktop-app", "desktop-host", "desktop-config"]) {
      const dir = path.join(root, "node_modules/@legend-apps", name); mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: `@legend-apps/${name}`, version: "1", ...(name === "desktop-app" ? { legend: { nativeModules: ["NativeDesktopApp"] } } : {}) }));
    }
    const initial = nativePackages(root)[0]!.signature;
    writeFileSync(path.join(root, "node_modules/@legend-apps/desktop-host/AppDelegate.mm"), "changed native host");
    const hostChanged = nativePackages(root)[0]!.signature; expect(hostChanged).not.toBe(initial);
    writeFileSync(path.join(root, "node_modules/@legend-apps/desktop-config/app.plugin.cjs"), "changed native config");
    expect(nativePackages(root)[0]!.signature).not.toBe(hostChanged);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("Go launch identity is explicit, validated, and optional for opening a standalone binary", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "legend-project-env-"));
  try {
    expect(projectEnvironment(root)).toEqual({});
    writeFileSync(path.join(root, "app.json"), JSON.stringify({ expo: { name: "Demo", version: "2.3.4", extra: { legend: { projectId: "stable-id" } } } }));
    expect(projectEnvironment(root)).toEqual({ LEGEND_WINDOW_CONFIG: "{}", LEGEND_PROJECT_ID: "stable-id", LEGEND_PROJECT_NAME: "Demo", LEGEND_PROJECT_VERSION: "2.3.4" });
    writeFileSync(path.join(root, "app.json"), JSON.stringify({ expo: { extra: { legend: { projectId: {} } } } }));
    expect(() => projectEnvironment(root)).toThrow("stable project identifier");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("optional native peers do not force unused integrations into production", () => {
  const packages = [
    { name: "host", sdk: false, requires: [], json: { peerDependencies: { webview: "*" }, peerDependenciesMeta: { webview: { optional: true } } } },
    { name: "webview", sdk: true, requires: [], json: {} },
  ] as any;
  expect(selection(packages, new Set()).included.map(pkg => pkg.name)).toEqual(["host"]);
  expect(selection(packages, new Set(["webview"])).included.map(pkg => pkg.name)).toEqual(["host", "webview"]);
  packages[0].json.dependencies = { webview: "1.0.0" };
  expect(selection(packages, new Set()).included.map(pkg => pkg.name)).toEqual(["host", "webview"]);
});

test("an optional peer in a parent workspace is not a native requirement unless the app declares it", () => {
  const workspace = mkdtempSync(path.join(os.tmpdir(), "legend-optional-parent-"));
  const root = path.join(workspace, "apps/consumer");
  const adapter = path.join(root, "node_modules/adapter");
  const optional = path.join(workspace, "node_modules/mobile-backend");
  const manifest = { name: "consumer", dependencies: { adapter: "1.0.0" } as Record<string, string> };
  try {
    mkdirSync(adapter, { recursive: true }); mkdirSync(optional, { recursive: true });
    writeFileSync(path.join(root, "package.json"), JSON.stringify(manifest));
    writeFileSync(path.join(adapter, "package.json"), JSON.stringify({ name: "adapter", version: "1.0.0", peerDependencies: { "mobile-backend": "1.0.0" }, peerDependenciesMeta: { "mobile-backend": { optional: true } } }));
    writeFileSync(path.join(optional, "package.json"), JSON.stringify({ name: "mobile-backend", version: "1.0.0", codegenConfig: { name: "MobileBackend" } }));
    expect(nativePackages(root).map(pkg => pkg.name)).not.toContain("mobile-backend");
    manifest.dependencies["mobile-backend"] = "1.0.0";
    writeFileSync(path.join(root, "package.json"), JSON.stringify(manifest));
    expect(nativePackages(root).map(pkg => pkg.name)).toContain("mobile-backend");
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});
