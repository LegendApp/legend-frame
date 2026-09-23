import { packageManager, managerCommand, localArchive } from "./package-manager.ts";
import path from "node:path";
import { readJson, writeJson } from "./project.ts";
import { run } from "./commands.ts";
import type { DesktopPlatform } from "./platform.ts";
/** Modules shipped in the maintained client, in addition to its platform starter. */
export async function prepareGoProfile(root: string, manifest: string, platform: DesktopPlatform) {
  const pkg = readJson(path.join(root, "package.json"));
  const archives = readJson(manifest);
  if (!archives["@legendapp/spark"]) throw new Error("Spark Runner profile requires @legendapp/spark");
  pkg.dependencies["@legendapp/spark"] = localArchive(path.resolve(path.dirname(manifest), archives["@legendapp/spark"]));
  pkg.dependencies["@react-native-async-storage/async-storage"] = "2.2.0";
  // Expo's mobile development client brings this native utility into universal
  // consumers' conservative graph. It builds on macOS and must be present in Go.
  if (platform === "macos") pkg.dependencies["expo-json-utils"] = "0.15.0";
  writeJson(path.join(root, "package.json"), pkg);
  await run(root, managerCommand(packageManager(root), ["install"]));
}
