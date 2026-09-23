import { expect, test } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, renameSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { exportSDK, importSDK, verifySDK, treeHashes } from "../packages/cli/src/sdk-transfer.ts";
import { writeJson } from "../packages/cli/src/project.ts";
test("SDK can move before registration; altered packages fail verification", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "frame-sdk-transfer-")); const home = process.env.FRAME_HOME;
  try {
    process.env.FRAME_HOME = path.join(root, "home"); mkdirSync(path.join(root, "source"));
    const packages = { "@legendapp/frame": "frame.tgz" };
    for (const file of Object.values(packages)) writeFileSync(path.join(root, "source", file), file);
    writeJson(path.join(root, "source/manifest.json"), packages);
    exportSDK(path.join(root, "source/manifest.json"), path.join(root, "export"));
    renameSync(path.join(root, "export"), path.join(root, "relocated"));
    expect(importSDK(path.join(root, "relocated"))).toBe(path.join(root, "relocated"));
    writeFileSync(path.join(root, "relocated/packages/frame.tgz"), "changed");
    expect(() => verifySDK(path.join(root, "relocated"))).toThrow("checksum");
  } finally { if (home === undefined) delete process.env.FRAME_HOME; else process.env.FRAME_HOME = home; rmSync(root, { recursive: true, force: true }); }
});
test("SDK refuses native-runtime symlinks outside its directory", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "frame-sdk-link-"));
  try { mkdirSync(path.join(root, "runtimes")); symlinkSync(os.tmpdir(), path.join(root, "runtimes/outside")); expect(() => treeHashes(root)).toThrow("escapes"); }
  finally { rmSync(root, { recursive: true, force: true }); }
});
