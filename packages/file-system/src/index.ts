import { NativeEventEmitter, Platform } from "react-native";
import Native from "./NativeDesktopFileSystem";
import { absolutePath } from "./path";
export type FileStat = { type: "file" | "directory" | "symlink"; size: number; modifiedAt: number };
async function call<T = void>(method: string, args: object): Promise<T> {
  return JSON.parse(await Native.call(method, JSON.stringify(args))) as T;
}
function absolute(path: string) {
  return absolutePath(path, Platform.OS);
}
export const getDirectory = (kind: "data" | "cache" | "temp") => call<string>("directory", { kind });
export const readText = (path: string) => call<string>("readText", { path: absolute(path) });
export const writeText = (path: string, text: string) => call("writeText", { path: absolute(path), text });
/** Binary data uses base64 across the bridge; it does not require Node or Buffer. */
export const readBase64 = (path: string) => call<string>("readBytes", { path: absolute(path) });
export const writeBase64 = (path: string, base64: string) => call("writeBytes", { path: absolute(path), base64 });
export const stat = (path: string) => call<FileStat>("stat", { path: absolute(path) });
export async function exists(path: string) {
  try { await stat(path); return true; } catch (error) {
    if ((error as { code?: string }).code === "E_NOT_FOUND") return false;
    throw error;
  }
}
export const list = (path: string) => call<string[]>("list", { path: absolute(path) });
export const mkdir = (path: string, options: { recursive?: boolean } = {}) => call("mkdir", { path: absolute(path), recursive: options.recursive ?? true });
export const remove = (path: string, options: { recursive?: boolean } = {}) => call<boolean>("remove", { path: absolute(path), recursive: options.recursive ?? false });
export const copy = (path: string, to: string) => call("copy", { path: absolute(path), to: absolute(to) });
export const move = (path: string, to: string) => call("move", { path: absolute(path), to: absolute(to) });
let nextWatch = 0;
const emitter = new NativeEventEmitter(Native);
/** Nonrecursive invalidation, possibly including sibling changes. Re-read the file in the callback. */
export async function watch(path: string, listener: (path: string) => void) {
  const id = `watch-${Date.now()}-${++nextWatch}`;
  let removed = false;
  const subscription = emitter.addListener("change", (event: { id: string; path: string }) => {
    if (!removed && event.id === id) listener(event.path);
  });
  try { await call("watch", { path: absolute(path), id }); }
  catch (error) { subscription.remove(); throw error; }
  return { async remove() {
    if (removed) return;
    removed = true; subscription.remove(); await call("unwatch", { id });
  } };
}
