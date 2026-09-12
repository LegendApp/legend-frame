export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type SettingsStorage = { read(key: string): Promise<string | null>; write(key: string, value: string): Promise<void>; remove(key: string): Promise<void> };
function serialize(value: Json): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item === undefined || typeof item === "function" || typeof item === "symbol" || typeof item === "bigint" ||
        (typeof item === "number" && !Number.isFinite(item))) throw new Error("Settings must contain finite JSON values");
    return item;
  });
}
/** Mutations are serialized per key, including failed updates. Await writes before quitting. */
export function createSettingsStore(storage: SettingsStorage) {
  const pending = new Map<string, Promise<unknown>>();
  const validate = (key: string) => { if (!key.length || key.length > 200) throw new Error("Setting keys must contain 1–200 characters"); };
  function enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    validate(key);
    const next = (pending.get(key) ?? Promise.resolve()).catch(() => {}).then(operation);
    pending.set(key, next);
    void next.finally(() => { if (pending.get(key) === next) pending.delete(key); }).catch(() => {});
    return next;
  }
  async function read<T extends Json>(key: string): Promise<T | null> {
    const value = await storage.read(key);
    // Corruption is an error; never silently replace it with defaults.
    return value === null ? null : JSON.parse(value) as T;
  }
  return {
    get<T extends Json>(key: string) { return enqueue(key, () => read<T>(key)); },
    set(key: string, value: Json) { const json = serialize(value); return enqueue(key, () => storage.write(key, json)); },
    remove(key: string) { return enqueue(key, () => storage.remove(key)); },
    update<T extends Json>(key: string, update: (value: T | null) => T | Promise<T>) {
      return enqueue(key, async () => {
        const value = await update(await read<T>(key));
        await storage.write(key, serialize(value)); return value;
      });
    },
  };
}
