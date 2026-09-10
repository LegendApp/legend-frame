import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
const { gate } = createRequire(import.meta.url)(
  "../packages/cli/src/metro-gate.cjs",
);

test("the live gate blocks incompatible or incomplete state before serving application code", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "legend-gate-"));
  try {
    mkdirSync(path.join(root, ".legend"));
    const session = path.join(root, ".legend/session.json");
    let served = 0;
    const middleware = gate(root, () => served++);
    const response = () => ({ statusCode: 200, end(_body: string) {} });
    writeFileSync(
      session,
      JSON.stringify({ compatible: false, reason: "NativeGreeting missing" }),
    );
    const blocked = response();
    middleware({ url: "/index.bundle?platform=macos" }, blocked);
    expect(blocked.statusCode).toBe(409);
    expect(served).toBe(0);
    writeFileSync(session, "{");
    const incomplete = response();
    middleware({ url: "/index.bundle" }, incomplete);
    expect(incomplete.statusCode).toBe(503);
    expect(served).toBe(0);
    writeFileSync(session, JSON.stringify({ compatible: true }));
    middleware({ url: "/index.bundle" }, response());
    expect(served).toBe(1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
