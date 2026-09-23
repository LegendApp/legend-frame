const { makeMetroConfig } = require("expo-desktop-metro-config");
const { withDesktop } = require("@legendapp/spark/metro");
module.exports = withDesktop(makeMetroConfig(__dirname), { watch: false });
