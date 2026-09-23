import { expect, test } from "bun:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const root = path.resolve(import.meta.dir, "..");
const require = createRequire(import.meta.url);
test("public frame package exposes the CLI and component entry points", () => {
  const pkg = JSON.parse(readFileSync(path.join(root, "packages/desktop/package.json"), "utf8"));
  expect(pkg.name).toBe("@legendapp/frame");
  expect(pkg.bin.frame).toBe("bin/frame.cjs");
  for (const entry of ["./ui", "./ui/uniwind", "./audio", "./auth-session", "./files", "./windows"]) {
    expect(existsSync(require.resolve(`@legendapp/frame/${entry.slice(2)}`))).toBe(true);
  }
  const command = Bun.spawnSync(["node", path.join(root, "packages/desktop/bin/frame.cjs"), "--help"], { cwd: root });
  expect(command.exitCode).toBe(0);
  expect(command.stdout.toString()).toContain("Legend Frame");
  expect(command.stdout.toString()).toContain("frame create MyApp");
});
test("framework packages and generated commands use frame names", () => {
  for (const directory of readdirSync(path.join(root, "packages"))) {
    const pkg = JSON.parse(readFileSync(path.join(root, "packages", directory, "package.json"), "utf8"));
    expect(pkg.name === "@legendapp/frame" || pkg.name.startsWith("@legendapp/frame-")).toBe(true);
    expect(pkg.legend).toBeUndefined();
    for (const name of Object.keys(pkg.dependencies ?? {})) expect(name.startsWith("@legend-apps/")).toBe(false);
  }
  for (const template of ["blank-typescript", "windows", "universal"]) {
    const pkg = JSON.parse(readFileSync(path.join(root, "packages/cli/templates", template, "package.json"), "utf8"));
    expect(pkg.scripts.dev).toBe("frame dev");
    expect(pkg.scripts.postinstall).toBe("node node_modules/@legendapp/frame/init-template.cjs");
  }
});

test("renamed Windows projects reference existing local source and resource files", () => {
  let projects = 0;
  for (const base of ["packages", "fixtures", "patches"]) {
    for (const file of new Bun.Glob("**/*.vcxproj").scanSync({ cwd: path.join(root, base), onlyFiles: true })) {
      if (file.includes("node_modules/")) continue;
      projects++;
      const project = path.join(root, base, file);
      const source = readFileSync(project, "utf8");
      for (const match of source.matchAll(/<(?:ClCompile|ClInclude|ResourceCompile|Midl) Include="([^"]+)"/g)) {
        const relative = match[1]!;
        if (relative.includes("$") || relative.includes("*")) continue;
        expect(existsSync(path.resolve(path.dirname(project), relative.replaceAll("\\", "/")))).toBe(true);
      }
    }
  }
  expect(projects).toBeGreaterThanOrEqual(18);
});
