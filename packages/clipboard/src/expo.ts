import * as Clipboard from "expo-clipboard";
export { getStringAsync, setStringAsync, hasStringAsync, StringFormat } from "expo-clipboard";
export type { GetStringOptions, SetStringOptions } from "expo-clipboard";
export type { ClipboardContent } from "./index";
export const readClipboardText = Clipboard.getStringAsync;
export async function writeClipboardText(text: string): Promise<void> { await Clipboard.setStringAsync(text); }
export const hasClipboardText = Clipboard.hasStringAsync;
const unavailable = async (..._args: unknown[]): Promise<never> => { throw Object.assign(new Error("Rich desktop clipboard operations are unavailable on this platform"), { code: "E_UNAVAILABLE" }); };
export const readClipboard = unavailable;
export const getClipboardFormats = unavailable;
export const clearClipboard = unavailable;
export const writeClipboard = unavailable;
