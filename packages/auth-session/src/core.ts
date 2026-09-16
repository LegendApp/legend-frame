import { authorize, callbackMatches, timeout, validateRedirect, type AuthSession, type AuthSessionOptions, type AuthSessionResult } from "./types";
export type AuthTransport = {
  randomState(): Promise<string>;
  prepare(id: string, port: number, path: string): Promise<string>;
  poll(id: string): Promise<string[]>;
  close(id: string): Promise<void>;
  subscribe(listener: (url: string) => void): Promise<{ remove(): void }>;
  open(url: string): Promise<unknown>;
};
export function authSessions(transport: AuthTransport) {
  let busy = false, sequence = 0;
  return async function createAuthSession(options: AuthSessionOptions = {}): Promise<AuthSession> {
    const duration = timeout(options);
    if (busy) throw Object.assign(new Error("An authentication session is already active"), { code: "E_BUSY" });
    if (options.signal?.aborted) throw Object.assign(new Error("Authentication was cancelled"), { name: "AbortError" });
    busy = true;
    const id = `auth-${Date.now()}-${++sequence}`;
    let loopback = false, closed = false, opened = false, subscription: { remove(): void } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined, polling: ReturnType<typeof setTimeout> | undefined;
    let resolve!: (result: AuthSessionResult) => void;
    const result = new Promise<AuthSessionResult>(done => { resolve = done; });
    let closing: Promise<void> | undefined, failure: unknown;
    const cleanup = () => closing ??= (async () => {
      closed = true; clearTimeout(timer); clearTimeout(polling); subscription?.remove(); options.signal?.removeEventListener("abort", cancel);
      try { if (loopback) await transport.close(id); } finally { busy = false; }
    })();
    const finish = async (value: AuthSessionResult) => { if (closed) return; try { await cleanup(); } catch (error) { failure = error; } finally { resolve(value); } };
    const cancel = () => { void finish({ type: "cancel" }).catch(console.error); };
    try {
      const state = await transport.randomState();
      let redirectUri = options.redirectUri;
      if (!redirectUri) { loopback = true; redirectUri = await transport.prepare(id, 0, "/auth/callback"); }
      else {
        const uri = validateRedirect(redirectUri);
        if (uri.protocol === "http:") {
          if (uri.hostname !== "127.0.0.1" || !uri.port || !/^\/[a-zA-Z0-9/_-]*$/.test(uri.pathname)) throw new TypeError("Desktop HTTP callbacks require 127.0.0.1, an explicit port, and a plain path");
          loopback = true; redirectUri = await transport.prepare(id, Number(uri.port), uri.pathname);
        } else if (uri.protocol === "https:") throw new TypeError("Desktop callbacks require a loopback URI or registered application scheme");
      }
      const redirect = redirectUri;
      const received = (url: string) => { if (opened && !closed && callbackMatches(url, redirect, state)) void finish({ type: "success", url }).catch(console.error); };
      if (!loopback) subscription = await transport.subscribe(received);
      async function poll() {
        try { for (const url of await transport.poll(id)) received(url); }
        catch (error) { if (!closed) { failure = error; await finish({ type: "dismiss" }); } }
        finally { if (!closed) polling = setTimeout(poll, 100); }
      }
      options.signal?.addEventListener("abort", cancel, { once: true });
      timer = setTimeout(() => { void finish({ type: "timeout" }).catch(console.error); }, duration);
      if (options.signal?.aborted) cancel();
      return {
        state, redirectUri: redirect,
        async open(url) {
          if (opened) throw new Error("Auth sessions can only be opened once");
          if (closed) { const value = await result; if (failure) throw failure; return value; }
          try {
            authorize(url, state, redirect); opened = true;
            if (loopback) void poll();
            // Don't let a slow browser launch suppress cancellation or a received callback.
            const launch = transport.open(url).then(() => result);
            const value = await Promise.race([result, launch]); if (failure) throw failure; return value;
          } catch (error) { try { await cleanup(); } finally { resolve({ type: "dismiss" }); } throw error; }
        },
        async dismiss() { await finish({ type: "dismiss" }); if (failure) throw failure; },
      };
    } catch (error) { try { await cleanup(); } finally { resolve({ type: "dismiss" }); } throw error; }
  };
}
