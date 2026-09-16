// AppKit materials and the overlay titlebar remain platform-specific.
const windowsWindowOptions = new Set([
  "title", "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
  "resizable", "minimizable", "alwaysOnTop", "closable", "appearance", "backgroundColor", "restoreFrame", "titleBarStyle", "transparent", "hasShadow",
]);
export function validateWindowsWindowOptions(options: object) {
  const style = (options as { titleBarStyle?: string }).titleBarStyle;
  if (style === "overlay") throw Object.assign(new Error("Windows does not yet support the overlay titlebar style"), { code: "E_UNAVAILABLE" });
  const unsupported = Object.keys(options).filter(key => !windowsWindowOptions.has(key));
  if (unsupported.length) throw Object.assign(new Error(`Windows does not yet support window options: ${unsupported.join(", ")}`), { code: "E_UNAVAILABLE" });
}
