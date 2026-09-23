const { withUniwindConfig } = require("uniwind/metro");
const { metroConfig } = require("@legendapp/frame/universal");

module.exports = withUniwindConfig(metroConfig(__dirname), {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
});
