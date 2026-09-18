import { expect, test } from "bun:test";
import { createRequire } from "node:module";
import { goConfigurationIssues } from "../packages/cli/src/project";
const { identity } = createRequire(import.meta.url)("../packages/config-plugin/identity.cjs");
test("CNG embeds stable project identity and deduplicated URL associations", () => {
  const result = identity({ extra: { frame: { projectId: "project-uuid" } }, scheme: ["demo", "demo", "demo-auth"] });
  expect(result.FrameProjectIdentifier).toBe("project-uuid");
  expect(result.NSSupportsAutomaticTermination).toBe(false); expect(result.NSSupportsSuddenTermination).toBe(false); expect(result.CFBundleURLTypes[0].CFBundleURLSchemes).toEqual(["demo", "demo-auth"]);
});
test("legacy projects use bundle identifier without name-based collisions", () => {
  expect(identity({ macos: { bundleIdentifier: "test.app" } }).FrameProjectIdentifier).toBe("test.app");
  expect(() => identity({})).toThrow("projectId");
});
test("document associations use declared UTIs and conservative handler rank", () => {
  const result = identity({ macos: { bundleIdentifier: "test.app" }, extra: { frame: { documentTypes: [{ name: "Text", contentTypes: ["public.plain-text"], role: "Viewer" }] } } });
  expect(result.CFBundleDocumentTypes).toEqual([{ CFBundleTypeName: "Text", CFBundleTypeRole: "Viewer", LSItemContentTypes: ["public.plain-text"], LSHandlerRank: "Alternate" }]);
});
test("invalid schemes and documents fail prebuild with useful errors", () => {
  for (const scheme of ["https:", "1invalid", "a b"]) expect(() => identity({ macos: { bundleIdentifier: "test" }, scheme })).toThrow("scheme");
  for (const document of [{ name: "Text", contentTypes: [] }, { name: "Text", contentTypes: ["txt"] }, { name: "Text", contentTypes: ["public.text"], role: "Owner" }]) expect(() => identity({ macos: { bundleIdentifier: "test" }, extra: { frame: { documentTypes: [document] } } })).toThrow();
});
test("Go allows identity, but URL and document registration needs a custom host", () => {
  expect(goConfigurationIssues({ expo: { extra: { frame: { projectId: "stable" } } } })).toEqual([]);
  expect(goConfigurationIssues({ expo: { scheme: "demo" } })).toHaveLength(1);
  expect(goConfigurationIssues({ expo: { extra: { frame: { documentTypes: [{ name: "Text", contentTypes: ["public.text"] }] } } } })).toHaveLength(1);
});

test("menu-bar-only apps hide the Dock and require a custom runtime", () => {
  const config = { macos: { bundleIdentifier: "test.tray" }, extra: { frame: { menuBarOnly: true } } };
  expect(identity(config)).toMatchObject({ LSUIElement: true, FrameMenuBarOnly: true });
  expect(identity({ ...config, extra: {} })).toMatchObject({ LSUIElement: false, FrameMenuBarOnly: false });
  expect(goConfigurationIssues(config)).toContain("Menu-bar-only activation requires a custom runtime");
  expect(() => identity({ ...config, extra: { frame: { menuBarOnly: "yes" } } })).toThrow("boolean");
});
