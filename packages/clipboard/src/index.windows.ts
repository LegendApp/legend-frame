import Native from "./NativeDesktopClipboard";
export { getStringAsync, setStringAsync, hasStringAsync, readClipboardText, writeClipboardText, hasClipboardText, StringFormat } from "./desktop";
export type { ClipboardContent, GetStringOptions, SetStringOptions } from "./desktop";
import { getStringAsync, hasStringAsync, setStringAsync } from "./desktop";
import type { ClipboardContent } from "./desktop";
export async function readClipboard(): Promise<ClipboardContent> { return await hasStringAsync() ? { text: await getStringAsync() } : {}; }
export async function getClipboardFormats(): Promise<string[]> { return await hasStringAsync() ? ["text"] : []; }
export async function clearClipboard(): Promise<void> { await Native.call("clear", "{}"); }
export async function writeClipboard(content: ClipboardContent): Promise<void> {
  if (Object.keys(content).some(key => key !== "text") || typeof content.text !== "string") throw Object.assign(new Error("Windows rich clipboard supports text only; use setStringAsync for HTML"), { code: "E_UNSUPPORTED" });
  await setStringAsync(content.text);
}
