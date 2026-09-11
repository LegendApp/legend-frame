const fs = require("node:fs");
const path = require("node:path");
const {
  withAppDelegate,
  withPodfile,
  withInfoPlist,
  withEntitlementsPlist,
} = require("expo-desktop-config-plugins");
const { resolveEntitlements } = require("./entitlements.cjs");

module.exports = function withLegendDesktop(config) {
  // The upstream base mod merges template entitlements into config before
  // callbacks run. Capture the declared values before that mutation.
  const declaredEntitlements = structuredClone(config.macos?.entitlements ?? {});
  config = withEntitlementsPlist(config, (mod) => {
    const selection = path.join(mod.modRequest.projectRoot, ".legend/native-selection.json");
    const packages = fs.existsSync(selection)
      ? JSON.parse(fs.readFileSync(selection, "utf8")).included.map((pkg) => JSON.parse(fs.readFileSync(path.join(pkg.root, "package.json"), "utf8")))
      : [];
    // Own the generated entitlements; the desktop template's sandbox defaults
    // are not the framework's direct-distribution policy.
    mod.modResults = resolveEntitlements({ macos: { entitlements: declaredEntitlements } }, packages);
    return mod;
  });
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
