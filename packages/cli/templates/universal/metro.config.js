const { withUniwindConfig } = require("uniwind/metro");
const { metroConfig } = require("@legendapp/spark/universal");

module.exports = withUniwindConfig(metroConfig(__dirname), {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
});
