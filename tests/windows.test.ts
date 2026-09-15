import { test, expect } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { nativePackages, runtimeFor, incompatible, writeJson, VERSION } from "../packages/cli/src/project.ts";
import { readRuntime, findGo, registerRuntime } from "../packages/cli/src/local.ts";
import { projectPlatform } from "../packages/cli/src/platform.ts";
import { buildWindows } from "../packages/cli/src/windows.ts";
const { patchHost, withoutPackaging, unpackagedApp } = require("../packages/config-plugin/windows.plugin.cjs");
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "legend-windows-test-"));
  writeJson(path.join(root, "package.json"), { name: "app", dependencies: {} });
  writeJson(path.join(root, "app.json"), { expo: { name: "App", platforms: ["windows"] } });
  return { root, close: () => rmSync(root, { recursive: true, force: true }) };
}
test("Windows uses the shared graph and runtime identity, including native source changes", () => {
  const f = fixture();
  try {
    const baseline = runtimeFor(f.root, nativePackages(f.root), "go");
    expect(projectPlatform(f.root)).toBe("windows");
    expect(baseline.platform).toBe("windows"); expect(baseline.arch).toBe("x64");
    writeFileSync(path.join(f.root, "App.tsx"), "export default 1");
    expect(runtimeFor(f.root, nativePackages(f.root), "go").fingerprint).toBe(baseline.fingerprint);
    writeJson(path.join(f.root, "node_modules/probe/package.json"), { name: "probe", version: "1" });
    mkdirSync(path.join(f.root, "node_modules/probe/windows"));
    const source = path.join(f.root, "node_modules/probe/windows/Module.cpp");
    writeFileSync(source, "first");
    writeJson(path.join(f.root, "package.json"), { dependencies: { probe: "1" } });
    expect(incompatible(baseline, nativePackages(f.root), "windows")).toEqual(["probe"]);
    const custom = runtimeFor(f.root, nativePackages(f.root), "dev");
    writeJson(path.join(f.root, "node_modules/probe/windows/packages.lock.json"), { restored: true });
    expect(incompatible(custom, nativePackages(f.root), "windows")).toEqual([]);
    writeFileSync(source, "second");
    expect(incompatible(custom, nativePackages(f.root), "windows")).toEqual(["probe"]);
    expect(incompatible(custom, [], "macos")).toEqual(["framework runtime version/platform mismatch"]);
  } finally { f.close(); }
});
test("Windows rejects direct native dependencies without Windows implementations", () => {
  const f = fixture();
  try {
    writeJson(path.join(f.root, "node_modules/mac-only/package.json"), { name: "mac-only", version: "1", codegenConfig: {} });
    writeJson(path.join(f.root, "package.json"), { dependencies: { "mac-only": "1" } });
    expect(() => nativePackages(f.root)).toThrow("no Windows implementation");
  } finally { f.close(); }
});
test("the shared Go registry keeps Windows and macOS runtimes separate", () => {
  const f = fixture(), previous = process.env.LEGEND_HOME;
  process.env.LEGEND_HOME = path.join(f.root, "registry");
  try {
    const win = path.join(f.root, "windows-runtime"), mac = path.join(f.root, "mac-runtime.app");
    writeJson(path.join(win, "legend-runtime.json"), { schema: 1, framework: VERSION, platform: "windows", arch: "x64", mode: "go", modules: {}, fingerprint: "win" });
    writeFileSync(path.join(win, "MyApp.exe"), "fixture, not executable");
    writeJson(path.join(mac, "Contents/Resources/legend-runtime.json"), { schema: 1, framework: VERSION, platform: "macos", arch: "arm64", mode: "go", modules: {}, fingerprint: "mac" });
    mkdirSync(path.join(mac, "Contents/MacOS"));
    registerRuntime(win); registerRuntime(mac);
    expect(findGo([], mac, "windows")?.app).toBe(win);
    expect(findGo([], win, "macos")?.app).toBe(mac);
    rmSync(path.join(win, "MyApp.exe")); expect(readRuntime(win)).toBeUndefined();
  } finally { if (previous === undefined) delete process.env.LEGEND_HOME; else process.env.LEGEND_HOME = previous; f.close(); }
});
test("the config plugin embeds the shared runtime and keeps repeatable host hooks", () => {
  const source = '#include "NativeModules.h"\nint main() {\n  winrt::init_apartment(winrt::apartment_type::single_threaded);\n  auto settings{reactNativeWin32App.ReactNativeHost().InstanceSettings()};\n  appWindow.Title(L"Go");\n  appWindow.Resize({1000, 1000});\n}\n';
  const core = readFileSync(new URL("../packages/desktop-host/windows/runtime.inc", import.meta.url), "utf8");
  const metadata = { mode: "dev", fingerprint: "a".repeat(64), platform: "windows", arch: "x64" };
  const embedded = core + '\nvoid helper() { appWindow.Resize({400, 300}); }\n';
  const first = patchHost(source, embedded, metadata);
  expect(patchHost(first, embedded, metadata)).toBe(first);
  expect(first).toContain("void helper() { appWindow.Resize({400, 300}); }");
  expect(first.match(/LegendWin::ForwardLaunch\(\)/g)).toHaveLength(1);
  expect(first.indexOf("LegendWin::ForwardLaunch()")).toBeLessThan(first.indexOf("auto settings{"));
  expect(() => patchHost(source.replace("winrt::init_apartment(winrt::apartment_type::single_threaded);", ""), core, metadata)).toThrow("template changed");
  expect(first).toContain('"mode":"dev"'); expect(first).toContain("NativeLegendRuntime");
  expect(() => patchHost("wrong template", core, metadata)).toThrow("template changed");
  const globals: any[] = [];
  const document = [{ Project: [{ PropertyGroup: globals, ":@": { "@_Label": "Globals" } }] }];
  unpackagedApp(document); const json = JSON.stringify(document); unpackagedApp(document);
  expect(JSON.stringify(document)).toBe(json);
  expect(globals.find(node => node.WindowsPackageType).WindowsPackageType).toEqual([{ "#text": "None" }]);
  const solution = 'Project("TYPE") = "App", "App.vcxproj", "{APP}"\r\nEndProject\r\nProject("TYPE") = "Pack", "Pack.wapproj", "{PACK}"\r\nEndProject\r\n{PACK}.Debug = Debug\r\n';
  expect(withoutPackaging(solution)).toContain("App.vcxproj"); expect(withoutPackaging(solution)).not.toContain("PACK");
});
test("Windows production builds fail explicitly before running native tools", async () => {
  await expect(buildWindows("unused", "release", false)).rejects.toThrow("production builds");
});

test("Windows canonical config does not require a macOS bundle identity", () => {
  const { toExpo } = require("../packages/config-plugin/config.cjs");
  const config = toExpo({ name: "Windows", version: "1.0.0", projectId: "test-windows", platforms: ["windows"] });
  expect(config.expo.platforms).toEqual(["windows"]);
  expect(config.expo.macos).toBeUndefined();
  expect(config.expo.windows.displayName).toBe("Windows");
  expect(() => toExpo({ name: "Mac", version: "1.0.0", projectId: "test-mac" })).toThrow("bundleIdentifier");
});


test("Windows accepts implemented window options and rejects unsupported presentation", () => {
  const { validateWindowsWindowOptions } = require("../packages/desktop-windows/src/windows-options");
  expect(() => validateWindowsWindowOptions({ title: "Editor", minWidth: 300, maxHeight: 900, resizable: false, minimizable: true, alwaysOnTop: true })).not.toThrow();
  for (const options of [{ material: "sidebar" }, { parentId: "main", modal: true }, { titleBarStyle: "overlay" }]) {
    try { validateWindowsWindowOptions(options); throw new Error("Expected unsupported options to fail"); }
    catch (error) { expect((error as { code?: string }).code).toBe("E_UNAVAILABLE"); }
  }
});
