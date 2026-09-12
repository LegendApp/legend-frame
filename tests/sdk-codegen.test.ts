import { expect, test } from "bun:test";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { selection, nativePackages, validateBuildModules } from "../packages/cli/src/project";
const root = path.resolve(import.meta.dir, "..");
const require = createRequire(import.meta.url);
const rnRequire = createRequire(require.resolve("react-native/package.json"));
const { combineSchemasInFileList } = rnRequire("@react-native/codegen/lib/cli/combine/combine-js-to-schema.js");
for (const directory of ["packages", "fixtures"]) for (const name of readdirSync(path.join(root, directory))) {
  const packageRoot = path.join(root, directory, name);
  const pkg = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  if (!pkg.codegenConfig) continue;
  test(`${pkg.name}: native specs generate Apple bindings for every declared provider`, () => {
    const schema = combineSchemasInFileList([path.join(packageRoot, pkg.codegenConfig.jsSrcsDir)], "ios", undefined, pkg.codegenConfig.name);
    for (const name of Object.keys(pkg.codegenConfig.ios.modulesProvider ?? {})) {
      const module: any = Object.values(schema.modules).find((entry: any) => entry.moduleName === name);
      expect(module).toBeDefined();
      // Names ending in Windows silently exclude Apple bindings, including macOS.
      expect(module.excludedPlatforms ?? []).not.toContain("iOS");
    }
    for (const name of Object.keys(pkg.codegenConfig.ios.componentProvider ?? {})) {
      expect(Object.values(schema.modules).some((entry: any) => entry.type === "Component" && entry.components[name])).toBe(true);
    }
    expect(readdirSync(packageRoot).some(name => name.endsWith(".podspec"))).toBe(true);
  });
}
test("SDK production selection retains host and only the imported capability pods", () => {
  const packages = nativePackages(root);
  const result = selection(packages, new Set(["@legend-apps/clipboard"]));
  expect(result.included.map(pkg => pkg.name)).toContain("@legend-apps/desktop-app");
  expect(result.included.map(pkg => pkg.name)).toContain("@legend-apps/clipboard");
  for (const name of ["desktop-windows", "desktop-links", "desktop-shortcuts", "file-dialog", "native-menu", "context-menu", "secure-storage", "file-system"])
    expect(result.excluded.map(pkg => pkg.name)).toContain(`@legend-apps/${name}`);
});
test("test-only modules cannot leak into Go or distribution binaries", () => {
  const packages = [{ name: "@legend-apps/sdk-test-driver", json: { legend: { testOnly: true } } }] as any;
  expect(() => validateBuildModules("go", packages)).toThrow("test fixture");
  expect(() => validateBuildModules("release", packages)).toThrow("Test-only");
  expect(() => validateBuildModules("dev", packages)).not.toThrow();
});
