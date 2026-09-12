import { cpSync, existsSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "./project.ts";
import { run } from "./commands.ts";

// Resolve relative to the installed CLI so packed consumers use the same starter.
const template = path.resolve(import.meta.dir, "../templates/blank-typescript");

export async function refreshLocalPackages(root: string, manifest: string) {
  const pkg = readJson(path.join(root, "package.json"));
  // The template owns the tested compatibility matrix, not module inclusion.
  const pins = readJson(path.join(template, "package.json")).overrides;
  pkg.overrides = { ...pkg.overrides, ...pins };
  for (const [name, file] of Object.entries(readJson(manifest))) {
    const archive = path.resolve(path.dirname(manifest), file as string);
    pkg.overrides[name] = archive;
    if (pkg.dependencies?.[name]) pkg.dependencies[name] = archive;
  }
  writeJson(path.join(root, "package.json"), pkg);
  await run(root, ["bun", "install"]);
}

export async function create(root: string, archiveManifest: string) {
  if (existsSync(path.join(root, "package.json")))
    throw new Error(`Project already exists: ${root}`);
  const archives: Record<string, string> = readJson(archiveManifest);
  const local = Object.fromEntries(
    Object.entries(archives).map(([name, file]) => [
      name,
      path.resolve(path.dirname(archiveManifest), file),
    ]),
  );
  mkdirSync(root, { recursive: true });
  cpSync(template, root, { recursive: true });
  // Keep the ignore file in npm archives; restore its application filename here.
  renameSync(path.join(root, "gitignore"), path.join(root, ".gitignore"));
  const name = path.basename(root).replace(/[^a-zA-Z0-9]/g, "") || "HelloWorld";
  const pkg = readJson(path.join(root, "package.json"));
  pkg.name = name.toLowerCase();
  for (const dependency of Object.keys(pkg.dependencies)) {
    if (local[dependency]) pkg.dependencies[dependency] = local[dependency];
  }
  pkg.overrides = {
    ...pkg.overrides,
    ...local,
    react: pkg.dependencies.react,
    "react-native": pkg.dependencies["react-native"],
  };
  writeJson(path.join(root, "package.json"), pkg);
  writeJson(path.join(root, "app.json"), {
    expo: {
      name,
      slug: name.toLowerCase(),
      version: "0.0.1",
      platforms: ["macos"],
      newArchEnabled: true,
      macos: {
        bundleIdentifier: `so.legend.prototype.${name.toLowerCase()}`,
        infoPlist: { CFBundleName: name },
      },
      // beta.5's template expansion asserts these even with --platform macos.
      windows: {
        namespace: "LegendPrototype",
        displayName: name,
        packageGuid: crypto.randomUUID(),
        projectGuid: crypto.randomUUID(),
      },
      experiments: { outOfTreePlatforms: true },
      plugins: ["@legend-apps/desktop-config"],
    },
  });
  await run(root, ["bun", "install"]);
  console.log(`Created ${root}.\n\n  cd ${JSON.stringify(root)}\n  bun run macos`);
}
