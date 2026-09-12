import { packRuntimes } from "./prepare-runtimes";
import { mkdirSync, readFileSync, copyFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { registerPackages } from "../packages/cli/src/local.ts";
import { writeJson, readJson } from "../packages/cli/src/project.ts";

const root = path.resolve(import.meta.dir, "..");
const output = path.join(root, "artifacts/packages");
mkdirSync(output, { recursive: true });
const packages = [
  ...readdirSync(path.join(root, "packages")).sort().map(name => `packages/${name}`),
  "fixtures/native-greeting",
  "fixtures/sdk-test-driver",
];
const manifest: Record<string, string> = await packRuntimes(root, output);
for (const dir of packages) {
  const pkg = readJson(path.join(root, dir, "package.json"));
  const file = `${pkg.name.replace(/^@/, "").replaceAll("/", "-")}-${pkg.version}.tgz`;
  const child = Bun.spawn(
    ["bun", "pm", "pack", "--filename", path.join(output, file)],
    { cwd: path.join(root, dir), stdout: "inherit", stderr: "inherit" },
  );
  if (await child.exited) throw new Error(`Could not pack ${pkg.name}`);
  const hash = createHash("sha256")
    .update(readFileSync(path.join(output, file)))
    .digest("hex")
    .slice(0, 12);
  const immutable = file.replace(/\.tgz$/, `-${hash}.tgz`);
  copyFileSync(path.join(output, file), path.join(output, immutable));
  manifest[pkg.name] = immutable;
}
writeJson(path.join(output, "manifest.json"), manifest);
registerPackages(path.join(output, "manifest.json"));
console.log("Local SDK packages registered. Create an app with legend create MyApp.");
