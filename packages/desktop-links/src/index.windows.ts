import Native from "./NativeDesktopLinks";
export type { OpenEvent, URLListener } from "./index";
function url(value: string) { if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) throw new Error("URL must include a scheme"); return value; }
async function call<T>(method: string, args: object = {}): Promise<T> { return JSON.parse(await Native.call(method, JSON.stringify(args))); }
export const openURL = (value: string): Promise<true> => call("open", { url: url(value) });
export const canOpenURL = (value: string): Promise<boolean> => call("canOpen", { url: url(value) });
export { getInitialURL, addEventListener, onOpen } from "./api";
function unavailable(): never { throw Object.assign(new Error("Windows live activation and recent-document integration are not implemented yet"), { code: "E_UNAVAILABLE" }); }
export const noteRecentDocument = async (..._args: unknown[]): Promise<never> => unavailable();
export const clearRecentDocuments = async (): Promise<never> => unavailable();
export const getRecentDocuments = async (): Promise<never> => unavailable();
