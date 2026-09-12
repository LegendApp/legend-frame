import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readAppConfig, prepareConfig, writeUpdates, projectEnvironment, goConfigurationIssues } from "../packages/cli/src/project";
import { resolveHelpers, copyHelpers } from "../packages/cli/src/helpers";
import { toExpo } from "@legend-apps/desktop-config/config.cjs";
import { validateWindow } from "@legend-apps/window-options";
const base = { name: "Demo", projectId: "demo", version: "1.0.0", macos: { bundleIdentifier: "com.example.demo" } };
function fixture(run: (root: string) => void) { const root = mkdtempSync(path.join(os.tmpdir(), "desktop-config-")); try { run(root); } finally { rmSync(root, { recursive: true, force: true }); } }
test("canonical desktop config drives Go and generated Expo configuration", () => fixture(root => {
  const value = { ...base, window: { titleBarStyle: "overlay", width: 900 } };
  writeFileSync(path.join(root, "desktop.config.json"), JSON.stringify(value));
  writeFileSync(path.join(root, "app.json"), JSON.stringify({ expo: { name: "stale" } }));
  expect(readAppConfig(root).expo.name).toBe("Demo");
  expect(JSON.parse(projectEnvironment(root).LEGEND_WINDOW_CONFIG!)).toEqual(value.window);
  expect(goConfigurationIssues(readAppConfig(root))).toEqual([]);
  prepareConfig(root);
  expect(JSON.parse(readFileSync(path.join(root, "app.json"), "utf8"))).toEqual(toExpo(value));
  expect(JSON.parse(readFileSync(path.join(root, "desktop.config.json"), "utf8"))).toEqual(value);
}));
test("updates writes canonical source and leaves generated config to preparation", () => fixture(root => {
  writeFileSync(path.join(root, "desktop.config.json"), JSON.stringify(base));
  const updates = { feedURL: "https://example.com/appcast.xml", publicKey: Buffer.alloc(32, 1).toString("base64") };
  writeUpdates(root, updates);
  expect(readAppConfig(root).expo.extra.legend.updates).toEqual(updates);
  expect(goConfigurationIssues(readAppConfig(root)).join(" ")).toContain("Update feed");
}));
test("configuration catches unknown keys and invalid window constraints", () => {
  expect(() => toExpo({ ...base, windwo: {} })).toThrow("Unknown");
  for (const options of [{ minWidth: 800, maxWidth: 300 }, { minHeight: 600, height: 400 }, { titleBarStyle: "wrong" }, { resizable: "yes" }, { backgroundColor: "red" }, { width: NaN }]) expect(() => validateWindow(options)).toThrow();
  expect(validateWindow({ titleBarStyle: "overlay", material: "sidebar", maxWidth: 1200 })).toEqual({ titleBarStyle: "overlay", material: "sidebar", maxWidth: 1200 });
});
test("legacy app.json remains readable", () => fixture(root => {
  const value = { expo: { name: "Legacy" } }; writeFileSync(path.join(root, "app.json"), JSON.stringify(value)); expect(readAppConfig(root)).toEqual(value); expect(prepareConfig(root)).toEqual(value);
}));
test("helpers copy project files and reject traversal and symlinks", () => fixture(root => {
  mkdirSync(path.join(root, "bin")); writeFileSync(path.join(root, "bin/tool"), "helper bytes");
  expect(resolveHelpers(root, { tool: "bin/tool" })[0]?.relative).toBe("bin/tool");
  copyHelpers(root, path.join(root, "Demo.app"), { tool: "bin/tool" });
  expect(readFileSync(path.join(root, "Demo.app/Contents/Helpers/tool"), "utf8")).toBe("helper bytes");
  for (const helpers of ([{ tool: "../external" }, { "../bad": "bin/tool" }, { tool: "/bin/echo" }] as Record<string, string>[])) expect(() => resolveHelpers(root, helpers)).toThrow();
  symlinkSync("/bin/echo", path.join(root, "bin/link")); expect(() => resolveHelpers(root, { tool: "bin/link" })).toThrow();
  expect(goConfigurationIssues(toExpo({ ...base, helpers: { tool: "bin/tool" } })).join(" ")).toContain("helpers");
}));
test("canonical config rejects a competing dynamic Expo config", () => fixture(root => {
  writeFileSync(path.join(root, "desktop.config.json"), JSON.stringify(base));
  writeFileSync(path.join(root, "app.config.js"), "module.exports = {};");
  expect(() => prepareConfig(root)).toThrow("cannot be combined");
}));
