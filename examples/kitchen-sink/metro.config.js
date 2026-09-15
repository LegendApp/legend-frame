const fs = require("node:fs");
const path = require("node:path");
const { makeMetroConfig } = require("expo-desktop-metro-config");
const { withDesktop } = require("@legend-apps/cli/src/metro.cjs");
const { withUniwindConfig } = require("uniwind/metro");

const marker = path.join(__dirname, ".legend/kitchen-sink.json");
const setup = fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker, "utf8")) : {};
const source = setup.mode === "live" ? setup.source : __dirname;
const config = makeMetroConfig(__dirname);
if (source !== __dirname) {
  config.watchFolders = [...new Set([...(config.watchFolders || []), source])];
  const resolveRequest = config.resolver?.resolveRequest;
  config.resolver = { ...config.resolver, resolveRequest(context, name, platform) {
    // Resolve dependencies from the installed consumer, avoiding a second React
    // or workspace-only packages when Metro follows the live source junction.
    if (context.originModulePath.startsWith(source + path.sep) && !name.startsWith(".") && !path.isAbsolute(name)) {
      context = { ...context, originModulePath: path.join(__dirname, "index.ts") };
    }
    return resolveRequest ? resolveRequest(context, name, platform) : context.resolveRequest(context, name, platform);
  } };
}
module.exports = withUniwindConfig(withDesktop(config), {
  cssEntryFile: path.relative(__dirname, path.join(source, "global.css")),
  dtsFile: "./uniwind-types.d.ts",
});
