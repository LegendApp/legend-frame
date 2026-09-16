import { expect, test } from "bun:test";
import { validateWindowsWindowOptions } from "../packages/desktop-windows/src/windows-options";
test("Windows accepts portable window options without pretending to support AppKit chrome", () => {
  expect(() => validateWindowsWindowOptions({ closable: false, appearance: "dark", backgroundColor: "#123456", restoreFrame: true })).not.toThrow();
  for (const options of [{ trafficLights: false }, { material: "sidebar" }, { titleBarStyle: "overlay" }, { transparent: true }])
    expect(() => validateWindowsWindowOptions(options)).toThrow("does not yet support");
});
