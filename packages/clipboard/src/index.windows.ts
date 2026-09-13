export type { ClipboardContent, GetStringOptions, SetStringOptions } from "./index";
export { StringFormat } from "./formats";
const unavailable = async (..._args: unknown[]): Promise<never> => { throw Object.assign(new Error("Clipboard has no Windows backend yet"), { code: "E_UNAVAILABLE" }); };
export const getStringAsync = unavailable, setStringAsync = unavailable, hasStringAsync = unavailable;
export const readClipboardText = unavailable, writeClipboardText = unavailable, hasClipboardText = unavailable;
export const readClipboard = unavailable, writeClipboard = unavailable, clearClipboard = unavailable, getClipboardFormats = unavailable;
