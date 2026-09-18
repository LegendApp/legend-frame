import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import path from "node:path";
import os from "node:os";

test("workspace apps resolve hoisted tools and detect host source edits", () => {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "frame-workspace-tools-")));
  const app = path.join(root, "examples/app"), host = path.join(root, "node_modules/@legendapp/frame-desktop-host"), tool = path.join(root, "node_modules/expo");
  for (const dir of [app, host, tool]) mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(path.join(app, "package.json"), JSON.stringify({ dependencies: { "@legendapp/frame-desktop-host": "1", expo: "1" } }));
    writeFileSync(path.join(host, "package.json"), JSON.stringify({ name: "@legendapp/frame-desktop-host", version: "1" }));
    writeFileSync(path.join(host, "AppDelegate.mm"), "before");
    writeFileSync(path.join(tool, "package.json"), JSON.stringify({ name: "expo", version: "1", bin: { expo: "cli.js" } }));
    const { binary } = require("../packages/cli/src/commands");
    const { hostSourceSignature } = require("../packages/cli/src/project");
    expect(binary(app, "expo")).toBe(path.join(tool, "cli.js"));
    const before = hostSourceSignature(app);
    writeFileSync(path.join(host, "AppDelegate.mm"), "after");
    expect(hostSourceSignature(app)).not.toBe(before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
