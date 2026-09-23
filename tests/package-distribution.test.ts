import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { packSpark } from "../scripts/pack-spark";
import { installedPackages, nativePackages, selection, stateFile } from "../packages/cli/src/project";

const framework = path.resolve(import.meta.dir, "..");
test("single Frame archive resolves public exports and preserves private native discovery and pruning", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "spark-public-package-"));
  try {
    const file = await packSpark(framework, root);
    // macOS AppleDouble root files make Yarn Classic recurse outside the
    // extraction directory after it strips the package prefix.
    const tooling = createRequire(path.join(framework, "packages/cli/package.json"));
    const tar = createRequire(tooling.resolve("npm/package.json"))("tar");
    const entries: string[] = [];
    tar.t({ file: path.join(root, file), sync: true, onReadEntry: (entry: { path: string }) => entries.push(entry.path) });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(name => name.startsWith("package/") && !name.split("/").some(part => part.startsWith("._")))).toBe(true);
    const app = path.join(root, "consumer");
    const destination = path.join(app, "node_modules/@legendapp/spark");
    mkdirSync(destination, { recursive: true });
    const child = Bun.spawn(["tar", "-xzf", path.join(root, file), "--strip-components=1", "-C", destination], { stdout: "pipe", stderr: "pipe" });
    expect(await child.exited).toBe(0);
    writeFileSync(path.join(app, "package.json"), JSON.stringify({ dependencies: { "@legendapp/spark": "0.1.0-prototype.0" } }));
    writeFileSync(path.join(app, "desktop.config.json"), JSON.stringify({ name: "Packed", version: "1.0.0", projectId: "packed-test", macos: { bundleIdentifier: "org.example.packed" }, platforms: ["macos"] }));
    const req = createRequire(path.join(app, "package.json"));
    const manifest = req("@legendapp/spark/package.json");
    const internal = readdirSync(path.join(framework, "packages")).map(name => JSON.parse(readFileSync(path.join(framework, "packages", name, "package.json"), "utf8"))).filter(pkg => pkg.name !== "@legendapp/spark");
    expect(manifest.bundledDependencies.sort()).toEqual(internal.map(pkg => pkg.name).sort());
    expect(Object.keys(manifest.dependencies).some(name => name.startsWith("@legendapp/spark-"))).toBe(false);
    for (const directory of ["native-greeting", "sdk-test-driver"]) {
      const fixture = JSON.parse(readFileSync(path.join(framework, "fixtures", directory, "package.json"), "utf8"));
      expect(Object.keys(fixture.dependencies ?? {}).some(name => name.startsWith("@legendapp/spark-"))).toBe(false);
    }
    for (const pkg of internal) {
      expect(pkg.private).toBe(true);
      expect(existsSync(path.join(destination, "node_modules", pkg.name, "package.json"))).toBe(true);
    }
    for (const subpath of Object.keys(manifest.exports)) {
      expect(realpathSync(req.resolve(`@legendapp/spark/${subpath.slice(2)}`)).startsWith(realpathSync(destination) + path.sep)).toBe(true);
    }
    expect(req("@legendapp/spark/config").readConfig).toBeFunction();
    expect(req("@legendapp/spark/metro").withDesktop).toBeFunction();
    expect(req("@legendapp/spark/native").withSparkNative).toBeFunction();
    expect(req("@legendapp/spark/init-template").initializeTemplate).toBeFunction();
    expect(req("@legendapp/spark/schema.json")).toEqual(JSON.parse(readFileSync(path.join(framework, "packages/config-plugin/schema.json"), "utf8")));
    const graph = installedPackages(app);
    expect(graph.filter(pkg => pkg.name.startsWith("@legendapp/spark-")).map(pkg => pkg.name).sort()).toEqual(internal.map(pkg => pkg.name).sort());
    const native = nativePackages(app);
    const menus = native.find(pkg => pkg.name === "@legendapp/spark-native-menu")!;
    expect(menus.root.startsWith(realpathSync(destination) + "/node_modules/")).toBe(true);
    expect(menus.json.codegenConfig).toBeDefined();
    const selected = selection(native, new Set([menus.name]));
    expect(selected.included.map(pkg => pkg.name)).toContain(menus.name);
    expect(selected.excluded.map(pkg => pkg.name)).toContain("@legendapp/spark-file-system");
    writeFileSync(path.join(app, "desktop.config.json"), JSON.stringify({ name: "Packed", version: "1.0.0", projectId: "packed-test", platforms: ["windows"] }));
    const windows = nativePackages(app);
    const selectionFile = stateFile(app, "native-selection.json");
    mkdirSync(path.dirname(selectionFile), { recursive: true });
    writeFileSync(selectionFile, JSON.stringify({ included: windows.map(pkg => ({ name: pkg.name, root: pkg.root })), excluded: [] }));
    const config = req("@legendapp/spark/universal").nativeConfig(app);
    expect(config.dependencies[menus.name].root).toBe(menus.root);
    for (const template of ["blank-typescript", "windows", "universal"]) {
      const pkg = JSON.parse(readFileSync(path.join(destination, "node_modules/@legendapp/spark-cli/templates", template, "package.json"), "utf8"));
      expect(Object.keys(pkg.dependencies).filter(name => name.startsWith("@legendapp/spark"))).toEqual(["@legendapp/spark"]);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);
