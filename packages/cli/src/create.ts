import { hostPlatform, type AppPlatform } from "./platform.ts";
import { nodeCommand } from "./windows.ts";
import { cpSync, existsSync, readFileSync } from "node:fs";
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
  upgradeManagedEntry(root);
}

export async function create(root: string, archiveManifest: string, platform: AppPlatform = hostPlatform(), universal = false) {
  const templatesFile = path.join(path.dirname(archiveManifest), "templates.json");
  if (!existsSync(templatesFile)) throw new Error("Pack the SDK again to produce Expo Desktop templates: legend sdk pack");
  const variant = universal ? "universal" : platform;
  const archive = readJson(templatesFile)[variant];
  if (typeof archive !== "string") throw new Error(`No ${variant} template was packed on this host`);
  const templateFile = path.resolve(path.dirname(templatesFile), archive);
  if (!existsSync(templateFile)) throw new Error(`Missing template archive: ${templateFile}. Run legend sdk pack again.`);
  // The upstream CLI owns validation, extraction, app IDs, install, and Git setup.
  // The templates' postinstall initializes Legend configuration once.
  const name = path.basename(root);
  // beta.5 misreads npm 12's record-shaped pack metadata for a local tarball.
  // Use the compatible npm executable for upstream extraction; Bun still installs.
  const npmBin = path.join(import.meta.dir, "npm-bin");
  const child = Bun.spawn(nodeCommand(path.resolve(import.meta.dir, ".."), "expo-desktop", "expo-desktop", [
    "create-app", root, "--template", templateFile, "--yes", "--no-agents-md",
    "--display-name", name, "--rdns", `so.legend.prototype.${name.toLowerCase()}`,
  ]), { cwd: process.cwd(), env: { ...process.env, PATH: `${npmBin}${path.delimiter}${process.env.PATH ?? ""}`, npm_config_user_agent: `bun/${Bun.version}`, CI: "1" }, stdout: "inherit", stderr: "inherit" });
  if (await child.exited) throw new Error("Expo Desktop could not create the app. See its output above.");
  console.log(`Created ${root}.\n\n  cd ${JSON.stringify(root)}\n  bun run ${platform}`);
}

export function upgradeManagedEntry(root: string) {
  const oldMetro = `const { makeMetroConfig } = require("expo-desktop-metro-config");
const { gate } = require("@legend-apps/cli/src/metro-gate.cjs");
const config = makeMetroConfig(__dirname);
config.server = { ...config.server, enhanceMiddleware: (middleware) => gate(__dirname, middleware) };
module.exports = config;
`;
  const oldEntry = 'import { registerRootComponent } from "expo";\nimport App from "./App";\nregisterRootComponent(App);\n';
  const metro = path.join(root, "metro.config.js"), entry = path.join(root, "index.ts");
  // Upgrade only the exact generated pair; customized entries remain user-owned.
  if (existsSync(metro) && existsSync(entry) && readFileSync(metro, "utf8") === oldMetro && readFileSync(entry, "utf8") === oldEntry) {
    for (const file of ["metro.config.js", "index.ts"]) cpSync(path.join(template, file), path.join(root, file));
  }
}
