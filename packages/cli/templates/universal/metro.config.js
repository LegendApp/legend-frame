const { withUniwindConfig } = require("uniwind/metro");
const { metroConfig } = require("@legendapp/frame-cli/src/universal.cjs");

module.exports = withUniwindConfig(metroConfig(__dirname), {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
});
