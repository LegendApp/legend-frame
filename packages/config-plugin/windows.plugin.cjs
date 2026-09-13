const { statePath } = require("./config.cjs");
const fs = require('node:fs');
const path = require('node:path');

function patchHost(source, core, metadata) {
  source = source.replace(/\r\n/g, '\n').replace(/\n\/\/ BEGIN LEGEND CORE[\s\S]*?\/\/ END LEGEND CORE\n/g, '')
    .replace(/\n  \/\/ BEGIN LEGEND TITLE[\s\S]*?\/\/ END LEGEND TITLE\n/g, '')
    .replace(/\n  \/\/ BEGIN LEGEND CONNECTION[\s\S]*?\/\/ END LEGEND CONNECTION\n/g, '');
  const include = '#include "NativeModules.h"';
  const anchor = 'auto settings{reactNativeWin32App.ReactNativeHost().InstanceSettings()};';
  if (!source.includes(include) || !source.includes(anchor)) throw new Error('The pinned Windows host template changed; cannot install the Legend host hooks.');
  if (!['go', 'dev'].includes(metadata.mode) || !/^[a-f0-9]{64}$/.test(metadata.fingerprint)) throw new Error('Invalid Windows runtime build metadata');
  source = source.replace(include, `${include}\n// BEGIN LEGEND CORE\n${core.replace('__LEGEND_METADATA__', JSON.stringify(metadata))}\n// END LEGEND CORE\n`);
  source = source.replace(/appWindow\.Title\([^\n]+\);/, title => `${title}\n  // BEGIN LEGEND TITLE\n  const auto legendTitle = LegendWindowsEnv(L"LEGEND_PROJECT_NAME");\n  if (!legendTitle.empty()) appWindow.Title(legendTitle);\n  // END LEGEND TITLE\n`);
  return source.replace(anchor, `${anchor}\n  // BEGIN LEGEND CONNECTION\n  settings.SourceBundleHost(L"127.0.0.1");\n  settings.SourceBundlePort(LegendMetroPort());\n  // END LEGEND CONNECTION\n`);
}
module.exports = config => {
  const { withAppCpp } = require('expo-desktop-config-plugins');
  config = withAppCpp(config, mod => {
    const root = mod.modRequest.projectRoot;
    const metadata = JSON.parse(fs.readFileSync(statePath(root, 'windows-build-input.json', 'windows'), 'utf8'));
    mod.modResults.contents = patchHost(mod.modResults.contents, fs.readFileSync(require.resolve('@legend-apps/desktop-host/windows/runtime.inc'), 'utf8'), metadata);
    return mod;
  });
  const { withMod } = require('@expo/config-plugins');
  config = withMod(config, { platform: 'windows', mod: 'vcxproj', action: mod => {
    unpackagedApp(mod.modResults);
    return mod;
  }});
  return withMod(config, { platform: 'windows', mod: 'sln', action: mod => {
    mod.modResults.contents = withoutPackaging(mod.modResults.contents);
    return mod;
  }});
};
function withoutPackaging(source) {
  const guids = [];
  source = source.replace(/Project\([^\n]+\) = [^\n]*\.wapproj[^\n]*, "(\{[^}]+\})"\r?\n[\s\S]*?EndProject\r?\n/g, (_match, guid) => { guids.push(guid.toUpperCase()); return ''; });
  return source.split(/(?<=\n)/).filter(line => !guids.some(guid => line.toUpperCase().includes(guid))).join('');
}
module.exports.withoutPackaging = withoutPackaging;
module.exports.patchHost = patchHost;

function unpackagedApp(document) {
  const project = document.find(node => node.Project)?.Project;
  const globals = project?.find(node => node.PropertyGroup && node[':@']?.['@_Label'] === 'Globals')?.PropertyGroup;
  if (!globals) throw new Error('The pinned Windows app project has no Globals property group');
  // These apply only to the executable, never the autolinked library projects.
  for (const [key, value] of Object.entries({ WindowsPackageType: 'None', WindowsAppSDKSelfContained: 'true' })) {
    const existing = globals.find(node => key in node);
    if (existing) existing[key] = [{ '#text': value }];
    else globals.push({ [key]: [{ '#text': value }] });
  }
}
module.exports.unpackagedApp = unpackagedApp;
