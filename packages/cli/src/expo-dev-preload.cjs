const Module = require('node:module');
const { preparePatch } = require('./expo-dev-patch.cjs');

// Node forks inherit --require, including Metro transform workers. Only the
// top-level Expo process may attach to the Legend supervisor's IPC channel.
if (!process.env.LEGEND_EXPO_PRELOADED) {
  process.env.LEGEND_EXPO_PRELOADED = '1';
  if (!process.send) throw new Error('Start the Legend Expo integration through legend dev.');
  const patches = preparePatch(process.cwd());
  const load = Module._extensions['.js'];
  Module._extensions['.js'] = function(module, filename) {
    const source = patches.get(filename);
    if (source === undefined) return load(module, filename);
    patches.delete(filename);
    if (!patches.size) Module._extensions['.js'] = load;
    module._compile(source, filename);
  };
  require('./expo-dev-extension.cjs');
}
