import * as Browser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import { authorize, callbackMatches, timeout, validateRedirect, validateCount, validateDigest, type AuthSession, type AuthSessionOptions, type AuthSessionResult } from "./types";
export type * from "./types";
export function getRandomBytesAsync(count: number) { validateCount(count); return Crypto.getRandomBytesAsync(count); }
export function digestStringAsync(algorithm: "SHA-256", value: string) { validateDigest(algorithm, value); return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value); }
let busy = false;
/** On web, invoke this on the redirect page so Expo can complete its popup session. */
export const maybeCompleteAuthSession = Browser.maybeCompleteAuthSession;
export async function createAuthSession(options: AuthSessionOptions = {}): Promise<AuthSession> {
  const duration = timeout(options);
  if (!options.redirectUri) throw new TypeError("Mobile/web authentication requires an explicit registered redirectUri");
  const redirectUri = options.redirectUri; validateRedirect(redirectUri);
  if (busy) throw Object.assign(new Error("An authentication session is already active"), { code: "E_BUSY" });
  if (options.signal?.aborted) throw Object.assign(new Error("Authentication was cancelled"), { name: "AbortError" });
  busy = true;
  try {
    const state = Array.from(await getRandomBytesAsync(32), byte => byte.toString(16).padStart(2, "0")).join("");
    let closed = false, opened = false;
    let resolve!: (value: AuthSessionResult) => void;
    const result = new Promise<AuthSessionResult>(done => { resolve = done; });
    const finish = (value: AuthSessionResult) => {
      if (closed) return; closed = true; clearTimeout(timer); options.signal?.removeEventListener("abort", cancel); busy = false;
      if (opened) { try { Browser.dismissAuthSession(); } catch { /* Android custom tabs may remain visible. */ } }
      resolve(value);
    };
    const cancel = () => finish({ type: "cancel" });
    const timer = setTimeout(() => finish({ type: "timeout" }), duration);
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) cancel();
    return {
      state, redirectUri,
      async open(url) {
        if (opened) throw new Error("Auth sessions can only be opened once");
        if (closed) return result;
        try {
          authorize(url, state, redirectUri); opened = true;
          // Call synchronously within the user's gesture on web; do not await preparation here.
          const browser = Browser.openAuthSessionAsync(url, redirectUri).then(value => {
            if (closed) return;
            if (value.type === "success") {
              if (!callbackMatches(value.url, redirectUri, state)) throw new Error("Authentication callback state or redirect did not match");
              finish({ type: "success", url: value.url });
            } else finish({ type: value.type === "cancel" ? "cancel" : "dismiss" });
          });
          return await Promise.race([result, browser.then(() => result)]);
        } catch (error) { finish({ type: "dismiss" }); throw error; }
      },
      async dismiss() { finish({ type: "dismiss" }); },
    };
  } catch (error) { busy = false; throw error; }
}
