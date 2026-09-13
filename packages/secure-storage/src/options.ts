/** Only default storage is portable today. Authentication/service overrides are not implemented. */
export type SecureStoreOptions = Record<string, never>;
export function validateItem(key: string, options: SecureStoreOptions) {
  if (typeof key !== "string" || !/^[\w.-]+$/.test(key) || key.length > 200) throw new Error("SecureStore keys must be 1–200 alphanumeric, '.', '-', or '_' characters");
  if (!options || Object.keys(options).length) throw Object.assign(new Error("SecureStore options are not supported by the shared API yet"), { code: "E_UNSUPPORTED_OPTION" });
}
