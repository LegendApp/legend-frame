export type { SecureStoreOptions } from "./options";
export async function isAvailableAsync(): Promise<boolean> { return false; }
const unavailable = async (..._args: unknown[]): Promise<never> => { throw Object.assign(new Error("Secure storage is unavailable on this platform"), { code: "E_UNAVAILABLE" }); };
export const getItemAsync = unavailable, setItemAsync = unavailable, deleteItemAsync = unavailable;
export const secureStorage = { get: getItemAsync, set: setItemAsync, remove: deleteItemAsync };
