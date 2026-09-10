import path from "node:path";
import { readJson, writeJson } from "../packages/cli/src/project.ts";
import { run } from "../packages/cli/src/commands.ts";

const root = path.resolve(process.argv[2] ?? "");
if (!process.argv[2])
  throw new Error("Usage: bun scripts/refresh-consumer.ts <external project>");
const artifacts = path.resolve(import.meta.dir, "../artifacts/packages");
const manifest = readJson(path.join(artifacts, "manifest.json"));
const pkg = readJson(path.join(root, "package.json"));
pkg.overrides ??= {};
for (const [name, file] of Object.entries(manifest)) {
  const archive = path.join(artifacts, file as string);
  pkg.overrides[name] = archive;
  if (pkg.dependencies?.[name]) pkg.dependencies[name] = archive;
}
writeJson(path.join(root, "package.json"), pkg);
await run(root, ["bun", "install"]);
