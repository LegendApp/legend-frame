import { hostSourceSignature } from "../packages/cli/src/project.ts";
import { binary } from "../packages/cli/src/commands.ts";
import { expect, test } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import path from "node:path";
import os from "node:os";

test("workspace apps resolve hoisted tools and detect host source edits", () => {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "spark-workspace-tools-")));
  const app = path.join(root, "examples/app"), host = path.join(root, "node_modules/@legendapp/spark-desktop-host"), tool = path.join(root, "node_modules/expo");
  for (const dir of [app, host, tool]) mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(path.join(app, "package.json"), JSON.stringify({ dependencies: { "@legendapp/spark-desktop-host": "1", expo: "1" } }));
    writeFileSync(path.join(host, "package.json"), JSON.stringify({ name: "@legendapp/spark-desktop-host", version: "1" }));
    writeFileSync(path.join(host, "AppDelegate.mm"), "before");
    writeFileSync(path.join(tool, "package.json"), JSON.stringify({ name: "expo", version: "1", bin: { expo: "cli.js" } }));
    expect(binary(app, "expo")).toBe(path.join(tool, "cli.js"));
    const before = hostSourceSignature(app);
    writeFileSync(path.join(host, "AppDelegate.mm"), "after");
    expect(hostSourceSignature(app)).not.toBe(before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
