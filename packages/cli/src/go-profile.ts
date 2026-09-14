import path from "node:path";
import { readJson, writeJson } from "./project";
import { run } from "./commands";
import type { DesktopPlatform } from "./platform";
/** Modules shipped in the maintained client, in addition to its platform starter. */
export async function prepareGoProfile(root: string, manifest: string, platform: DesktopPlatform) {
  const pkg = readJson(path.join(root, "package.json"));
  const archives = readJson(manifest);
  for (const suffix of ["ui", "clipboard", "secure-storage", "desktop-links", "file-dialog", "audio"]) {
    const name = `@legend-apps/${suffix}`;
    if (!archives[name]) throw new Error(`Go profile requires ${name}`);
    pkg.dependencies[name] = path.resolve(path.dirname(manifest), archives[name]);
  }
  pkg.dependencies["@react-native-async-storage/async-storage"] = "2.2.0";
  // Expo's mobile development client brings this native utility into universal
  // consumers' conservative graph. It builds on macOS and must be present in Go.
  if (platform === "macos") pkg.dependencies["expo-json-utils"] = "0.15.0";
  writeJson(path.join(root, "package.json"), pkg);
  await run(root, ["bun", "install"]);
}
