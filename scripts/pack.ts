import { mkdirSync, readFileSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { writeJson, readJson } from "../packages/cli/src/project.ts";

const root = path.resolve(import.meta.dir, "..");
const output = path.join(root, "artifacts/packages");
mkdirSync(output, { recursive: true });
const packages = [
  "packages/file-dialog",
  "packages/native-menu",
  "packages/desktop-host",
  "packages/config-plugin",
  "packages/desktop",
  "packages/cli",
  "fixtures/native-greeting",
];
const manifest: Record<string, string> = {};
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
console.log(path.join(output, "manifest.json"));
