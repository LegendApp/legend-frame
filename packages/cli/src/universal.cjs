const fs = require("node:fs");
const { readConfig, statePath } = require("@legend-apps/desktop-config/config.cjs");

exports.nativeConfig = root => {
  const platform = readConfig(root).expo.platforms[0];
  const platforms = process.platform === "win32" ? {} : { windows: { npmPackageName: "react-native-windows" } };
  if (platform !== "macos") return { platforms };
  const file = statePath(root, "native-selection.json");
  const selection = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { included: [], excluded: [] };
  return { platforms, dependencies: Object.fromEntries([
    ...selection.included.map(p => [p.name, { root: p.root }]),
    ...selection.excluded.map(name => [name, { platforms: { ios: null, macos: null, android: null } }]),
  ]) };
};

exports.metroConfig = root => {
  const platform = readConfig(root).expo.platforms[0];
  if (platform === "ios" || platform === "android" || platform === "web") {
    return require(require.resolve("expo/metro-config", { paths: [root] })).getDefaultConfig(root);
  }
  const config = require(require.resolve("expo-desktop-metro-config", { paths: [root] })).makeMetroConfig(root);
  return require("./metro.cjs").withDesktop(config, { runtimes: false });
};
