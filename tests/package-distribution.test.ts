import { VERSION } from "../packages/cli/src/project.ts";
import { spawnProcess } from "../packages/cli/src/process.ts";
import { expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { packFrame } from "../scripts/pack-frame.ts";
import { installedPackages, nativePackages, selection, stateFile } from "../packages/cli/src/project.ts";

const framework = path.resolve(import.meta.dirname, "..");
test("single Frame archive resolves public exports and preserves private native discovery and pruning", async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "frame-public-package-"));
  try {
    const release = { schema: 1 as const, version: VERSION, revision: "a".repeat(40), packages: {}, runners: {} };
    const file = await packFrame(framework, root, release);
    // macOS AppleDouble root files make Yarn Classic recurse outside the
    // extraction directory after it strips the package prefix.
    const tooling = createRequire(path.join(framework, "packages/cli/package.json"));
    const tar = createRequire(tooling.resolve("npm/package.json"))("tar");
    const entries: string[] = [];
    tar.t({ file: path.join(root, file), sync: true, onReadEntry: (entry: { path: string }) => entries.push(entry.path) });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every(name => name.startsWith("package/") && !name.split("/").some(part => part.startsWith("._")))).toBe(true);
    const app = path.join(root, "consumer");
    const destination = path.join(app, "node_modules/@legendapp/frame");
    mkdirSync(destination, { recursive: true });
    const child = spawnProcess(["tar", "-xzf", path.join(root, file), "--strip-components=1", "-C", destination], { stdout: "pipe", stderr: "pipe" });
    expect(await child.exited).toBe(0);
    writeFileSync(path.join(app, "package.json"), JSON.stringify({ dependencies: { "@legendapp/frame": VERSION } }));
    writeFileSync(path.join(app, "desktop.config.json"), JSON.stringify({ name: "Packed", version: "1.0.0", projectId: "packed-test", macos: { bundleIdentifier: "org.example.packed" }, platforms: ["macos"] }));
    const req = createRequire(path.join(app, "package.json"));
    const manifest = req("@legendapp/frame/package.json");
    expect(JSON.parse(readFileSync(path.join(destination, "vendor/node_modules/@legendapp/frame-cli/dist/release.json"), "utf8"))).toEqual(release);
    const internal = readdirSync(path.join(framework, "packages")).map(name => JSON.parse(readFileSync(path.join(framework, "packages", name, "package.json"), "utf8"))).filter(pkg => pkg.name !== "@legendapp/frame");
    const normalized = await createRequire(tooling.resolve("npm/package.json"))("pacote").manifest(path.join(root, file), { cache: path.join(root, "registry-cache") });
    expect(normalized.bundleDependencies).toBeUndefined();
    expect(normalized.bundledDependencies).toBeUndefined();
    expect(Object.keys(normalized.dependencies).some(name => name.startsWith("@legendapp/frame-"))).toBe(false);
    expect(manifest.frame.bundledModuleRoot).toBe("vendor");
    expect(existsSync(path.join(destination, "node_modules"))).toBe(false);
    expect(readFileSync(path.join(destination, "config.d.cts"), "utf8")).toContain("./vendor/node_modules/");
    expect(manifest.frame.bundledModules.sort()).toEqual(internal.map(pkg => pkg.name).sort());
    expect(Object.keys(manifest.dependencies).some(name => name.startsWith("@legendapp/frame-"))).toBe(false);
    for (const directory of ["native-greeting", "sdk-test-driver"]) {
      const fixture = JSON.parse(readFileSync(path.join(framework, "fixtures", directory, "package.json"), "utf8"));
      expect(Object.keys(fixture.dependencies ?? {}).some(name => name.startsWith("@legendapp/frame-"))).toBe(false);
    }
    for (const pkg of internal) {
      expect(pkg.private).toBe(true);
      expect(existsSync(path.join(destination, "vendor/node_modules", pkg.name, "package.json"))).toBe(true);
    }
    for (const subpath of Object.keys(manifest.exports)) {
      expect(realpathSync(req.resolve(`@legendapp/frame/${subpath.slice(2)}`)).startsWith(realpathSync(destination) + path.sep)).toBe(true);
    }
    expect(req("@legendapp/frame/config").readConfig).toBeTypeOf("function");
    expect(req("@legendapp/frame/metro").withDesktop).toBeTypeOf("function");
    expect(req("@legendapp/frame/native").withFrameNative).toBeTypeOf("function");
    expect(req("@legendapp/frame/init-template").initializeTemplate).toBeTypeOf("function");
    expect(req("@legendapp/frame/schema.json")).toEqual(JSON.parse(readFileSync(path.join(framework, "packages/config-plugin/schema.json"), "utf8")));
    const graph = installedPackages(app);
    expect(graph.filter(pkg => pkg.name.startsWith("@legendapp/frame-")).map(pkg => pkg.name).sort()).toEqual(internal.map(pkg => pkg.name).sort());
    const native = nativePackages(app);
    const menus = native.find(pkg => pkg.name === "@legendapp/frame-native-menu")!;
    expect(menus.root.startsWith(realpathSync(destination) + "/vendor/node_modules/")).toBe(true);
    expect(menus.json.codegenConfig).toBeDefined();
    const selected = selection(native, new Set([menus.name]));
    expect(selected.included.map(pkg => pkg.name)).toContain(menus.name);
    expect(selected.excluded.map(pkg => pkg.name)).toContain("@legendapp/frame-file-system");
    writeFileSync(path.join(app, "desktop.config.json"), JSON.stringify({ name: "Packed", version: "1.0.0", projectId: "packed-test", platforms: ["windows"] }));
    const windows = nativePackages(app);
    const selectionFile = stateFile(app, "native-selection.json");
    mkdirSync(path.dirname(selectionFile), { recursive: true });
    writeFileSync(selectionFile, JSON.stringify({ included: windows.map(pkg => ({ name: pkg.name, root: pkg.root })), excluded: [] }));
    const config = req("@legendapp/frame/universal").nativeConfig(app);
    expect(config.dependencies[menus.name].root).toBe(menus.root);
    for (const template of ["blank-typescript", "windows", "universal"]) {
      const pkg = JSON.parse(readFileSync(path.join(destination, "vendor/node_modules/@legendapp/frame-cli/templates", template, "package.json"), "utf8"));
      expect(Object.keys(pkg.dependencies).filter(name => name.startsWith("@legendapp/frame"))).toEqual(["@legendapp/frame"]);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 120_000);
