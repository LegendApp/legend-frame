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

import { StringFormat } from "./formats";
export { StringFormat } from "./formats";
export type GetStringOptions = { preferredFormat?: StringFormat };
export type SetStringOptions = { inputFormat?: StringFormat };
function stringOptions(options: object, key: string) {
  if (!options || Object.keys(options).some(name => name !== key)) throw new Error("Unsupported clipboard option");
  const format = (options as Record<string, unknown>)[key] ?? StringFormat.PLAIN_TEXT;
  if (format !== StringFormat.PLAIN_TEXT && format !== StringFormat.HTML) throw new Error("Invalid clipboard string format");
  return format;
}
/** Expo-compatible text/HTML subset. Rich desktop formats remain available above. */
export async function getStringAsync(options: GetStringOptions = {}): Promise<string> {
  return call("getString", { format: stringOptions(options, "preferredFormat") });
}
export async function setStringAsync(text: string, options: SetStringOptions = {}): Promise<boolean> {
  if (typeof text !== "string") throw new TypeError("Clipboard text must be a string");
  await call("setString", { text, format: stringOptions(options, "inputFormat") });
  return true;
}
export const hasStringAsync = (): Promise<boolean> => call("hasString");
