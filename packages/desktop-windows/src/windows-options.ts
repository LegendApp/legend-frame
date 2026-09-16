// AppKit materials and custom titlebar/transparency remain explicitly unsupported.
const windowsWindowOptions = new Set([
  "title", "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
  "resizable", "minimizable", "alwaysOnTop", "closable", "appearance", "backgroundColor", "restoreFrame",
]);
export function validateWindowsWindowOptions(options: object) {
  const unsupported = Object.keys(options).filter(key => !windowsWindowOptions.has(key));
  if (unsupported.length) throw Object.assign(new Error(`Windows does not yet support window options: ${unsupported.join(", ")}`), { code: "E_UNAVAILABLE" });
}
