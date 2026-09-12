const { validateWindow } = require("@legend-apps/window-options");
function identity(config) {
  const projectId = config.extra?.legend?.projectId ?? config.macos?.bundleIdentifier;
  if (typeof projectId !== "string" || !projectId.length || projectId.length > 200) throw new Error("Set extra.legend.projectId to a stable project identifier");
  const schemes = config.scheme === undefined ? [] : Array.isArray(config.scheme) ? config.scheme : [config.scheme];
  if (schemes.some(value => typeof value !== "string" || !/^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(value))) throw new Error("URL schemes must be valid scheme names without a colon");
  const documents = config.extra?.legend?.documentTypes ?? [];
  const types = documents.map(document => {
    if (typeof document.name !== "string" || !document.name.length || !Array.isArray(document.contentTypes) || !document.contentTypes.length || document.contentTypes.some(type => typeof type !== "string" || !type.includes("."))) throw new Error("Document types need a name and contentTypes containing UTIs");
    if (document.role && !["Editor", "Viewer"].includes(document.role)) throw new Error("Document role must be Editor or Viewer");
    return { CFBundleTypeName: document.name, CFBundleTypeRole: document.role ?? "Editor", LSItemContentTypes: document.contentTypes, LSHandlerRank: "Alternate" };
  });
  return {
    LegendProjectIdentifier: projectId,
    LegendWindowConfiguration: validateWindow(config.extra?.legend?.window ?? {}),
    // The app may need JS to save edits before accepting a quit request.
    NSSupportsAutomaticTermination: false,
    NSSupportsSuddenTermination: false,
    ...(schemes.length ? { CFBundleURLTypes: [{ CFBundleURLName: projectId, CFBundleURLSchemes: [...new Set(schemes)] }] } : {}),
    ...(types.length ? { CFBundleDocumentTypes: types } : {}),
  };
}
module.exports = { identity };
