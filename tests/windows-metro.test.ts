import { WebSocketServer } from "ws";
import { serveTestHTTP } from "../scripts/testing/http.ts";
import { expect, test } from "vitest";
import { startWindowsMetro, windowsMetroURL } from "../packages/cli/src/windows-metro.ts";
test("Windows adapter changes bundle flags while keeping Expo endpoints and hosts fixed", () => {
  const bundle = windowsMetroURL("http://evil.test/index.bundle?platform=windows&dev=true&hot=true&x=1", 8082, { dev: false, minify: true, https: true });
  expect(bundle.origin).toBe("https://127.0.0.1:8082");
  expect(bundle.searchParams.get("platform")).toBe("windows"); expect(bundle.searchParams.get("dev")).toBe("false");
  expect(bundle.searchParams.get("hot")).toBe("false"); expect(bundle.searchParams.get("minify")).toBe("true");
  expect(windowsMetroURL("http://local/inspector/device?name=a", 8082, {}).search).toBe("?name=a");
});
test("Windows adapter forwards HTTP bodies and WebSocket messages to Metro", async () => {
  const upstream = await serveTestHTTP({ hostname: "127.0.0.1", port: 0,
    async fetch(request) {
      return Response.json({ url: request.url, body: await request.text() });
    },
  });
  const websocket = new WebSocketServer({ server: upstream.server });
  websocket.on("connection", socket => socket.on("message", (value, binary) => socket.send(value, { binary })));
  const proxy = await startWindowsMetro(upstream.port!, { dev: false, minify: true });
  try {
    const response = await (await fetch(`http://127.0.0.1:${proxy.port}/index.bundle?platform=windows`, { method: "POST", body: "body" })).json() as { url: string; body: string };
    expect(response.body).toBe("body"); expect(new URL(response.url).searchParams.get("minify")).toBe("true");
    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(`ws://127.0.0.1:${proxy.port}/hot`);
      const timer = setTimeout(() => { socket.close(); reject(new Error("WebSocket timed out")); }, 2000);
      socket.onopen = () => socket.send("reload");
      socket.onmessage = event => { clearTimeout(timer); socket.close(); try { expect(event.data).toBe("reload"); resolve(); } catch (error) { reject(error); } };
      socket.onerror = () => { clearTimeout(timer); reject(new Error("WebSocket failed")); };
    });
  } finally { proxy.stop(true); websocket.close(); await upstream.stop(true); }
});
