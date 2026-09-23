import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, copyFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { prepareUpdate, sparkleTools } from "../packages/cli/src/updates.ts";
import { run } from "../packages/cli/src/commands.ts";
import { writeJson } from "../packages/cli/src/project.ts";
const root = mkdtempSync(path.join(os.tmpdir(), "spark-sparkle-test-"));
try {
  const bin = await sparkleTools(root);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const seed = (privateKey.export({ format: "der", type: "pkcs8" }) as Buffer).subarray(-32).toString("base64");
  const key = (publicKey.export({ format: "der", type: "spki" }) as Buffer).subarray(-32).toString("base64");
  const keyFile = path.join(root, "ephemeral-test-key"); writeFileSync(keyFile, seed, { mode: 0o600 });
  const feedURL = "https://example.com/updates/appcast.xml";
  writeJson(path.join(root, "app.json"), { expo: { macos: { bundleIdentifier: "so.legend.spark.update-fixture" }, extra: { spark: { projectId: "ephemeral-fixture", updates: { feedURL, publicKey: key } } } } });
  const app = path.join(root, "Fixture.app"); mkdirSync(path.join(app, "Contents/MacOS"), { recursive: true });
  copyFileSync("/bin/echo", path.join(app, "Contents/MacOS/Fixture"));
  async function archive(version: string) {
    writeJson(path.join(app, "Contents/Info.plist"), { CFBundleExecutable: "Fixture", CFBundleIdentifier: "so.legend.spark.update-fixture", CFBundleName: "Fixture", CFBundlePackageType: "APPL", CFBundleVersion: version, CFBundleShortVersionString: `1.${version}`, LSMinimumSystemVersion: "14.0", SUFeedURL: feedURL, SUPublicEDKey: key, SURequireSignedFeed: true, SUVerifyUpdateBeforeExtraction: true });
    await run(root, ["plutil", "-convert", "xml1", path.join(app, "Contents/Info.plist")], { capture: true });
    await run(root, ["codesign", "--force", "--sign", "-", app], { capture: true });
    const file = path.join(root, `fixture-${version}.zip`); await run(root, ["ditto", "-c", "-k", "--keepParent", app, file], { capture: true }); return file;
  }
  const deps = { run, tools: async () => bin, keyFile };
  const first = await archive("1");
  let result = await prepareUpdate(root, first, "1", deps);
  if (!result || !existsSync(result.feed)) throw new Error("No signed feed");
  const second = await archive("2"); result = await prepareUpdate(root, second, "2", deps);
  if (!result || !readFileSync(result.feed, "utf8").includes('<sparkle:version>2</sparkle:version>')) throw new Error("Second release missing");
  await prepareUpdate(root, second, "2", deps);
  let rejected = false;
  try { await prepareUpdate(root, first, "2", deps); } catch { rejected = true; }
  if (!rejected) throw new Error("Reused build number accepted different bytes");
  console.log("PASS: real Sparkle archive signing, signed appcast generation, feed verification, two releases, idempotency, conflicting build rejection; no Keychain mutation");
} finally { rmSync(root, { recursive: true, force: true }); }
