const { statePath } = require("./config.cjs");
const fs = require('node:fs');
const path = require('node:path');

function patchHost(source, core, metadata, defaults = {}) {
  source = source.replace(/\r\n/g, '\n').replace(/\n\/\/ BEGIN LEGEND CORE[\s\S]*?\/\/ END LEGEND CORE\n/g, '')
    .replace(/\n  \/\/ BEGIN LEGEND TITLE[\s\S]*?\/\/ END LEGEND TITLE\n/g, '')
    .replace(/\n  \/\/ BEGIN LEGEND CONNECTION[\s\S]*?\/\/ END LEGEND CONNECTION\n/g, '');
  const include = '#include "NativeModules.h"';
  const launchAnchor = 'winrt::init_apartment(winrt::apartment_type::single_threaded);';
  const anchor = 'auto settings{reactNativeWin32App.ReactNativeHost().InstanceSettings()};';
  if (!source.includes(include) || !source.includes(anchor) || !source.includes(launchAnchor) || (!source.includes("LegendWin::Initialize(reactNativeWin32App);") && !/appWindow\.Resize\([^\n]+\);/.test(source))) throw new Error('The pinned Windows host template changed; cannot install the Legend host hooks.');
  if (!['go', 'dev'].includes(metadata.mode) || !/^[a-f0-9]{64}$/.test(metadata.fingerprint)) throw new Error('Invalid Windows runtime build metadata');
  source = source.replace(/appWindow\.Title\([^\n]+\);/, title => `${title}\n  // BEGIN LEGEND TITLE\n  const auto legendTitle = LegendWindowsEnv(L"LEGEND_PROJECT_NAME");\n  if (!legendTitle.empty()) appWindow.Title(legendTitle);\n  // END LEGEND TITLE\n`);
  source = source.replace('LegendWin::Initialize(reactNativeWin32App);', 'appWindow.Resize({1000, 1000});');
  source = source.replace(/appWindow\.Resize\([^\n]+\);/, 'LegendWin::Initialize(reactNativeWin32App);');
  source = source.replace(/\n  \/\/ BEGIN LEGEND LAUNCH[\s\S]*?\/\/ END LEGEND LAUNCH\n/g, '');
  source = source.replace('winrt::init_apartment(winrt::apartment_type::single_threaded);', 'winrt::init_apartment(winrt::apartment_type::single_threaded);\n  // BEGIN LEGEND LAUNCH\n  try { LegendInitializeEnvironment(); if (LegendWin::ForwardLaunch()) return 0; }\n  catch (winrt::hresult_error const &error) { MessageBoxW(nullptr, error.message().c_str(), L"Legend launch failed", MB_OK | MB_ICONERROR); return 1; }\n  // END LEGEND LAUNCH\n');
  source = source.replace(anchor, `${anchor}\n  // BEGIN LEGEND CONNECTION\n  settings.SourceBundleHost(L"127.0.0.1");\n  settings.SourceBundlePort(LegendMetroPort());\n  // END LEGEND CONNECTION\n`);
  // Only patch the upstream template. Embedded host source can contain the same
  // API calls and must never be matched by these template replacements.
  return source.replace(include, `${include}\n// BEGIN LEGEND CORE\n${core.replace('__LEGEND_METADATA__', JSON.stringify(metadata)).replace('__LEGEND_PROJECT_CONFIG__', JSON.stringify({ ...defaults, LEGEND_RUNTIME_MODE: metadata.mode }).replaceAll(')', '\\u0029'))}\n// END LEGEND CORE\n`);
}
module.exports = config => {
  const { withAppCpp } = require('expo-desktop-config-plugins');
  config = withAppCpp(config, mod => {
    const root = mod.modRequest.projectRoot;
    const metadata = JSON.parse(fs.readFileSync(statePath(root, 'windows-build-input.json', 'windows'), 'utf8'));
    const { expo } = require('./config.cjs').readConfig(root);
    const defaults = metadata.mode === 'dev' ? {
      LEGEND_PROJECT_ID: expo.extra.legend.projectId, LEGEND_PROJECT_NAME: expo.name,
      LEGEND_PROJECT_VERSION: expo.version, LEGEND_WINDOW_CONFIG: JSON.stringify(expo.extra.legend.window ?? {}),
      LEGEND_SESSION_FILE: statePath(root, 'session.json', 'windows'),
    } : {};
    mod.modResults.contents = patchHost(mod.modResults.contents, fs.readFileSync(require.resolve('@legend-apps/desktop-host/windows/runtime.inc'), 'utf8') + '\n' + fs.readFileSync(require.resolve('@legend-apps/desktop-host/windows/application.inc'), 'utf8'), metadata, defaults);
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
