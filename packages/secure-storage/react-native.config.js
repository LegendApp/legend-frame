// Expo Desktop currently invokes the Apple autolinker with --platform ios.
// Its generated Podfile identifies macOS explicitly; ordinary iOS apps use Expo backends.
module.exports = { dependency: { platforms: {
  ios: process.env.LEGEND_DESKTOP_AUTOLINK === "macos" ? {} : null,
  android: null,
} } };
