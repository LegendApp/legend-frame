import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { copyKitchenSinkScreens, prepareKitchenSink } from "../scripts/prepare-kitchen-sink";

test("packaged consumers receive screens without workspace manifests or native projects", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "kitchen-copy-"));
  const source = path.join(root, "source"), consumer = path.join(root, "consumer");
  mkdirSync(source); mkdirSync(consumer);
  try {
    mkdirSync(path.join(root, "sidecar"));
    writeFileSync(path.join(root, "sidecar/client.ts"), "standalone helper client");
    writeFileSync(path.join(source, "sidecar-client.ts"), 'export * from "../sidecar/client";');
    for (const [file, value] of Object.entries({ "App.tsx": "screen", "global.css": "styles", "metro.config.js": "metro", "package.json": "workspace dependencies", "desktop.config.json": "checkout identity", "app.config.js": "checkout config" })) writeFileSync(path.join(source, file), value);
    mkdirSync(path.join(source, "macos")); writeFileSync(path.join(source, "macos/keep"), "native source");
    writeFileSync(path.join(consumer, "package.json"), "SDK archives");
    writeFileSync(path.join(consumer, "desktop.config.json"), "test identity");
    copyKitchenSinkScreens(source, consumer);
    expect(readFileSync(path.join(consumer, "App.tsx"), "utf8")).toBe("screen");
    expect(readFileSync(path.join(consumer, "global.css"), "utf8")).toBe("styles");
    expect(readFileSync(path.join(consumer, "sidecar-client.ts"), "utf8")).toBe("standalone helper client");
    expect(readFileSync(path.join(consumer, "package.json"), "utf8")).toBe("SDK archives");
    expect(readFileSync(path.join(consumer, "desktop.config.json"), "utf8")).toBe("test identity");
    expect(existsSync(path.join(consumer, "macos"))).toBe(false);
    expect(existsSync(path.join(consumer, "app.config.js"))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("packaged preparation refuses an old live source consumer", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "kitchen-live-"));
  try {
    mkdirSync(path.join(root, ".spark"));
    writeFileSync(path.join(root, ".spark/kitchen-sink.json"), JSON.stringify({ managed: true, mode: "live" }));
    await expect(prepareKitchenSink(root)).rejects.toThrow("separate directory");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("packaged preparation refuses the checked-in or any unmanaged application", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "kitchen-unmanaged-"));
  try {
    writeFileSync(path.join(root, "package.json"), "{}");
    await expect(prepareKitchenSink(root)).rejects.toThrow("Refusing to overwrite");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
