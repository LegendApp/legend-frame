import Native from "./NativeDesktopSecureStorage";
function key(value: string) { if (!value.length || value.length > 200) throw new Error("Keychain keys must contain 1–200 characters"); return value; }
async function call<T = void>(method: string, args: object): Promise<T> { return JSON.parse(await Native.call(method, JSON.stringify(args))) as T; }
export const secureStorage = {
  get: (name: string) => call<string | null>("get", { key: key(name) }),
  set: (name: string, value: string) => call("set", { key: key(name), value }),
  remove: (name: string) => call("remove", { key: key(name) }),
};
