import { expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { kitchenSinkInputs, prepareKitchenSink, prepareKitchenSinkDev } from "../scripts/kitchen-sink";

test("screen and CSS edits keep the setup cache, SDK and Metro edits invalidate it", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "kitchen-inputs-"));
  const write = (file: string, content: string) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  try {
    write("examples/kitchen-sink/App.tsx", "screen");
    write("examples/kitchen-sink/global.css", "styles");
    write("packages/ui/src/index.tsx", "native control");
    const initial = kitchenSinkInputs(root);
    write("examples/kitchen-sink/App.tsx", "edited screen");
    write("examples/kitchen-sink/global.css", "edited styles");
    expect(kitchenSinkInputs(root)).toBe(initial);
    write("packages/ui/src/index.tsx", "changed control");
    const sdk = kitchenSinkInputs(root);
    expect(sdk).not.toBe(initial);
    write("examples/kitchen-sink/metro.config.js", "changed resolver");
    expect(kitchenSinkInputs(root)).not.toBe(sdk);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("packaged test preparation refuses a live source consumer", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "kitchen-live-"));
  try {
    mkdirSync(path.join(root, ".legend"));
    writeFileSync(path.join(root, ".legend/kitchen-sink.json"), JSON.stringify({ managed: true, mode: "live" }));
    await expect(prepareKitchenSink(root)).rejects.toThrow("separate directory");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("live preparation refuses an unmanaged application", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "kitchen-unmanaged-"));
  try {
    writeFileSync(path.join(root, "package.json"), "{}");
    await expect(prepareKitchenSinkDev(root)).rejects.toThrow("Refusing to overwrite");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
