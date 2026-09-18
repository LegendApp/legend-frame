const { validateWindow } = require("@legendapp/frame-window-options");
const { updatePlist } = require("./updates.cjs");
function identity(config) {
  const projectId = config.extra?.frame?.projectId ?? config.macos?.bundleIdentifier;
  if (typeof projectId !== "string" || !projectId.length || projectId.length > 200) throw new Error("Set extra.frame.projectId to a stable project identifier");
  const schemes = config.scheme === undefined ? [] : Array.isArray(config.scheme) ? config.scheme : [config.scheme];
  if (schemes.some(value => typeof value !== "string" || !/^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(value))) throw new Error("URL schemes must be valid scheme names without a colon");
  const documents = config.extra?.frame?.documentTypes ?? [];
  const types = documents.map(document => {
    if (typeof document.name !== "string" || !document.name.length || !Array.isArray(document.contentTypes) || !document.contentTypes.length || document.contentTypes.some(type => typeof type !== "string" || !type.includes("."))) throw new Error("Document types need a name and contentTypes containing UTIs");
    if (document.role && !["Editor", "Viewer"].includes(document.role)) throw new Error("Document role must be Editor or Viewer");
    return { CFBundleTypeName: document.name, CFBundleTypeRole: document.role ?? "Editor", LSItemContentTypes: document.contentTypes, LSHandlerRank: "Alternate" };
  });
  if (config.extra?.frame?.menuBarOnly !== undefined && typeof config.extra.frame.menuBarOnly !== "boolean") throw new Error("menuBarOnly must be a boolean");
  return {
    LSUIElement: config.extra?.frame?.menuBarOnly === true,
    FrameMenuBarOnly: config.extra?.frame?.menuBarOnly === true,
    FrameProjectIdentifier: projectId,
    FrameWindowConfiguration: validateWindow(config.extra?.frame?.window ?? {}),
    ...updatePlist(config),
    // The app may need JS to save edits before accepting a quit request.
    NSSupportsAutomaticTermination: false,
    NSSupportsSuddenTermination: false,
    ...(schemes.length ? { CFBundleURLTypes: [{ CFBundleURLName: projectId, CFBundleURLSchemes: [...new Set(schemes)] }] } : {}),
    ...(types.length ? { CFBundleDocumentTypes: types } : {}),
  };
}
module.exports = { identity };
