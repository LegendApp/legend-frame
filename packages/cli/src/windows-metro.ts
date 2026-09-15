import { readFileSync } from "node:fs";
import WebSocket from "ws";
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
type SocketData = { target: string; remote?: WebSocket; pending: (string | Buffer)[]; bytes: number };
/** Keep RNW's loopback transport while Expo owns Metro, TLS, reloads and inspection. */
export function startWindowsMetro(port: number, options: WindowsBundleOptions) {
  const ca = options.https && process.env.SSL_CRT_FILE ? readFileSync(process.env.SSL_CRT_FILE, "utf8") : undefined;
  const server = Bun.serve<SocketData>({
    hostname: "127.0.0.1", port: 0,
    async fetch(request, server) {
      const target = windowsMetroURL(request.url, port, options);
      if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
        target.protocol = options.https ? "wss:" : "ws:";
        if (server.upgrade(request, { data: { target: target.href, pending: [], bytes: 0 } })) return;
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
      const headers = new Headers(request.headers); headers.delete("host"); headers.delete("connection");
      try {
        return await fetch(target, { method: request.method, headers,
          ...(request.method === "GET" || request.method === "HEAD" ? {} : { body: request.body }),
          signal: request.signal, decompress: false, ...(ca ? { tls: { ca } } : {}),
        });
      } catch (error) { return new Response(`Expo Metro connection failed: ${String(error)}`, { status: 502 }); }
    },
    websocket: {
      open(socket) {
        const remote = new WebSocket(socket.data.target, ca ? { ca } : {}); socket.data.remote = remote;
        remote.on("open", () => { for (const message of socket.data.pending) remote.send(message); socket.data.pending = []; socket.data.bytes = 0; });
        remote.on("message", (message, binary) => {
          const bytes = Array.isArray(message) ? Buffer.concat(message) : Buffer.from(message as ArrayBuffer);
          if (binary) socket.sendBinary(bytes); else socket.sendText(bytes.toString());
        });
        remote.on("close", () => socket.close()); remote.on("error", () => socket.close(1011, "Expo Metro WebSocket connection failed"));
      },
      message(socket, message) {
        const remote = socket.data.remote;
        if (remote?.readyState === WebSocket.OPEN) remote.send(message);
        else {
          socket.data.bytes += typeof message === "string" ? Buffer.byteLength(message) : message.byteLength;
          if (socket.data.bytes > 1024 * 1024) { remote?.terminate(); socket.close(1009, "Metro connection queue exceeded"); }
          else socket.data.pending.push(message);
        }
      },
      close(socket) { socket.data.remote?.terminate(); socket.data.pending = []; },
    },
  });
  server.unref(); return server;
}
const connections = new Map<string, { key: string; server: ReturnType<typeof startWindowsMetro> }>();
export function windowsMetroPort(root: string, port: number, options: WindowsBundleOptions): number {
  const key = JSON.stringify([port, options.https ?? false, options.dev ?? true, options.minify ?? false]);
  const previous = connections.get(root);
  if (previous?.key === key) return previous.server.port!;
  previous?.server.stop(true); connections.delete(root);
  if (!options.https && options.dev !== false && !options.minify) return port;
  const server = startWindowsMetro(port, options); connections.set(root, { key, server }); return server.port!;
}
export function stopWindowsMetro(root: string) { connections.get(root)?.server.stop(true); connections.delete(root); }
