import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { macOSReleaseSettings } from "../packages/cli/src/macos-release";
import { runtimeFor, writeJson } from "../packages/cli/src/project";

test("compiler policy changes invalidate macOS releases without invalidating development or Windows", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "legend-release-policy-"));
  const original = [...macOSReleaseSettings];
  try {
    writeJson(path.join(root, "package.json"), { name: "app", dependencies: {} });
    for (const platform of ["macos", "windows"]) {
      writeJson(path.join(root, "app.json"), { expo: { name: "App", platforms: [platform] } });
      const modes = ["go", "dev", "preview", "release"];
      const before = modes.map(mode => runtimeFor(root, [], mode).fingerprint);
      macOSReleaseSettings.push("TEST_COMPILER_POLICY=changed");
      for (const [index, mode] of modes.entries()) {
        const after = runtimeFor(root, [], mode).fingerprint;
        if (platform === "macos" && mode === "release") expect(after).not.toBe(before[index]);
        else expect(after).toBe(before[index]);
      }
      macOSReleaseSettings.splice(0, macOSReleaseSettings.length, ...original);
    }
  } finally {
    macOSReleaseSettings.splice(0, macOSReleaseSettings.length, ...original);
    rmSync(root, { recursive: true, force: true });
  }
});
