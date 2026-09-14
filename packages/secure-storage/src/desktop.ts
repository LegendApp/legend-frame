import Native from "./NativeDesktopSecureStorage";
function key(value: string) { if (!value.length || value.length > 200) throw new Error("Keychain keys must contain 1–200 characters"); return value; }
async function call<T = void>(method: string, args: object): Promise<T> { return JSON.parse(await Native.call(method, JSON.stringify(args))) as T; }
export const secureStorage = {
  get: (name: string) => call<string | null>("get", { key: key(name) }),
  set: (name: string, value: string) => call("set", { key: key(name), value }),
  remove: (name: string) => call("remove", { key: key(name) }),
};

import { validateItem, type SecureStoreOptions } from "./options";
export type { SecureStoreOptions } from "./options";
/** Basic Expo SecureStore subset; desktop service identity stays project-scoped. */
export async function getItemAsync(key: string, options: SecureStoreOptions = {}): Promise<string | null> {
  validateItem(key, options); return secureStorage.get(key);
}
export async function setItemAsync(key: string, value: string, options: SecureStoreOptions = {}): Promise<void> {
  validateItem(key, options);
  if (typeof value !== "string") throw new TypeError("SecureStore values must be strings");
  await secureStorage.set(key, value);
}
export async function deleteItemAsync(key: string, options: SecureStoreOptions = {}): Promise<void> {
  validateItem(key, options); await secureStorage.remove(key);
}
export async function isAvailableAsync(): Promise<boolean> { return true; }
