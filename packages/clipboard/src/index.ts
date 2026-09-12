import Native from "./NativeDesktopClipboard";
async function call<T = void>(method: string, args: object = {}): Promise<T> { return JSON.parse(await Native.call(method, JSON.stringify(args))) as T; }
export const readClipboardText = () => call<string>("readText");
export const writeClipboardText = (text: string) => call("writeText", { text });
export const hasClipboardText = () => call<boolean>("hasText");

export type ClipboardContent = { text?: string; html?: string; rtf?: string; imagePNG?: string; files?: string[] };
/** imagePNG contains base64-encoded PNG bytes. */
export async function readClipboard(): Promise<ClipboardContent> { return JSON.parse(await Native.call("read", "{}")); }
export async function getClipboardFormats(): Promise<string[]> { return JSON.parse(await Native.call("formats", "{}")); }
export async function clearClipboard() { await Native.call("clear", "{}"); }
export async function writeClipboard(content: ClipboardContent) {
  for (const key of Object.keys(content)) if (!["text", "html", "rtf", "imagePNG", "files"].includes(key)) throw new Error(`Unknown clipboard format: ${key}`);
  if (content.files && (Object.keys(content).length !== 1 || content.files.some(file => !file.startsWith("/")))) throw new Error("Files must be absolute paths and written separately from other formats");
  for (const key of ["text", "html", "rtf", "imagePNG"] as const) if (content[key] !== undefined && typeof content[key] !== "string") throw new Error(`Invalid clipboard ${key}`);
  await Native.call("write", JSON.stringify(content));
}
