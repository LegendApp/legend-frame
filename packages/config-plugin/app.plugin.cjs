const fs = require("node:fs");
const path = require("node:path");
const {
  withAppDelegate,
  withPodfile,
  withInfoPlist,
} = require("expo-desktop-config-plugins");

module.exports = function withLegendDesktop(config) {
  config = withAppDelegate(config, (mod) => {
    // Own this adapter; application customizations belong in configuration/plugins.
    mod.modResults.contents = fs.readFileSync(
      require.resolve("@legend-apps/desktop-host/AppDelegate.mm"),
      "utf8",
    );
    return mod;
  });
  config = withInfoPlist(config, (mod) => {
    mod.modResults.LegendFrameworkVersion = "0.1.0-prototype.0";
    mod.modResults.NSAppTransportSecurity = { NSAllowsLocalNetworking: true };
    return mod;
  });
  return withPodfile(config, (mod) => {
    const marker = "# Legend: Fabric enabled";
    if (!mod.modResults.contents.includes(marker)) {
      mod.modResults.contents = `${marker}\nENV['RCT_NEW_ARCH_ENABLED'] = '1'\n${mod.modResults.contents}`;
    }
    return mod;
  });
};
