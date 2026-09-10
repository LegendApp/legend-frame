import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  goConfigurationIssues,
  hashFiles,
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
