import http from "node:http";
import { Readable } from "node:stream";
import type { Socket } from "node:net";

/** Loopback HTTP endpoints used by native acceptance drivers. */
export async function serveTestHTTP(options: {
  hostname?: string;
  port?: number;
  maxRequestBodySize?: number;
  fetch(request: Request): Response | Promise<Response>;
}) {
  const sockets = new Set<Socket>();
  const server = http.createServer(async (incoming, outgoing) => {
    const controller = new AbortController();
    incoming.on("aborted", () => controller.abort());
    outgoing.on("close", () => { if (!outgoing.writableFinished) controller.abort(); });
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of incoming) {
        size += chunk.length;
        if (size > (options.maxRequestBodySize ?? 1024 * 1024)) {
          outgoing.writeHead(413, { connection: "close" }); outgoing.end("Request body too large");
          return;
        }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (let i = 0; i < incoming.rawHeaders.length; i += 2) headers.append(incoming.rawHeaders[i]!, incoming.rawHeaders[i + 1]!);
      const method = incoming.method ?? "GET";
      const request = new Request(new URL(incoming.url ?? "/", url), {
        method, headers, signal: controller.signal,
        ...(method === "GET" || method === "HEAD" ? {} : { body: Buffer.concat(chunks) }),
      });
      const response = await options.fetch(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) {
        const stream = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream<Uint8Array>);
        stream.on("error", error => outgoing.destroy(error));
        outgoing.on("close", () => stream.destroy());
        stream.pipe(outgoing);
      } else outgoing.end();
    } catch (error) {
      if (!outgoing.headersSent) { outgoing.writeHead(500); outgoing.end(String(error)); }
      else outgoing.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  });
  server.on("connection", socket => { sockets.add(socket); socket.on("close", () => sockets.delete(socket)); });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, options.hostname ?? "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  const port = (server.address() as import("node:net").AddressInfo).port;
  const url = new URL(`http://${options.hostname ?? "127.0.0.1"}:${port}/`);
  return { port, url, server, async stop(force = false) {
    if (force) for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } };
}
