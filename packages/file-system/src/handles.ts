import { fromByteArray, toByteArray } from "base64-js";
export const MAX_CHUNK_SIZE = 1024 * 1024;
export type FileMode = "read" | "readWrite" | "write" | "createNew";
export type FileHandle = {
  read(length: number, offset: number): Promise<Uint8Array>;
  write(bytes: Uint8Array, offset: number): Promise<number>;
  flush(): Promise<void>;
  close(): Promise<void>;
};
export type FileCall = <T>(method: string, args: object) => Promise<T>;
function offset(value: number) { if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Offset must be a nonnegative safe integer"); }
function length(value: number) { if (!Number.isInteger(value) || value < 1 || value > MAX_CHUNK_SIZE) throw new RangeError("Chunk size must be between 1 byte and 1 MiB"); }
function aborted(signal?: AbortSignal) { if (signal?.aborted) throw signal.reason ?? new Error("File operation aborted"); }
/** Positional I/O: handles have no shared cursor. Calls are serialized natively. */
export async function createFileHandle(call: FileCall, path: string, mode: FileMode = "read"): Promise<FileHandle> {
  if (!["read", "readWrite", "write", "createNew"].includes(mode)) throw new TypeError("Invalid file mode");
  const id = await call<string>("openFile", { path, mode });
  let closing: Promise<void> | undefined;
  const active = () => { if (closing) throw new Error("File handle is closed"); };
  return {
    async read(size, position) { active(); length(size); offset(position); if (!Number.isSafeInteger(position + size)) throw new RangeError("Read range exceeds safe integer bounds"); return toByteArray(await call<string>("readChunk", { id, length: size, offset: position })); },
    async write(bytes, position) { active(); if (!(bytes instanceof Uint8Array)) throw new TypeError("Expected Uint8Array"); offset(position); if (!Number.isSafeInteger(position + bytes.byteLength)) throw new RangeError("Write range exceeds safe integer bounds"); if (!bytes.length) return 0; length(bytes.length); return call<number>("writeChunk", { id, base64: fromByteArray(bytes), offset: position }); },
    async flush() { active(); await call("flushFile", { id }); },
    close() { return closing ??= call<void>("closeFile", { id }); },
  };
}
export type ReadChunksOptions = { offset?: number; chunkSize?: number; signal?: AbortSignal };
export async function* iterateFile(open: () => Promise<FileHandle>, options: ReadChunksOptions = {}) {
  let position = options.offset ?? 0; offset(position); const size = options.chunkSize ?? 64 * 1024; length(size); aborted(options.signal);
  const file = await open();
  try {
    for (;;) { aborted(options.signal); const bytes = await file.read(size, position); aborted(options.signal); if (!bytes.length) break; position += bytes.length; yield bytes; }
  } finally { await file.close(); }
}
export async function writeFileChunks(open: () => Promise<FileHandle>, chunks: AsyncIterable<Uint8Array> | Iterable<Uint8Array>, signal?: AbortSignal) {
  aborted(signal); const file = await open(); let position = 0;
  try {
    for await (const bytes of chunks) {
      aborted(signal);
      if (!(bytes instanceof Uint8Array)) throw new TypeError("Expected Uint8Array chunks");
      for (let start = 0; start < bytes.length; start += MAX_CHUNK_SIZE) { aborted(signal); const part = bytes.subarray(start, start + MAX_CHUNK_SIZE); position += await file.write(part, position); }
    }
    aborted(signal); await file.flush(); return position;
  } finally { await file.close(); }
}
