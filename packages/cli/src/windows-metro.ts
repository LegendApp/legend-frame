import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import type { Socket } from "node:net";
import WebSocket, { WebSocketServer, type RawData } from "ws";
export type WindowsBundleOptions = { dev?: boolean; minify?: boolean; https?: boolean };
export function windowsMetroURL(request: string, port: number, options: WindowsBundleOptions) {
  const source = new URL(request), target = new URL(`${options.https ? "https" : "http"}://127.0.0.1:${port}`);
  target.pathname = source.pathname; target.search = source.search;
  if (/\.(bundle|map)$/.test(target.pathname)) {
    target.searchParams.set("dev", String(options.dev ?? true)); target.searchParams.set("minify", String(options.minify ?? false));
    if (options.dev === false) target.searchParams.set("hot", "false");
  }
  return target;
}
export async function startWindowsMetro(port: number, options: WindowsBundleOptions) {
  const ca = options.https && process.env.SSL_CRT_FILE ? readFileSync(process.env.SSL_CRT_FILE, "utf8") : undefined;
  const sockets = new Set<Socket>();
  const remotes = new Set<WebSocket>();
  const server = http.createServer((request, response) => {
    const target = windowsMetroURL(`http://127.0.0.1${request.url}`, port, options);
    const headers = { ...request.headers }; delete headers.host; delete headers.connection;
    // Raw streams retain Content-Encoding/Length and avoid fetch decompression.
    const upstream = (options.https ? https : http).request(target, { method: request.method, headers, ...(ca ? { ca } : {}) }, incoming => {
      response.writeHead(incoming.statusCode ?? 502, incoming.headers);
      incoming.on("error", error => response.destroy(error));
      incoming.pipe(response);
    });
    upstream.on("error", error => {
      if (!response.headersSent) { response.writeHead(502); response.end(`Expo Metro connection failed: ${String(error)}`); }
      else response.destroy(error);
    });
    request.on("error", () => upstream.destroy());
    request.on("aborted", () => upstream.destroy());
    response.on("close", () => { if (!response.writableEnded) upstream.destroy(); });
    request.pipe(upstream);
  });
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  const websocket = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    websocket.handleUpgrade(request, socket, head, client => {
      const target = windowsMetroURL(`http://127.0.0.1${request.url}`, port, options);
      target.protocol = options.https ? "wss:" : "ws:";
      const remote = new WebSocket(target, ca ? { ca } : {});
      remotes.add(remote);
      let pending: { data: RawData; binary: boolean }[] = [], bytes = 0;
      remote.on("open", () => {
        for (const message of pending) remote.send(message.data, { binary: message.binary });
        pending = []; bytes = 0;
      });
      remote.on("message", (data, binary) => { if (client.readyState === WebSocket.OPEN) client.send(data, { binary }); });
      remote.on("close", () => { remotes.delete(remote); client.close(); });
      remote.on("error", () => client.close(1011, "Expo Metro WebSocket connection failed"));
      client.on("message", (data, binary) => {
        if (remote.readyState === WebSocket.OPEN) remote.send(data, { binary });
        else {
          bytes += Array.isArray(data) ? data.reduce((sum, part) => sum + part.length, 0) : data.byteLength;
          if (bytes > 1024 * 1024) { remote.terminate(); client.close(1009, "Metro connection queue exceeded"); }
          else pending.push({ data, binary });
        }
      });
      client.on("error", () => remote.terminate());
      client.on("close", () => { remote.terminate(); pending = []; });
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  server.unref();
  return { port: (server.address() as import("node:net").AddressInfo).port, stop(_force = true) {
    for (const remote of remotes) remote.terminate();
    for (const client of websocket.clients) client.terminate();
    for (const socket of sockets) socket.destroy();
    websocket.close(); server.close();
  } };
}
const connections = new Map<string, { key: string; server: Awaited<ReturnType<typeof startWindowsMetro>> }>();
export async function windowsMetroPort(root: string, port: number, options: WindowsBundleOptions): Promise<number> {
  const key = JSON.stringify([port, options.https ?? false, options.dev ?? true, options.minify ?? false]);
  const previous = connections.get(root);
  if (previous?.key === key) return previous.server.port;
  previous?.server.stop(true); connections.delete(root);
  if (!options.https && options.dev !== false && !options.minify) return port;
  const server = await startWindowsMetro(port, options); connections.set(root, { key, server }); return server.port;
}
export function stopWindowsMetro(root: string) { connections.get(root)?.server.stop(true); connections.delete(root); }
