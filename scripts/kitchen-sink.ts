import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import { create, refreshLocalPackages } from "../packages/cli/src/create.ts";
import { writeJson } from "../packages/cli/src/project.ts";
import { run } from "../packages/cli/src/commands.ts";
export async function prepareKitchenSink(root: string) {
  const marker = path.join(root, ".legend/kitchen-sink.json");
  if (existsSync(path.join(root, "package.json")) && !existsSync(marker))
    throw new Error(`Refusing to overwrite an existing app. Choose a new kitchen-sink directory: ${root}`);
  const framework = path.resolve(import.meta.dir, "..");
  await run(framework, ["bun", "scripts/pack.ts"]);
  const manifest = path.join(framework, "artifacts/packages/manifest.json");
  if (!existsSync(path.join(root, "package.json"))) await create(root, manifest);
  else await refreshLocalPackages(root, manifest);
  writeJson(marker, { managed: true });
  cpSync(path.join(framework, "examples/kitchen-sink"), root, { recursive: true });
  return root;
}
if (import.meta.main) {
  const root = path.resolve(process.argv[2] ?? ".legend/examples/KitchenSink");
  await prepareKitchenSink(root);
  console.log(`Kitchen sink ready.\n\n  cd ${JSON.stringify(root)}\n  bun dev`);
}
