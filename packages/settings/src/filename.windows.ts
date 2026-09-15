export function settingsFilename(key: string) {
  let encoded = encodeURIComponent(key);
  // Windows reserves device names even when an extension is present. Escaping the
  // first character is collision-free because literal percent signs are encoded.
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(encoded)) {
    encoded = `%${encoded.charCodeAt(0).toString(16).toUpperCase()}${encoded.slice(1)}`;
  }
  return `${encoded}.json`;
}
