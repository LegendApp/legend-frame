import { expect, test } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, utimesSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeJson } from "../packages/cli/src/project.ts";

test("repeated runtime checks leave unchanged session files untouched but publish compatibility changes", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "frame-session-"));
  const file = path.join(root, ".frame/session.json");
  const state = { compatible: true, reason: "Fast Refresh enabled", target: "go", port: 19120 };
  try {
    writeJson(file, state);
    // A fixed old timestamp catches even same-content rewrites without sleeping.
    utimesSync(file, 1000, 1000);
    const before = statSync(file);
    for (let i = 0; i < 3; i++) writeJson(file, { ...state });
    expect(statSync(file).mtimeMs).toBe(before.mtimeMs);
    expect(statSync(file).ino).toBe(before.ino);
    const incompatible = { ...state, compatible: false, reason: "Development build required" };
    writeJson(file, incompatible);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(incompatible);
    expect(statSync(file).mtimeMs).not.toBe(before.mtimeMs);
    writeJson(file, state);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual(state);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
