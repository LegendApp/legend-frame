import type * as FileSystem from "@legend-apps/file-system";
import type { settings } from "@legend-apps/settings";
import { assertContract } from "./contract-cases";

async function rejectsCode(action: () => Promise<unknown>, code: string) {
  try { await action(); } catch (error) {
    assertContract((error as { code?: string }).code === code, `Expected ${code}, received ${String(error)}`); return;
  }
  throw new Error(`Expected ${code} rejection`);
}
export async function filesystemLifecycle(files: typeof FileSystem, token: string) {
  const dirs = await Promise.all(["data", "cache", "temp"].map(kind => files.getDirectory(kind as "data" | "cache" | "temp")));
  assertContract(new Set(dirs).size === 3, "App directories must be distinct");
  for (const dir of dirs) assertContract((await files.stat(dir)).type === "directory", "App directory missing");
  const root = `${dirs[2]}/legend-contract-${token}`, file = `${root}/space ü.txt`;
  let watch: Awaited<ReturnType<typeof files.watch>> | undefined;
  try {
    await files.mkdir(`${root}/nested/child`);
    await files.writeText(file, "hello 🌎\n\u0000tail");
    assertContract(await files.readText(file) === "hello 🌎\n\u0000tail", "UTF-8/NUL roundtrip failed");
    const url = `file://${file.startsWith("/") ? "" : "/"}${file.replaceAll("\\", "/").split("/").map((part, i) => i === 0 && /^[a-z]:$/i.test(part) ? part : encodeURIComponent(part)).join("/")}`;
    assertContract(await files.readText(url) === await files.readText(file), "File URL decoding failed");
    await files.writeBase64(`${root}/bytes`, "AAECA/7/");
    assertContract(await files.readBase64(`${root}/bytes`) === "AAECA/7/", "Binary roundtrip failed");
    await files.writeBase64(`${root}/empty`, "");
    assertContract(await files.readBase64(`${root}/empty`) === "", "Empty binary roundtrip failed");
    await rejectsCode(() => files.writeBase64(`${root}/bytes`, "!bad!"), "E_INVALID_ARGUMENT");
    assertContract(await files.readBase64(`${root}/bytes`) === "AAECA/7/", "Rejected write modified existing data");
    await files.writeBase64(`${root}/invalid-utf8`, "/w==");
    let invalidUTF8 = false; try { await files.readText(`${root}/invalid-utf8`); } catch { invalidUTF8 = true; }
    assertContract(invalidUTF8, "Invalid UTF-8 was silently replaced");
    const info = await files.stat(file);
    assertContract(info.type === "file" && info.size > 0 && Math.abs(info.modifiedAt - Date.now()) < 60000, "Invalid file metadata");
    await files.copy(file, `${root}/copy`); await files.move(`${root}/copy`, `${root}/moved`);
    assertContract(!await files.exists(`${root}/copy`) && await files.readText(`${root}/moved`) === await files.readText(file), "Copy/move failed");
    await rejectsCode(() => files.copy(file, `${root}/moved`), "E_EXISTS");
    await rejectsCode(() => files.move(file, `${root}/moved`), "E_EXISTS");
    assertContract(await files.exists(file), "Failed move removed source");
    await files.writeText(`${root}/nested/child/value`, "recursive");
    await files.copy(`${root}/nested`, `${root}/tree-copy`);
    assertContract(await files.readText(`${root}/tree-copy/child/value`) === "recursive", "Directory copy failed");
    const names = await files.list(root);
    assertContract(names.includes("space ü.txt") && names.every(name => !name.includes("/") && !name.includes("\\")), "Directory listing must return names");
    await rejectsCode(() => files.readText(`${root}/absent`), "E_NOT_FOUND");
    assertContract(!await files.exists(`${root}/absent`), "Missing file exists");
    await rejectsCode(() => files.remove(`${root}/nested`), "E_NOT_EMPTY");
    assertContract(await files.remove(`${root}/tree-copy`, { recursive: true }), "Recursive deletion failed");
    assertContract(await files.remove(`${root}/empty`) && !await files.remove(`${root}/empty`), "Deletion must be idempotent");
    // Wait for distinct changes across two atomic replacements of the same path.
    let notifications = 0, invalidWatchPath = false;
    watch = await files.watch(file, observed => { invalidWatchPath ||= observed.replaceAll("\\", "/") !== file.replaceAll("\\", "/"); notifications++; });
    for (const text of ["replacement one", "replacement two"]) {
      const before = notifications; await files.writeText(file, text);
      const deadline = Date.now() + 5000;
      while (notifications === before && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
      assertContract(!invalidWatchPath && notifications > before && await files.readText(file) === text, "Watch did not survive atomic replacement");
    }
    await watch.remove(); await watch.remove(); watch = undefined;
    const stopped = notifications; await files.writeText(file, "after unwatch");
    await new Promise(resolve => setTimeout(resolve, 150));
    assertContract(notifications === stopped, "Removed watch still delivered callbacks");
    await files.mkdir(`${root}/watched-directory`);
    let directoryChanged = false;
    watch = await files.watch(`${root}/watched-directory`, () => { directoryChanged = true; });
    await files.move(`${root}/watched-directory`, `${root}/renamed-directory`);
    const deadline = Date.now() + 5000;
    while (!directoryChanged && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
    assertContract(directoryChanged, "Renaming the watched directory did not invalidate it");
  } finally { await watch?.remove(); await files.remove(root, { recursive: true }); }
}
export async function settingsLifecycle(store: typeof settings, token: string) {
  const key = `contract-${token}`, reserved = `CON.${token}`, escaped = `%43ON.${token}`;
  try {
    await store.set(reserved, "reserved"); await store.set(escaped, "literal percent");
    assertContract(await store.get(reserved) === "reserved" && await store.get(escaped) === "literal percent", "Windows device-name keys collided");
    await store.remove(key); assertContract(await store.get(key) === null, "Missing setting must be null");
    await store.set(key, { text: "Unicode 🌎", array: [true, null, 2] });
    assertContract(JSON.stringify(await store.get(key)) === JSON.stringify({ text: "Unicode 🌎", array: [true, null, 2] }), "JSON settings roundtrip failed");
    await store.set(key, 0);
    await Promise.all(Array.from({ length: 10 }, () => store.update<number>(key, value => (value ?? 0) + 1)));
    assertContract(await store.get(key) === 10, "Concurrent updates lost data");
    try { await store.update(key, () => { throw new Error("expected failure"); }); } catch {}
    await store.update<number>(key, value => (value ?? 0) + 1);
    assertContract(await store.get(key) === 11, "Failed update poisoned the queue");
    await store.remove(key); await store.remove(key);
    assertContract(await store.get(key) === null, "Settings deletion failed");
  } finally { await store.remove(key); await store.remove(reserved); await store.remove(escaped); }
}

export async function recentDocumentsLifecycle(files: typeof FileSystem, links: typeof import("@legend-apps/desktop-links"), token: string) {
  // The platform runner uses a disposable project identity. Kitchen Sink runs explicitly.
  const original = await links.getRecentDocuments();
  const file = `${await files.getDirectory("temp")}/legend-recent-${token}.txt`;
  const normalized = file.replaceAll("\\", "/");
  const url = `file://${normalized.startsWith("/") ? "" : "/"}${normalized.split("/").map((part, i) => i === 0 && /^[a-z]:$/i.test(part) ? part : encodeURIComponent(part)).join("/")}`;
  try {
    await files.writeText(file, "recent contract");
    await links.noteRecentDocument(url); await links.noteRecentDocument(url);
    const recent = await links.getRecentDocuments();
    assertContract(recent[0] === url && recent.filter(value => value === url).length === 1, "Recent document order/deduplication failed");
    await links.clearRecentDocuments();
    assertContract((await links.getRecentDocuments()).length === 0, "Recent document clear failed");
  } finally {
    await links.clearRecentDocuments();
    for (const value of original.reverse()) await links.noteRecentDocument(value);
    await files.remove(file);
  }
}
