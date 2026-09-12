const { makeMetroConfig } = require("expo-desktop-metro-config");
const { gate } = require("@legend-apps/cli/src/metro-gate.cjs");
const config = makeMetroConfig(__dirname);
config.server = { ...config.server, enhanceMiddleware: (middleware) => gate(__dirname, middleware) };
module.exports = config;
