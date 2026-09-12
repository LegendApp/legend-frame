import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { run } from "../packages/cli/src/commands";
import { digest, readJson, writeJson } from "../packages/cli/src/project";

export const runtimesRevision = "58710c25c6e505dcc1292ee54d855408a6f7a42d";
// Distribute the patched, pinned source in the SDK archive manifest. Consumers
// install an ordinary tarball; they need neither git nor a patch-package hook.
export async function packRuntimes(root: string, output: string) {
  const cache = path.join(root, ".legend/vendor/runtimes");
  const source = path.join(cache, "source");
  mkdirSync(cache, { recursive: true });
  if (!existsSync(source)) await run(root, ["git", "clone", "https://github.com/margelo/react-native-runtimes.git", source], { capture: true });
  const patches = ["react-native-runtimes-macos.patch", "react-native-runtimes-integration.patch"];
  const hash = digest(readFileSync(import.meta.path, "utf8") + runtimesRevision + patches.map(file => readFileSync(path.join(root, "patches", file), "utf8")).join(""));
  const stage = path.join(cache, "stage");
  rmSync(stage, { recursive: true, force: true }); mkdirSync(stage);
  const archive = path.join(cache, "source.tar");
  await run(source, ["git", "archive", "--format=tar", "--output", archive, runtimesRevision, "packages/core"], { capture: true });
  await run(stage, ["tar", "-xf", archive], { capture: true });
  for (const patch of patches) await run(stage, ["patch", "--batch", "-p1", "-i", path.join(root, "patches", patch)], { capture: true });
  const core = path.join(stage, "packages/core");
  const pkg = readJson(path.join(core, "package.json"));
  pkg.main = pkg.types = "src/index.ts";
  pkg.legend = { sdk: true, upstreamRevision: runtimesRevision, patchHash: hash };
  // The Metro scanner's Babel dependencies must be declared, not accidentally hoisted.
  pkg.dependencies = { ...pkg.dependencies, "@babel/parser": "7.28.5", "@babel/traverse": "7.28.5", "react-native-nitro-modules": "0.35.7" };
  writeJson(path.join(core, "package.json"), pkg);
  const file = `react-native-runtimes-core-${pkg.version}-${hash}.tgz`;
  await run(core, ["tar", "-czf", path.join(output, file), "."], { capture: true });
  return { [pkg.name]: file };
}
