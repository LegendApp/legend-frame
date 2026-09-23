import { expect, test } from "vitest";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { verifyUpdateSignature, prepareUpdate, SPARKLE_VERSION } from "../packages/cli/src/updates.ts";
import { goConfigurationIssues } from "../packages/cli/src/project.ts";
const { updateConfiguration, updatePlist } = createRequire(import.meta.url)("../packages/config-plugin/updates.cjs");
const valid = { feedURL: "https://example.com/updates/appcast.xml", publicKey: Buffer.alloc(32).toString("base64") };
function config(updates: unknown) { return { extra: { spark: { updates } } }; }
test("update configuration requires HTTPS, an XML feed and a 32-byte Ed25519 public key", () => {
  expect(updateConfiguration({})).toBeUndefined();
  expect(updateConfiguration(config(valid))).toEqual(valid);
  for (const feedURL of ["http://example.com/appcast.xml", "https://u:p@example.com/appcast.xml", "file:///appcast.xml", "https://example.com/appcast.xml?token=secret", "https://example.com/feed"])
    expect(() => updateConfiguration(config({ ...valid, feedURL }))).toThrow();
  for (const publicKey of ["", "secret", Buffer.alloc(16).toString("base64")]) expect(() => updateConfiguration(config({ ...valid, publicKey }))).toThrow();
});
test("CNG pins signed feeds and archives and leaves checks/installations under user control", () => {
  expect(updatePlist(config(valid))).toMatchObject({ SUPublicEDKey: valid.publicKey, SURequireSignedFeed: true, SUVerifyUpdateBeforeExtraction: true, SUEnableAutomaticChecks: false, SUAllowsAutomaticUpdates: false });
  expect(goConfigurationIssues(config(valid))).toContain("Update feed configuration requires a custom runtime");
  expect(readFileSync(new URL("../packages/updates/RNDesktopUpdates.podspec", import.meta.url), "utf8")).toContain(`"Sparkle", "${SPARKLE_VERSION}"`);
});
test("update signatures verify real bytes and reject tampering and another signing key", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "spark-update-signatures-"));
  try {
    const file = path.join(root, "update.zip"); const bytes = Buffer.from("the exact distribution archive"); writeFileSync(file, bytes);
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const key = (publicKey.export({ format: "der", type: "spki" }) as Buffer).subarray(-32).toString("base64");
    const signature = sign(null, bytes, privateKey).toString("base64");
    expect(() => verifyUpdateSignature(file, signature, key)).not.toThrow();
    expect(() => verifyUpdateSignature(file, signature, valid.publicKey)).toThrow();
    writeFileSync(file, "tampered"); expect(() => verifyUpdateSignature(file, signature, key)).toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("ordinary packaging does not download tools or touch update credentials", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "spark-no-updates-"));
  try {
    writeFileSync(path.join(root, "app.json"), JSON.stringify({ expo: {} }));
    expect(await prepareUpdate(root, "unused.zip", "1", { run: async () => { throw new Error("unexpected subprocess"); }, tools: async () => { throw new Error("unexpected download"); } })).toBeUndefined();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
