const { makeMetroConfig } = require("expo-desktop-metro-config");
const { withDesktop } = require("@legend-apps/cli/src/metro.cjs");
module.exports = withDesktop(makeMetroConfig(__dirname), { watch: false });
