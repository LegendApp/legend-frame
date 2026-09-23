import { expect, test } from "vitest";
import { serveTestHTTP } from "../scripts/testing/http.ts";

test("acceptance HTTP server preserves request data, limits bodies, and closes sockets", async () => {
  const server = await serveTestHTTP({ maxRequestBodySize: 16, async fetch(request) {
    if (new URL(request.url).pathname === "/error") throw new Error("fixture failure");
    return Response.json({ method: request.method, body: await request.text(), token: request.headers.get("x-token") }, { headers: { "x-fixture": "ok" } });
  } });
  try {
    const response = await fetch(server.url, { method: "POST", body: "native report", headers: { "x-token": "secret" } });
    expect(response.headers.get("x-fixture")).toBe("ok");
    expect(await response.json()).toEqual({ method: "POST", body: "native report", token: "secret" });
    const tooLarge = await fetch(server.url, { method: "POST", body: "x".repeat(17) });
    expect(tooLarge.status).toBe(413); await tooLarge.text();
    const failure = await fetch(new URL("error", server.url));
    expect(failure.status).toBe(500); expect(await failure.text()).toContain("fixture failure");
  } finally { await server.stop(true); }
  await expect(fetch(server.url)).rejects.toThrow();
});
