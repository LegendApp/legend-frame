export const platforms = ["macos", "windows", "ios", "android", "web"] as const;
export type TestPlatform = typeof platforms[number];
export type ResultStatus = "passed" | "failed" | "missing-implementation" | "not-applicable" | "not-tested";
export type TestLayer = "build" | "api" | "ui" | "lifecycle" | "distribution";
type Support = "implemented" | "missing" | "not-applicable";
export interface CaseDefinition { id: string; title: string; layer: TestLayer; support: Record<TestPlatform, Support> }
const all = { macos: "implemented", windows: "implemented", ios: "implemented", android: "implemented", web: "implemented" } as const;
const desktop = { ...all, ios: "not-applicable", android: "not-applicable", web: "not-applicable" } as const;
const macOnly = { ...desktop, windows: "missing" } as const;
function definition(id: string, title: string, layer: TestLayer, support: CaseDefinition["support"] = all): CaseDefinition { return { id, title, layer, support }; }
// This is intended support, not inferred from an unavailable module or a skipped run.
// An implemented backend that throws E_UNAVAILABLE fails its case.
export const catalog: CaseDefinition[] = [
  definition("build.project", "Packed consumer creation and native generation", "build"),
  definition("build.bundle", "Platform JavaScript bundle", "build"),
  definition("build.native", "Native compilation", "build", { ...all, web: "not-applicable" }),
  definition("runtime.launch", "Application launches and reports from the target runtime", "lifecycle"),
  definition("clipboard.read", "Clipboard string read and presence", "api"),
  definition("clipboard.roundtrip", "Clipboard text and empty-string round trip", "api"),
  definition("storage.lifecycle", "Secure storage missing/write/update/delete", "api", { ...all, web: "not-applicable" }),
  definition("storage.unavailable", "Web secure storage explicitly reports unavailable", "api", { ...all, macos: "not-applicable", windows: "not-applicable", ios: "not-applicable", android: "not-applicable" }),
  definition("links.resolution", "Stable initial URL and HTTPS handler", "api"),
  definition("files.conflict", "Text file writes reject conflicting saves", "api", desktop),
  definition("windows.geometry", "Secondary window options, geometry and fullscreen", "api", desktop),
  definition("appearance.override", "Light/dark/system override and events", "api", desktop),
  definition("ui.button", "Native/browser button invokes React callback", "ui"),
  definition("ui.input", "Native/browser input reports edited text", "ui"),
  definition("ui.select", "Native/browser select reports semantic value", "ui"),
  definition("ui.focus-theme", "Theme changes preserve input focus and text", "ui"),
  definition("lifecycle.forwarding", "Simultaneous launch forwards to one owner", "lifecycle", desktop),
  definition("lifecycle.recovery", "Launch recovers after owner termination", "lifecycle", desktop),
  definition("lifecycle.refresh", "Fast Refresh preserves app state", "lifecycle"),
  definition("lifecycle.persistence", "Stored data survives app restart", "lifecycle"),
  definition("lifecycle.custom-module", "New native module triggers a custom build", "lifecycle", desktop),
  definition("desktop.message-dialog", "Native message dialog buttons, checkbox and cancellation", "ui", desktop),
  definition("desktop.context-menu", "Native context menu selection and dismissal", "ui", desktop),
  definition("desktop.filesystem", "Filesystem operations and watching", "api", desktop),
  definition("desktop.settings", "Persistent settings", "api", desktop),
  definition("desktop.recent-documents", "Recent document history", "api", desktop),
  definition("desktop.associations", "OS file and URL associations", "api", desktop),
  ...[
    ["tray", "Tray lifecycle and actions"], ["notifications", "Notification permission/delivery/actions"],
    ["drag-drop", "Native drag and drop"],
    ["global-shortcuts", "Shortcuts while another app has focus"], ["processes", "Child process lifecycle"],
    ["system", "System APIs"],
    ["rich-clipboard", "Rich clipboard formats"], ["modal-windows", "Owned and modal windows"],
    ["advanced-menus", "Menu targeting and accelerators"],
    ["sqlite", "SQLite integration"], ["webview", "WebView integration"],
    ["nitro", "Nitro native module integration"], ["runtimes", "Secondary Hermes runtimes"],
  ].map(([id, title]) => definition(`desktop.${id}`, title!, "api", macOnly)),
  definition("audio.playback", "Audio playback and transport controls", "api"),
  definition("distribution.standalone", "Installed app runs without Metro or developer tools", "distribution", macOnly),
  definition("distribution.updates", "Signed update and recovery", "distribution", macOnly),
];
export interface CaseResult { id: string; status: ResultStatus; detail?: string; durationMs?: number; evidence?: string }
export function initialResults(platform: TestPlatform): CaseResult[] {
  return catalog.map(c => {
    const support = c.support[platform];
    return { id: c.id, status: support === "implemented" ? "not-tested" : support === "missing" ? "missing-implementation" : "not-applicable",
      detail: support === "implemented" ? "No execution evidence in this run" : support === "missing" ? "Platform implementation is outstanding" : "Outside this case's platform contract" };
  });
}
export async function executeCase(id: string, action: () => Promise<void>): Promise<CaseResult> {
  if (!catalog.some(c => c.id === id)) throw new Error(`Unknown contract case: ${id}`);
  const start = Date.now();
  try { await action(); return { id, status: "passed", durationMs: Date.now() - start }; }
  catch (error) { return { id, status: "failed", detail: String(error), durationMs: Date.now() - start }; }
}
export function summarize(results: CaseResult[]) {
  const counts: Record<ResultStatus, number> = { passed: 0, failed: 0, "missing-implementation": 0, "not-applicable": 0, "not-tested": 0 };
  for (const result of results) counts[result.status]++;
  return { counts, complete: counts.failed === 0 && counts["missing-implementation"] === 0 && counts["not-tested"] === 0 };
}
export function updateResult(results: CaseResult[], result: CaseResult): CaseResult[] {
  if (!results.some(c => c.id === result.id)) throw new Error(`Unknown contract case: ${result.id}`);
  return results.map(c => c.id === result.id ? result : c);
}
