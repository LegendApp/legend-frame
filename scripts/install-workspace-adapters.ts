import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { installedPackages } from "../packages/cli/src/project.ts";

// Bun 1.3.14 cannot reliably add nested files through patchedDependencies.
// Apply the checked-in SDK deltas after install, with no network or native tools.
// Atomic replacement avoids changing hardlinked package-manager cache files.
export function installWorkspaceAdapters(root: string) {
  const require = createRequire(import.meta.url);
  const { parsePatch, applyPatch, reversePatch } = require("diff");
  const config = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const installed = new Map(installedPackages(root).map(pkg => [pkg.name, pkg]));
  for (const [key, file] of Object.entries(config.sparkWorkspacePatches ?? {}) as [string, string][]) {
    const split = key.lastIndexOf("@"), name = key.slice(0, split), version = key.slice(split + 1);
    const pkg = installed.get(name);
    if (!pkg || pkg.json.version !== version) throw new Error(`Workspace adapter needs ${name}@${version}`);
    const directory = pkg.root;
    for (const patch of parsePatch(readFileSync(path.join(root, file), "utf8"))) {
      const relative = patch.newFileName.replace(/^b\//, "");
      const target = path.resolve(directory, relative);
      if (!target.startsWith(directory + path.sep) || patch.newFileName === "/dev/null") throw new Error(`Invalid workspace patch target: ${relative}`);
      const current = existsSync(target) ? readFileSync(target, "utf8") : "";
      // Re-running install is harmless. Changed patch inputs must still match
      // either the upstream file or the exact patch's already-applied context.
      if (applyPatch(current, reversePatch(patch)) !== false) continue;
      const next = applyPatch(current, patch);
      if (next === false) throw new Error(`Cannot apply ${file} to ${relative}. Reinstall dependencies with your package manager before retrying.`);
      mkdirSync(path.dirname(target), { recursive: true });
      const temporary = `${target}.spark-${process.pid}.tmp`;
      writeFileSync(temporary, next);
      renameSync(temporary, target);
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) installWorkspaceAdapters(path.resolve(import.meta.dirname, ".."));
