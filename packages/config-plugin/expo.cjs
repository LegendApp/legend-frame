const fs = require('node:fs');
const path = require('node:path');

// Existing Expo projects keep their Expo configuration as the source of truth.
// Only an explicitly selected desktop command applies the Legend overlay.
function withLegendExpo(original, root) {
  return context => {
    const base = typeof original === 'function' ? original(context) : original;
    const target = process.env.LEGEND_PLATFORM;
    const development = process.env.LEGEND_DEV_SESSION === '1';
    if (!development && target !== 'macos' && target !== 'windows') return base;
    const { extends: source, ...desktop } = JSON.parse(fs.readFileSync(path.join(root, 'desktop.config.json'), 'utf8'));
    if (source !== 'expo') throw new Error('Expected an Expo-owned desktop configuration');
    const { toExpo, applySelection, developmentConfig } = require('./config.cjs');
    const value = {
      ...desktop,
      name: base.name,
      version: base.version ?? '1.0.0',
      expo: { ...base, ...desktop.expo },
      macos: { ...base.macos, ...desktop.macos },
    };
    if (development) return developmentConfig(value, target);
    return applySelection(root, toExpo(value, target).expo);
  };
}
module.exports = { withLegendExpo };
