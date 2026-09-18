import * as files from "@legendapp/frame/files";
function assert(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
export async function runFileStreamChecks(check: (name: string, run: () => Promise<void>) => Promise<void>) {
  await check("files.streaming", async () => {
    const path = `${await files.getDirectory("temp")}/stream-${Date.now()}.bin`;
    const chunk = Uint8Array.from({ length: 65536 }, (_, i) => i % 256);
    try {
      async function* input() { for (let i = 0; i < 40; i++) yield chunk; }
      assert(await files.writeChunks(path, input(), { mode: "createNew" }) === 40 * chunk.length, "Incomplete write");
      let total = 0;
      for await (const bytes of files.readChunks(path, { chunkSize: 10003 })) { for (const byte of bytes) { assert(byte === total % 256, `Invalid byte ${total}`); total++; } }
      assert(total === 40 * chunk.length, "Incomplete read");
      const handle = await files.openFile(path, { mode: "readWrite" });
      try { await handle.write(new Uint8Array([255, 0, 128]), 3); await handle.flush(); const bytes = await handle.read(3, 3); assert(bytes.join() === "255,0,128", "Positional I/O failed"); assert((await handle.read(16, total)).length === 0, "EOF must return empty bytes"); }
      finally { await handle.close(); await handle.close(); }
      let closed = false; try { await handle.read(1, 0); } catch { closed = true; } assert(closed, "Closed handle read succeeded");
      let exclusive = false; try { const unexpected = await files.openFile(path, { mode: "createNew" }); await unexpected.close(); } catch { exclusive = true; } assert(exclusive, "createNew overwrote existing file");
      for await (const bytes of files.readChunks(path)) { assert(bytes.length > 0, "Missing first chunk"); break; }
      const controller = new AbortController(); let aborted = false;
      try { for await (const bytes of files.readChunks(path, { signal: controller.signal })) controller.abort(); } catch { aborted = true; } assert(aborted, "Read did not abort");
      await files.writeChunks(path, [new Uint8Array([7])]); assert((await files.stat(path)).size === 1, "write did not truncate");
    } finally { await files.remove(path); }
  });
  await check("files.trash", async () => {
    const path = `${await files.getDirectory("temp")}/frame-recycle-probe-${Date.now()}.txt`;
    await files.writeText(path, "Disposable Frame Trash/Recycle Bin acceptance file. Restore through the OS file manager.");
    await files.trash(path);
    assert(!await files.exists(path), "Trash left the original file in place");
    let missing = false; try { await files.trash(path); } catch { missing = true; } assert(missing, "Missing trash item succeeded");
  });
}
