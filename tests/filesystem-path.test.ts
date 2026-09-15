import { test, expect } from "bun:test";
import { absolutePath } from "../packages/file-system/src/path";

test("filesystem accepts drive-qualified, UNC and file URL paths on Windows", () => {
  for (const value of ["C:\\Users\\Test\\file.txt", "D:/space ü/file", "\\\\server\\share\\file", "\\\\?\\C:\\long\\file", "file:///C:/space%20name/file"]) expect(absolutePath(value, "windows")).toBe(value);
  for (const value of ["C:relative", "relative", "\\rooted", "/rooted", "\\\\server", "C:\\bad\0name"]) expect(() => absolutePath(value, "windows")).toThrow("absolute");
});
test("filesystem keeps macOS path rules", () => {
  for (const value of ["/tmp/space ü", "file:///tmp/test"]) expect(absolutePath(value, "macos")).toBe(value);
  for (const value of ["C:\\file", "relative", "/tmp/\0file"]) expect(() => absolutePath(value, "macos")).toThrow("absolute");
});

import { settingsFilename as windowsFilename } from "../packages/settings/src/filename.windows";
import { settingsFilename as macFilename } from "../packages/settings/src/filename";
test("Windows settings names escape device names without collisions or changing macOS storage", () => {
  expect(windowsFilename("CON")).toBe("%43ON.json");
  expect(windowsFilename("nul.custom")).toBe("%6Eul.custom.json");
  expect(windowsFilename("%43ON")).toBe("%2543ON.json");
  expect(windowsFilename("counter")).toBe("counter.json");
  expect(macFilename("CON")).toBe("CON.json");
});
