import { setTimeout as sleep } from "node:timers/promises";
import { expect, test } from "vitest";
import { authSessions, type AuthTransport } from "../packages/auth-session/src/core.ts";
import { authorize, callbackMatches } from "../packages/auth-session/src/types.ts";
function fixture(overrides: Partial<AuthTransport> = {}) {
  const closed: string[] = [], opened: string[] = [], callbacks: string[] = [];
  let receive: (url: string) => void = () => {};
  const create = authSessions({ randomState: async () => "unpredictable-state", prepare: async () => "http://127.0.0.1:12345/auth/callback",
    poll: async () => callbacks.splice(0), close: async id => { closed.push(id); },
    subscribe: async listener => { receive = listener; return { remove() { receive = () => {}; } }; },
    open: async url => { opened.push(url); }, ...overrides });
  return { create, closed, opened, callbacks, receive: (url: string) => receive(url) };
}
const authURL = (state: string) => `https://provider.example/authorize?state=${state}`;
test("auth rejects wrong state, duplicate state, wrong origins and paths", () => {
  const redirect = "http://127.0.0.1:12345/auth/callback";
  expect(callbackMatches(`${redirect}?code=secret&state=ok`, redirect, "ok")).toBe(true);
  for (const url of [`${redirect}?state=bad`, `${redirect}?state=ok&state=bad`, `${redirect}?state=ok#state=ok`, "http://127.0.0.1:54321/auth/callback?state=ok", `${redirect}/extra?state=ok`]) expect(callbackMatches(url, redirect, "ok")).toBe(false);
  expect(() => authorize("http://evil.example/?state=ok", "ok", redirect)).toThrow("HTTPS");
  expect(() => authorize("https://example.com/?state=bad", "ok", redirect)).toThrow("state");
});
test("loopback auth ignores invalid callbacks and cleans up after success", async () => {
  const f = fixture(), session = await f.create();
  await expect(f.create()).rejects.toThrow("already active");
  const result = session.open(authURL(session.state));
  f.callbacks.push(`${session.redirectUri}?state=bad`, `${session.redirectUri}?code=code&state=${session.state}`);
  expect(await result).toEqual({ type: "success", url: `${session.redirectUri}?code=code&state=${session.state}` });
  expect(f.closed).toHaveLength(1); await session.dismiss(); expect(f.closed).toHaveLength(1);
  await expect(session.open(authURL(session.state))).rejects.toThrow("once");
  const next = await f.create(); await next.dismiss();
});
test("auth cancellation releases sockets even while browser launch is unresolved", async () => {
  const controller = new AbortController(); const f = fixture({ open: () => new Promise(() => {}) });
  const session = await f.create({ signal: controller.signal });
  const result = session.open(authURL(session.state)); controller.abort();
  expect(await result).toEqual({ type: "cancel" }); expect(f.closed).toHaveLength(1);
});
test("prepared auth expires, launch failure cleans up, schemes use matching URL events", async () => {
  const f = fixture(); const expired = await f.create({ timeoutMs: 5 }); await sleep(15);
  expect(await expired.open(authURL(expired.state))).toEqual({ type: "timeout" }); expect(f.closed).toHaveLength(1);
  const broken = fixture({ open: async () => { throw Error("No browser"); } });
  const bad = await broken.create(); await expect(bad.open(authURL(bad.state))).rejects.toThrow("No browser"); expect(broken.closed).toHaveLength(1);
  const scheme = await f.create({ redirectUri: "myapp://auth/callback" }); const result = scheme.open(authURL(scheme.state));
  f.receive(`myapp://wrong/callback?state=${scheme.state}`); f.receive(`myapp://auth/callback?state=${scheme.state}`);
  expect((await result).type).toBe("success"); expect(f.closed).toHaveLength(1);
});
test("auth transport errors reject instead of impersonating user cancellation", async () => {
  const f = fixture({ poll: async () => { throw new Error("Native runtime needs a rebuild"); } });
  const session = await f.create();
  await expect(session.open(authURL(session.state))).rejects.toThrow("needs a rebuild");
  expect(f.closed).toHaveLength(1);
});
