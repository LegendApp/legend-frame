// @ts-ignore JavaScript build utility shared with the Node launcher.
import { buildCLI } from "./build-node.mjs";
import { spawnProcess } from "../packages/cli/src/process.ts";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";

/** One published archive; native modules retain private identities for codegen and pruning. */
export async function packSpark(root: string, output: string) {
  buildCLI(root);
  const req = createRequire(path.join(root, "packages/cli/package.json"));
  const npm = path.join(path.dirname(req.resolve("npm/package.json")), "bin/npm-cli.js");
  const temporary = mkdtempSync(path.join(os.tmpdir(), "spark-package-"));
  const stage = path.join(temporary, "spark");
  const archives = path.join(temporary, "archives");
  mkdirSync(archives);
  mkdirSync(output, { recursive: true });
  // AppleDouble root entries break Yarn Classic's strip-one-component extractor.
  async function command(argv: string[], cwd: string) {
    const child = spawnProcess(argv, { cwd, env: { ...process.env, COPYFILE_DISABLE: "1" }, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code) throw new Error(`${argv[0]} failed: ${stderr}\n${stdout}`);
    return stdout;
  }
  async function pack(directory: string) {
    const result = JSON.parse(await command([process.execPath, npm, "pack", "--json", "--ignore-scripts", "--cache", path.join(temporary, "npm-cache"), "--pack-destination", archives], directory));
    return path.join(archives, result[0].filename);
  }
  async function unpack(archive: string, destination: string) {
    mkdirSync(destination, { recursive: true });
    await command(["tar", "-xzf", archive, "--strip-components=1", "-C", destination], root);
  }
  try {
    const directories = readdirSync(path.join(root, "packages")).filter(name => existsSync(path.join(root, "packages", name, "package.json"))).sort();
    const packages = directories.map(directory => ({ directory, json: JSON.parse(readFileSync(path.join(root, "packages", directory, "package.json"), "utf8")) }));
    const publicPackage = packages.find(pkg => pkg.json.name === "@legendapp/spark")!;
    await unpack(await pack(path.join(root, "packages", publicPackage.directory)), stage);
    const manifest = JSON.parse(readFileSync(path.join(stage, "package.json"), "utf8"));
    const bundled = packages.filter(pkg => pkg !== publicPackage);
    if (bundled.some(pkg => pkg.json.private !== true)) throw new Error("Implementation packages must be private");
    const names = new Set(packages.map(pkg => pkg.json.name));
    const external: Record<string, string> = {};
    const peers: Record<string, string> = {};
    const requiredPeers = new Set<string>();
    for (const pkg of packages) {
      for (const [name, version] of Object.entries(pkg.json.peerDependencies ?? {}) as [string, string][]) {
        if (!names.has(name)) {
          if (peers[name] && peers[name] !== version) throw new Error(`Conflicting peer dependency ${name}`);
          peers[name] = version;
          if (!pkg.json.peerDependenciesMeta?.[name]?.optional) requiredPeers.add(name);
        }
      }
      for (const [name, version] of Object.entries(pkg.json.dependencies ?? {}) as [string, string][]) {
        if (!names.has(name)) {
          if (external[name] && external[name] !== version) throw new Error(`Conflicting dependency ${name}: ${external[name]} / ${version}`);
          external[name] = version;
        }
      }
    }
    for (const pkg of bundled) {
      const destination = path.join(stage, "node_modules", pkg.json.name);
      await unpack(await pack(path.join(root, "packages", pkg.directory)), destination);
    }
    manifest.dependencies = { ...external, ...Object.fromEntries(bundled.map(pkg => [pkg.json.name, pkg.json.version])) };
    manifest.bundledDependencies = bundled.map(pkg => pkg.json.name);
    manifest.peerDependencies = peers;
    manifest.peerDependenciesMeta = Object.fromEntries(Object.keys(peers).filter(name => !requiredPeers.has(name)).map(name => [name, { optional: true }]));
    writeFileSync(path.join(stage, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
    const archive = await pack(stage);
    // npm needs dependency edges to collect bundled files, but Bun attempts to
    // fetch those private names when installing. Keep the bundle list and files
    // while exposing only third-party registry dependencies in the final archive.
    const final = path.join(temporary, "final");
    const contents = path.join(final, "package");
    await unpack(archive, contents);
    manifest.dependencies = external;
    writeFileSync(path.join(contents, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
    await command(["tar", "-czf", archive, "-C", final, "package"], root);
    const bytes = readFileSync(archive);
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 12);
    const file = `legendapp-spark-${manifest.version}-${hash}.tgz`;
    cpSync(archive, path.join(output, file));
    return file;
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
