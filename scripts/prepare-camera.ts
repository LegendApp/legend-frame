import { packArchive } from "../packages/cli/src/pack-archive.ts";
import { applyOverrides, localArchive, managerCommand, packageManager } from "../packages/cli/src/package-manager.ts";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { run } from "../packages/cli/src/commands.ts";
import { readJson, writeJson } from "../packages/cli/src/project.ts";

const framework = path.resolve(import.meta.dirname, "..");
type Upstream = { version: string; url: string; integrity: string };

/** Recreate patched packages from integrity-checked published sources. */
export async function packCameraPackages(names?: string[]) {
  const upstream: Record<string, Upstream> = readJson(path.join(framework, "patches/camera/upstream.json"));
  const cache = path.join(framework, ".frame/camera-packages");
  const output = path.join(framework, "artifacts/camera/packages");
  mkdirSync(cache, { recursive: true }); mkdirSync(output, { recursive: true });
  const manifest: Record<string, string> = {};
  for (const [name, info] of Object.entries(upstream)) {
    if (names && !names.includes(name)) continue;
    const archive = path.join(cache, `${name}-${info.version}.tgz`);
    if (!existsSync(archive)) {
      const response = await fetch(info.url);
      if (!response.ok) throw new Error(`Download ${name}: HTTP ${response.status}`);
      writeFileSync(archive, new Uint8Array(await response.arrayBuffer()));
    }
    const integrity = `sha512-${createHash("sha512").update(readFileSync(archive)).digest("base64")}`;
    if (integrity !== info.integrity) throw new Error(`Integrity mismatch: ${archive}`);
    const stage = path.join(cache, name);
    rmSync(stage, { recursive: true, force: true }); mkdirSync(stage);
    await run(stage, ["tar", "-xzf", archive, "--strip-components=1"], { capture: true });
    const patch = path.join(framework, "patches/camera", `${name}.patch`);
    if (existsSync(patch)) await run(stage, ["patch", "--batch", "--fuzz=0", "-p1", "-i", patch], { capture: true });
    const hash = createHash("sha256").update(info.integrity).update(existsSync(patch) ? readFileSync(patch) : "").digest("hex").slice(0, 12);
    const file = `${name}-${info.version}-macos-${hash}.tgz`;
    await run(stage, ["tar", "--exclude=.frame", "-czf", path.join(output, file), "."], { capture: true, env: { COPYFILE_DISABLE: "1" } });
    manifest[name] = path.join(output, file);
  }
  writeJson(path.join(output, "manifest.json"), manifest);
  return manifest;
}

export async function installCameraPackages(root: string, probeOnly = false) {
  const packages = await packCameraPackages(probeOnly ? ["react-native-nitro-modules"] : ["react-native-nitro-modules", "react-native-nitro-image", "react-native-vision-camera"]);
  const probe = path.join(framework, "examples/camera/nitro-view-probe");
  const output = path.join(framework, "artifacts/camera/packages/nitro-view-probe.tgz");
  await packArchive(probe, output);
  const hash = createHash("sha256").update(readFileSync(output)).digest("hex").slice(0, 12);
  const immutable = output.replace(".tgz", `-${hash}.tgz`); cpSync(output, immutable);
  packages["@legendapp/frame-nitro-view-probe"] = immutable;
  const pkg = readJson(path.join(root, "package.json"));
  const manager = packageManager(root);
  const dependencies = Object.fromEntries(Object.entries(packages).map(([name, archive]) => [name, localArchive(archive)]));
  pkg.dependencies = { ...pkg.dependencies, ...dependencies };
  applyOverrides(pkg, dependencies, manager);
  writeJson(path.join(root, "package.json"), pkg);
  await run(root, managerCommand(manager, ["install"]), { capture: true });
  return packages;
}
