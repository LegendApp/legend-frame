import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { prepareConfig, readConfig, statePath, toExpo } from "@legend-apps/desktop-config/config.cjs";
import { selectionIndex } from "../packages/ui/src/select";

const shared = {
  name: "Settings", projectId: "universal-settings", version: "1.0.0",
  platforms: ["ios", "android", "web", "macos", "windows"],
  macos: { bundleIdentifier: "com.example.settings" },
  expo: { ios: { bundleIdentifier: "com.example.mobile", infoPlist: { Existing: true } }, android: { package: "com.example.mobile" }, extra: { application: "preserved" } },
  expoByPlatform: { ios: { ios: { infoPlist: { IOSOnly: true } } }, macos: { autolinking: { exclude: ["@expo/ui"] } } },
};
test("target configuration composes overrides without mutating shared input", () => {
  const before = JSON.stringify(shared);
  const ios = toExpo(shared, "ios").expo, mac = toExpo(shared, "macos").expo;
  expect(ios.ios.infoPlist).toEqual({ Existing: true, IOSOnly: true });
  expect(mac.ios.infoPlist).toEqual({ Existing: true });
  expect(ios.plugins).not.toContain("@legend-apps/desktop-config");
  expect(mac.plugins).toContain("@legend-apps/desktop-config");
  expect(ios.extra.application).toBe("preserved");
  expect(mac.extra.legend.supportedPlatforms).toEqual(shared.platforms);
  expect(JSON.stringify(shared)).toBe(before);
  expect(() => toExpo({ ...shared, platforms: ["macos"] }, "windows")).toThrow("not supported");
});
test("switching targets preserves source, config, generated native projects, and other targets' metadata", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "legend-universal-"));
  const previous = process.env.LEGEND_PLATFORM;
  const preserved = ["desktop.config.json", "package.json", "App.tsx", "app.json", ...shared.platforms.filter(p => p !== "web").map(p => `${p}/native-project.txt`)];
  try {
    for (const file of preserved) { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), file === "desktop.config.json" ? JSON.stringify(shared) : `preserve ${file}`); }
    const before = preserved.map(file => readFileSync(path.join(root, file), "utf8"));
    for (const target of [...shared.platforms, "macos", "ios"]) {
      process.env.LEGEND_PLATFORM = target;
      expect(prepareConfig(root).expo.platforms).toEqual([target]);
      expect(readConfig(root).expo.extra.legend.projectId).toBe(shared.projectId);
      const file = statePath(root, "dev-build.json");
      expect(file).toBe(path.join(root, ".legend/platforms", target, "dev-build.json"));
      mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, target);
    }
    expect(preserved.map(file => readFileSync(path.join(root, file), "utf8"))).toEqual(before);
    for (const target of shared.platforms) expect(readFileSync(statePath(root, "dev-build.json", target), "utf8")).toBe(target);
  } finally {
    if (previous === undefined) delete process.env.LEGEND_PLATFORM; else process.env.LEGEND_PLATFORM = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
test("Select keeps semantic values independent of backend indices", () => {
  const options = [{ label: "Light", value: "light" }, { label: "Dark", value: "dark" }];
  expect(selectionIndex(options, "dark")).toBe(1);
  expect(selectionIndex([...options].reverse(), "dark")).toBe(0);
  expect(() => selectionIndex(options, "system")).toThrow("match");
  expect(() => selectionIndex([options[0]!, options[0]!], "light")).toThrow("unique");
});
