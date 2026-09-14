// Exercise the real patched Expo key dispatcher without starting Metro/native builds.
const path = require('node:path');
const { createRequire } = require('node:module');
const expo = createRequire(require.resolve('expo/package.json'));
const cli = path.dirname(expo.resolve('@expo/cli/package.json'));
const fromCLI = name => require(path.join(cli, 'build/src', name));
const { KeyPressHandler } = fromCLI('start/interface/KeyPressHandler.js');
const { startInterfaceAsync } = fromCLI('start/interface/startInterface.js');
const extension = require('../../packages/cli/src/expo-dev-extension.cjs');

async function main() {
  // Simulate the macOS terminal on any test host; no OS launchers are invoked.
  Object.defineProperty(process, 'platform', { value: 'darwin' });
  const received = new Promise(resolve => process.once('message', resolve));
  process.send({ type: 'test:ready' });
  await received;
  let keys;
  KeyPressHandler.prototype.startInterceptingKeyStrokes = function() { keys = this; };
  const broadcasts = [];
  await startInterfaceAsync({
    options: { devClient: false },
    getNativeDevServerPort: () => undefined,
    getDefaultDevServer: () => ({ isTargetingNative: () => true }),
    broadcastMessage: message => broadcasts.push(message),
  }, { platforms: ['macos'] });
  console.log('VERBOSE_COMMANDS');
  await keys.handleKeypress('?');
  console.log('END_COMMANDS');
  for (const key of ['r', 'm', 'd', 'g', 'b', 'r']) await keys.handleKeypress(key);
  console.log(JSON.stringify({ broadcasts, target: extension.commands()[0].msg }));
  process.disconnect();
}
main().catch(error => { console.error(error); process.exit(1); });
