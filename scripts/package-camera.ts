import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { run } from "../packages/cli/src/commands";

/** Package the tested, self-contained app for another Apple Silicon Mac. */
export async function packageCameraApp(app: string, report: string) {
  const framework = path.resolve(import.meta.dir, "..");
  const output = path.join(framework, "artifacts/camera");
  const kit = path.join(output, "LegendCamera-macOS-arm64");
  const archive = path.join(output, "legend-camera-macos-arm64-test-kit.zip");
  rmSync(kit, { recursive: true, force: true }); mkdirSync(kit, { recursive: true });
  cpSync(app, path.join(kit, path.basename(app)), { recursive: true, verbatimSymlinks: true });
  cpSync(report, path.join(kit, "camera-release-validation.json"));
  cpSync(path.join(framework, "patches/camera"), path.join(kit, "patches"), { recursive: true });
  cpSync(path.join(framework, "docs/camera-prototype.md"), path.join(kit, "IMPLEMENTATION.md"));
  writeFileSync(path.join(kit, "README.txt"), `Legend camera macOS prototype\n\nApple Silicon, macOS 14 or later.\nOpen ${path.basename(app)}. JavaScript is embedded; no Metro or development tools are needed.\nThis is a local test build, not a signed and notarized distribution release.\n\nThe app automatically runs native compatibility and camera-free checks.\nOn a Mac with a camera:\n1. Allow camera access and choose a device.\n2. Start the camera; check preview orientation and window resizing.\n3. Take a photo and open the saved file in Finder.\n4. Record and stop a video, then verify playback.\n5. Stop the camera, enable microphone access, restart, and test audio.\n6. Test stop/restart and USB disconnect/reconnect.\n7. Export the hardware test log and keep notes about visual/audio results.\n\nCaptures use temporary files; copy anything you want to keep.\nThe included validation report proves camera-free runtime checks only.\nActual preview/capture remains pending hardware testing.\nSee IMPLEMENTATION.md for exact versions, limits, and reproduction instructions.\n`);
  await run(framework, ["ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", kit, archive], { capture: true });
  const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
  writeFileSync(`${archive}.sha256`, `${digest}  ${path.basename(archive)}\n`);
  return archive;
}
