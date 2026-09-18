import Native from "@legendapp/frame-desktop-links/src/NativeDesktopLinks";
import { onOpen, openURL } from "@legendapp/frame-desktop-links";
import { authSessions } from "./core";
import { validateCount, validateDigest } from "./types";
export type * from "./types";
async function call<T>(method: string, args: object): Promise<T> { return JSON.parse(await Native.call(method, JSON.stringify(args))); }
export async function getRandomBytesAsync(count: number): Promise<Uint8Array> {
  validateCount(count); const base64 = await call<string>("cryptoRandom", { count });
  const { toByteArray } = await import("base64-js"); return toByteArray(base64);
}
export async function digestStringAsync(algorithm: "SHA-256", value: string): Promise<string> {
  validateDigest(algorithm, value); return call("cryptoDigest", { value });
}
export const createAuthSession = authSessions({
  randomState: async () => Array.from(await getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, "0")).join(""),
  prepare: (id, port, path) => call("authPrepare", { id, port, path }),
  poll: id => call("authPoll", { id }), close: id => call("authClose", { id }),
  subscribe: listener => onOpen(event => { if (event.type === "openURL") listener(event.url); }),
  open: openURL,
});
/** Desktop receives callbacks natively; no popup-completion step is needed. */
export function maybeCompleteAuthSession(): void {}
