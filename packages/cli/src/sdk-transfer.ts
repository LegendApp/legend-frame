import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, lstatSync, readlinkSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readJson, writeJson, VERSION } from "./project.ts";
import { readRuntime, registerPackages, registerRuntime } from "./local.ts";

export function treeHashes(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  function visit(relative: string) {
    const file = path.join(root, relative), stat = lstatSync(file);
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(file);
      const resolved = path.resolve(path.dirname(file), target);
      if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new Error(`SDK link escapes bundle: ${relative}`);
      result[relative.replaceAll(path.sep, "/")] = createHash("sha256").update(`symlink:${target}`).digest("hex");
    } else if (stat.isDirectory()) {
      for (const name of readdirSync(file).sort()) visit(path.join(relative, name));
    } else if (stat.isFile()) result[relative.replaceAll(path.sep, "/")] = createHash("sha256").update(readFileSync(file)).digest("hex");
    else throw new Error(`Unsupported SDK file: ${relative}`);
  }
  for (const name of ["packages", "runtimes"]) if (existsSync(path.join(root, name))) visit(name);
  return result;
}
export function verifySDK(root: string) {
  const metadata = readJson(path.join(root, "sdk.json"));
  if (metadata.schema !== 1 || metadata.framework !== VERSION || !Array.isArray(metadata.runtimes)) throw new Error("Incompatible SDK bundle");
  const actual = treeHashes(root);
  if (JSON.stringify(actual) !== JSON.stringify(metadata.sha256)) throw new Error("SDK checksum mismatch; obtain an intact bundle before installing");
  const archives = readJson(path.join(root, "packages/manifest.json"));
  for (const file of Object.values(archives)) {
    if (typeof file !== "string" || path.basename(file) !== file || !actual[`packages/${file}`]) throw new Error("Invalid SDK archive manifest");
  }
  for (const relative of metadata.runtimes) {
    if (typeof relative !== "string" || !relative.startsWith("runtimes/") || relative.includes("..") || !readRuntime(path.join(root, relative))) throw new Error("Invalid bundled Spark Runner");
  }
  return metadata;
}
export function importSDK(root: string) {
  root = path.resolve(root);
  const metadata = verifySDK(root);
  // Register only after every package and client has passed verification.
  registerPackages(path.join(root, "packages/manifest.json"));
  for (const relative of metadata.runtimes) registerRuntime(path.join(root, relative));
  return root;
}
export function exportSDK(manifest: string, destination: string, runtimes: string[] = []) {
  destination = path.resolve(destination);
  if (existsSync(destination)) throw new Error(`SDK destination already exists: ${destination}`);
  const pending = `${destination}.pending`;
  if (existsSync(pending)) throw new Error(`Remove or recover the previous incomplete export: ${pending}`);
  mkdirSync(path.join(pending, "packages"), { recursive: true });
  try {
    const packages = readJson(manifest);
    for (const [name, file] of Object.entries(packages)) {
      if (typeof file !== "string" || path.basename(file) !== file) throw new Error(`Invalid archive path for ${name}`);
      cpSync(path.join(path.dirname(manifest), file), path.join(pending, "packages", file));
    }
    writeJson(path.join(pending, "packages/manifest.json"), packages);
    const clients: string[] = [];
    for (const app of runtimes) {
      const runtime = readRuntime(app);
      if (!runtime || runtime.mode !== "go") throw new Error(`Not a compatible Spark Runner: ${app}`);
      const relative = `runtimes/${runtime.platform}-${runtime.arch}/${path.basename(app)}`;
      if (clients.includes(relative)) throw new Error("Duplicate Spark Runner target");
      cpSync(app, path.join(pending, relative), { recursive: true, verbatimSymlinks: true });
      clients.push(relative);
    }
    const cli = existsSync(path.join(import.meta.dirname, "sdk-install.js")) ? import.meta.dirname : path.resolve(import.meta.dirname, "../dist");
    for (const name of ["sdk-install", "package-manager", "executable"]) {
      const source = readFileSync(path.join(cli, `${name}.js`), "utf8")
        .replaceAll("./package-manager.js", "./package-manager.mjs").replaceAll("./executable.js", "./executable.mjs");
      writeFileSync(path.join(pending, name === "sdk-install" ? "install.mjs" : `${name}.mjs`), source);
    }
    const template = readJson(path.resolve(import.meta.dirname, "../templates/universal/package.json"));
    const tooling = {
      dependencies: Object.fromEntries(["react", "react-native", "react-dom", "expo"].map(name => [name, template.dependencies[name]])),
      overrides: template.overrides,
    };
    writeJson(path.join(pending, "sdk.json"), { schema: 1, framework: VERSION, runtimes: clients, tooling, sha256: treeHashes(pending) });
    writeFileSync(path.join(pending, "README.md"), `# Spark SDK ${VERSION}

Requires Node 24.19.0+ and npm, pnpm, Yarn, or Bun. Run \`node install.mjs\` in this directory (optionally pass \`--package-manager npm|pnpm|yarn|bun\`). The installer prints the CLI command to create an app; add \`--universal\` for Settings or \`--example document-editor\` for the editor.

Keep this directory in place after installing. Its package archives and optional Spark Runner runtimes are registered by path. Transfer before installing, preserving executable permissions and symlinks. Third-party npm dependencies still require internet access.

Included runtimes: ${clients.length ? clients.join(", ") : "none (install a matching Spark Runner or build a development client)"}. Compatibility checks reject mismatched native modules. Native Windows compilation and clean-machine acceptance require Windows; public hosting and production signing are separate workflows.
`);
    verifySDK(pending);
    renameSync(pending, destination);
  } catch (error) { rmSync(pending, { recursive: true, force: true }); throw error; }
  return destination;
}
