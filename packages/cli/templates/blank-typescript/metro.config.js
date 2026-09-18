const { makeMetroConfig } = require("expo-desktop-metro-config");
const { withDesktop } = require("@legendapp/frame-cli/src/metro.cjs");
module.exports = withDesktop(makeMetroConfig(__dirname));
