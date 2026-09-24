// Standalone bootstrap, copied into SDK bundles. Requires Bun; no framework checkout.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
const root = import.meta.dir;
const metadata = JSON.parse(readFileSync(path.join(root, "sdk.json"), "utf8"));
const actual: Record<string, string> = {};
function visit(relative: string) {
  const file = path.join(root, relative), stat = lstatSync(file);
  if (stat.isDirectory()) for (const name of readdirSync(file).sort()) visit(path.join(relative, name));
  else {
    let content: string | Buffer;
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(file);
      if (!path.resolve(path.dirname(file), target).startsWith(root + path.sep)) throw new Error("SDK symlink escapes bundle");
      content = `symlink:${target}`;
    } else if (stat.isFile()) content = readFileSync(file);
    else throw new Error("Unsupported SDK file");
    actual[relative.replaceAll(path.sep, "/")] = createHash("sha256").update(content).digest("hex");
  }
}
for (const name of ["packages", "runtimes"]) if (existsSync(path.join(root, name))) visit(name);
if (metadata.schema !== 1 || JSON.stringify(actual) !== JSON.stringify(metadata.sha256)) throw new Error("SDK checksum mismatch");
const manifest = JSON.parse(readFileSync(path.join(root, "packages/manifest.json"), "utf8"));
const overrides: Record<string, string> = {};
for (const [name, file] of Object.entries(manifest)) {
  if (typeof file !== "string" || path.basename(file) !== file || !actual[`packages/${file}`]) throw new Error("Invalid SDK manifest");
  overrides[name] = path.join(root, "packages", file);
}
if (!overrides["@legendapp/spark-cli"]) throw new Error("SDK has no CLI");
const tooling = path.join(root, ".cli");
mkdirSync(tooling, { recursive: true });
writeFileSync(path.join(tooling, "package.json"), JSON.stringify({ name: "spark-sdk-tools", private: true, dependencies: { "@legendapp/spark-cli": overrides["@legendapp/spark-cli"] }, overrides }, null, 2));
const install = Bun.spawn(["bun", "install"], { cwd: tooling, stdout: "inherit", stderr: "inherit" });
if (await install.exited) throw new Error("SDK CLI installation failed");
const cli = path.join(tooling, "node_modules/@legendapp/spark-cli/src/index.ts");
const register = Bun.spawn(["bun", cli, "sdk", "import", root], { cwd: root, stdout: "inherit", stderr: "inherit" });
if (await register.exited) throw new Error("SDK registration failed");
console.log(`SDK installed. Keep this directory in place.\nCreate an app: bun ${JSON.stringify(cli)} create MyApp --universal`);
