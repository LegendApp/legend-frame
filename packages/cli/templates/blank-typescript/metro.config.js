const { makeMetroConfig } = require("expo-desktop-metro-config");
const { withDesktop } = require("@legendapp/frame/metro");
module.exports = withDesktop(makeMetroConfig(__dirname));
