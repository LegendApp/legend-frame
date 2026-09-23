import { expect, test } from "vitest";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import os from "node:os";
const { gate } = createRequire(import.meta.url)(
  "../packages/cli/src/metro-gate.cjs",
);

test("the live gate blocks incompatible or incomplete state before serving application code", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "frame-gate-"));
  try {
    mkdirSync(path.join(root, ".frame"));
    writeFileSync(path.join(root, "app.json"), JSON.stringify({ expo: { platforms: ["macos"] } }));
    const session = path.join(root, ".frame/session.json");
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


test("desktop compatibility is isolated by request platform in one Metro session", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "frame-gate-universal-"));
  try {
    writeFileSync(path.join(root, "desktop.config.json"), JSON.stringify({ platforms: ["ios", "android", "web", "macos", "windows"] }));
    for (const platform of ["macos", "windows"]) {
      mkdirSync(path.join(root, ".frame/platforms", platform), { recursive: true });
      writeFileSync(path.join(root, ".frame/platforms", platform, "session.json"), JSON.stringify({ compatible: platform === "windows" }));
    }
    const served: string[] = [];
    const middleware = gate(root, (req: any) => served.push(req.url));
    for (const platform of ["ios", "android", "web", "windows", "macos"]) {
      const response = { statusCode: 200, end(_body: string) {} };
      middleware({ url: `/index.bundle?dev=true&platform=${platform}` }, response);
      expect(response.statusCode).toBe(platform === "macos" ? 409 : 200);
    }
    expect(served).toHaveLength(4);
    writeFileSync(path.join(root, ".frame/platforms/macos/session.json"), "{");
    const response = { statusCode: 200, end(_body: string) {} };
    middleware({ url: "/index.bundle?platform=ios" }, response);
    expect(response.statusCode).toBe(200);
    middleware({ url: "/index.delta?platform=macos" }, response);
    expect(response.statusCode).toBe(503);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
