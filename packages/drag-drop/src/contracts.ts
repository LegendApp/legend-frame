export type DragOperation = "copy" | "move" | "link";
/** Custom data values are UTF-8 strings keyed by MIME type; JSON is app-owned. */
export type DragPayload = { files?: string[]; text?: string; urls?: string[]; data?: Record<string, string> };
export type DragOverEvent = { x: number; y: number; operation: DragOperation };
export type DropEvent = DragPayload & DragOverEvent;
export type DragOptions = {
  sourceOperations?: DragOperation[];
  acceptedOperations?: DragOperation[];
  /** Built-ins: files, text, urls. Custom types use MIME names. Default: built-ins. */
  acceptedTypes?: string[];
};
const operations = ["copy", "move", "link"];
const builtins = ["files", "text", "urls"];
const customType = (type: string) => /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(type) && !["application/x-frame-drag", "text/plain", "text/uri-list"].includes(type);
export function dragConfiguration(source: DragPayload | undefined, options: DragOptions, platform: string) {
  for (const values of [options.sourceOperations, options.acceptedOperations]) {
    if (values !== undefined && (!Array.isArray(values) || values.some(value => !operations.includes(value)) || new Set(values).size !== values.length)) throw new Error("Drag operations must be unique copy, move or link values");
  }
  const types = options.acceptedTypes ?? builtins;
  if (!Array.isArray(types) || types.some(type => typeof type !== "string" || (!builtins.includes(type) && !customType(type)))) throw new Error("Invalid accepted drag type");
  if (source) {
    if (source.files?.some(file => typeof file !== "string" || (platform === "windows" ? !/^(?:[a-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/i.test(file) : !file.startsWith("/")))) throw new Error("Drag source files must use absolute paths");
    if (source.text !== undefined && typeof source.text !== "string") throw new Error("Drag text must be a string");
    if (source.urls?.some(url => typeof url !== "string" || !/^[a-z][a-z0-9+.-]*:/i.test(url))) throw new Error("Drag URLs must be absolute URLs");
    if (source.data && (typeof source.data !== "object" || Array.isArray(source.data) || Object.entries(source.data).some(([type, value]) => !customType(type) || typeof value !== "string"))) throw new Error("Custom drag data must map MIME types to strings");
  }
  return JSON.stringify({ sourceOperations: options.sourceOperations ?? ["copy"], acceptedOperations: options.acceptedOperations ?? ["copy"], acceptedTypes: types });
}
