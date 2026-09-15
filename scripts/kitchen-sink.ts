import { cpSync, existsSync, readFileSync, readdirSync, rmSync, symlinkSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
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
  cpSync(source, root, { recursive: true });
  return root;
}
// Content, rather than mtimes, keeps checkout changes reliable and warm starts cheap.
export function kitchenSinkInputs(root: string) {
  const hash = createHash("sha256");
  const ignored = new Set(["node_modules", ".git", ".legend", "build", "dist", ".DS_Store"]);
  function visit(relative: string) {
    const file = path.join(root, relative);
    hash.update(relative + "\0");
    if (!existsSync(file)) { hash.update("missing\0"); return; }
    if (relative.endsWith("/")) {
      for (const entry of readdirSync(file, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (ignored.has(entry.name)) continue;
        if (entry.isDirectory()) visit(relative + entry.name + "/");
        else if (entry.isFile()) visit(relative + entry.name);
      }
    } else hash.update(readFileSync(file));
  }
  for (const input of ["packages/", "fixtures/", "patches/", "package.json", "bun.lock",
    "scripts/kitchen-sink.ts", "scripts/pack.ts", "scripts/pack-templates.ts", "scripts/prepare-runtimes.ts",
    "examples/kitchen-sink/metro.config.js"]) visit(input);
  return hash.digest("hex");
}

function installationStamp(root: string) {
  return createHash("sha256").update(readFileSync(path.join(root, "package.json")))
    .update(existsSync(path.join(root, "bun.lock")) ? readFileSync(path.join(root, "bun.lock")) : "")
    .digest("hex");
}

export async function prepareKitchenSinkDev(root: string, refresh = false) {
  const marker = path.join(root, ".legend/kitchen-sink.json");
  if (existsSync(path.join(root, "package.json")) && !existsSync(marker))
    throw new Error(`Refusing to overwrite an existing app. Choose a new kitchen-sink directory: ${root}`);
  const inputs = kitchenSinkInputs(framework);
  const previous = existsSync(marker) ? readJson(marker) : {};
  const installed = existsSync(path.join(root, "node_modules/@legend-apps/cli/package.json"));
  const linked = existsSync(path.join(root, "src")) && realpathSync(path.join(root, "src")) === realpathSync(source);
  if (!refresh && installed && linked && previous.mode === "live" && previous.inputs === inputs
    && previous.installation === installationStamp(root)) {
    console.log("Kitchen sink setup is current. Using live example source.");
    return root;
  }
  if (existsSync(path.join(root, "src")) && !linked)
    throw new Error(`Cannot link kitchen sink source: ${path.join(root, "src")} already exists.`);
  console.log("Preparing kitchen sink dependencies (no native compilation)…");
  await prepareKitchenSinkConsumer(root);
  // Keep native projects, identity, configuration and runtime selection in the consumer.
  // A directory junction also works on Windows without symlink privileges.
  const link = path.join(root, "src");
  if (!existsSync(link)) symlinkSync(source, link, process.platform === "win32" ? "junction" : "dir");
  for (const entry of readdirSync(source)) {
    if (entry !== "metro.config.js") rmSync(path.join(root, entry), { force: true });
  }
  await Bun.write(path.join(root, "index.ts"), 'require("./src/index");\n');
  writeJson(marker, { managed: true, mode: "live", source, inputs, installation: installationStamp(root) });
  return root;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`bun run kitchen-sink [directory] [--refresh] [--prepare-only] [dev options]

Starts Expo/Metro and opens the compatible prebuilt runtime. Source edits Fast Refresh.
  --refresh       Repack and reinstall the SDK even when setup is current
  --prepare-only  Prepare the live-source app without starting Metro
  --packaged      Prepare a copied consumer for validation, then exit

Other options pass through to legend dev (for example --port 8082 or --no-open).
Native runtime compilation is explicit: bun run legend sdk build-prebuilt`);
  } else {
    const root = path.resolve(args[0] && !args[0].startsWith("-") ? args.shift()! : ".legend/examples/KitchenSink");
    const take = (flag: string) => { const index = args.indexOf(flag); if (index < 0) return false; args.splice(index, 1); return true; };
    const refresh = take("--refresh"), prepareOnly = take("--prepare-only"), packaged = take("--packaged");
    if (packaged) {
      if (args.length) throw new Error("--packaged does not accept dev options");
      await prepareKitchenSink(root);
      console.log(`Packaged kitchen sink ready at ${root}`);
    } else {
      await prepareKitchenSinkDev(root, refresh);
      if (!prepareOnly) {
        // Use the consumer's installed CLI, retaining Expo's terminal and key handling.
        const child = Bun.spawn(["bun", "run", "dev", ...args], { cwd: root, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
        const stop = () => child.kill();
        process.on("SIGINT", stop); process.on("SIGTERM", stop);
        try { process.exitCode = await child.exited; }
        finally { process.off("SIGINT", stop); process.off("SIGTERM", stop); }
      }
    }
  }
}
