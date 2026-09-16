import { cpSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { create, refreshLocalPackages } from "../packages/cli/src/create.ts";
import { readJson, writeJson } from "../packages/cli/src/project.ts";
import { run } from "../packages/cli/src/commands.ts";
const framework = path.resolve(import.meta.dir, "..");
const source = path.join(framework, "examples/kitchen-sink");

// Integration runners deliberately use a fresh, copied consumer they can modify.
export async function prepareKitchenSink(root: string) {
  const marker = path.join(root, ".legend/kitchen-sink.json");
  if (existsSync(marker) && readJson(marker).mode === "live")
    throw new Error("Use a separate directory for packaged validation; this app links to the live kitchen sink source.");
  return prepareKitchenSinkConsumer(root);
}

async function prepareKitchenSinkConsumer(root: string) {
  const marker = path.join(root, ".legend/kitchen-sink.json");
  if (existsSync(path.join(root, "package.json")) && !existsSync(marker))
    throw new Error(`Refusing to overwrite an existing app. Choose a new kitchen-sink directory: ${root}`);
  await run(framework, ["bun", "scripts/pack.ts"]);
  const manifest = path.join(framework, "artifacts/packages/manifest.json");
  if (!existsSync(path.join(root, "package.json"))) await create(root, manifest);
  else await refreshLocalPackages(root, manifest);
  const pkg = readJson(path.join(root, "package.json"));
  pkg.dependencies["@legend-apps/ui"] = pkg.overrides["@legend-apps/ui"];
  pkg.dependencies["base64-js"] = "1.5.1";
  pkg.dependencies.uniwind = "1.6.3";
  pkg.dependencies.tailwindcss = "4.2.4";
  writeJson(path.join(root, "package.json"), pkg);
  await run(root, ["bun", "install"]);
  writeJson(marker, { managed: true });
  // Copy only application source. Preserve the freshly created consumer's
  // identity, SDK archive dependencies, and generated native configuration.
  copyKitchenSinkScreens(source, root);
  return root;
}
export function copyKitchenSinkScreens(source: string, root: string) {
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (entry.isFile() && (/\.tsx?$/.test(entry.name) || ["global.css", "metro.config.js"].includes(entry.name))) cpSync(path.join(source, entry.name), path.join(root, entry.name));
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2).filter(arg => arg !== "--packaged");
  if (args.includes("--help")) console.log("bun run kitchen-sink:prepare [fresh-directory]\nPack the SDK and prepare a separate copied consumer for integration tests.");
  else {
    if (args.length > 1 || args[0]?.startsWith("--")) throw new Error("Use bun run kitchen-sink:prepare [fresh-directory]. Everyday development runs directly from examples/kitchen-sink.");
    const root = path.resolve(args[0] ?? ".legend/examples/KitchenSinkPackaged");
    await prepareKitchenSink(root);
    console.log(`Packaged kitchen sink ready at ${root}`);
  }
}
