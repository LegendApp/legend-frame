const { makeMetroConfig } = require("expo-desktop-metro-config");
const { withDesktop } = require("@legend-apps/cli/src/metro.cjs");
const { withUniwindConfig } = require("uniwind/metro");

module.exports = withUniwindConfig(withDesktop(makeMetroConfig(__dirname)), {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
});
