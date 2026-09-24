// Expo Desktop's Apple autolinker runs as ios; its Podfile opts into AppKit.
module.exports = { dependency: { platforms: {
  ios: process.env.SPARK_DESKTOP_AUTOLINK === "macos" ? {} : null,
  android: null,
} } };
