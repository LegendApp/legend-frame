import { expect, test } from "bun:test";
import { composeExport, composeMetro } from "../packages/cli/src/add-desktop";
import { createRequire } from "node:module";
const { withLegendNative } = createRequire(import.meta.url)("../packages/cli/src/expo-native.cjs");
const { withLegendExpo } = createRequire(import.meta.url)("../packages/config-plugin/expo.cjs");

test("compose config expressions without moving imports or changing application logic", () => {
  const source = 'import type { ConfigContext } from "expo/config";\nconst suffix = "dev";\nexport default ({ config }: ConfigContext) => ({ ...config, name: suffix });\n';
  const composed = composeExport(source, "app.config.ts", "adapter", "wrap");
  expect(composed).toContain('import type { ConfigContext } from "expo/config";');
  expect(composed).toContain('export default require("adapter").wrap(({ config }: ConfigContext) => ({ ...config, name: suffix }), __dirname);');
  expect(composeExport(composed, "app.config.ts", "adapter", "wrap")).toBe(composed);
  expect(() => composeExport('export { config as default } from "./config";', "app.config.ts", "adapter", "wrap")).toThrow("Cannot safely compose");
});
test("Metro composition preserves custom settings and is idempotent", () => {
  const source = 'const { getDefaultConfig } = require("expo/metro-config");\nconst config = getDefaultConfig(__dirname);\nconfig.resolver.sourceExts.push("custom");\nmodule.exports = config;';
  const composed = composeMetro(source, "metro.config.js");
  expect(composed).toContain('require("@legend-apps/cli/src/expo-metro.cjs")');
  expect(composed).toContain('config.resolver.sourceExts.push("custom")');
  expect(composeMetro(composed, "metro.config.js")).toBe(composed);
  expect(() => composeMetro("module.exports = {};", "metro.config.js")).toThrow("getDefaultConfig");
});
test("Expo and native wrappers leave mobile and default Expo commands unchanged", () => {
  const previous = process.env.LEGEND_PLATFORM;
  try {
    const base = { name: "Existing", platforms: ["ios", "android", "web"], extra: { retained: true } };
    const native = { dependencies: { example: { platforms: { ios: null } } }, assets: ["./fonts"] };
    for (const target of [undefined, "ios", "android", "web"]) {
      if (target) process.env.LEGEND_PLATFORM = target; else delete process.env.LEGEND_PLATFORM;
      expect(withLegendExpo(({ config }: any) => config, "/unused")({ config: base })).toBe(base);
      expect(withLegendNative(native, "/unused")).toBe(native);
    }
  } finally { if (previous === undefined) delete process.env.LEGEND_PLATFORM; else process.env.LEGEND_PLATFORM = previous; }
});
