import { existsSync } from "node:fs";
import path from "node:path";
import { readConfig } from "@legend-apps/desktop-config/config.cjs";
export type AppPlatform = "ios" | "android" | "web" | DesktopPlatform;
export type DesktopPlatform = "macos" | "windows";
export const hostPlatform = (): DesktopPlatform => process.platform === "win32" ? "windows" : "macos";
export const architecture = (platform: DesktopPlatform) => platform === "windows" ? "x64" as const : "arm64" as const;
export function projectPlatform(root: string): DesktopPlatform {
  if (!["app.json", "desktop.config.json"].some(name => existsSync(path.join(root, name)))) return "macos";
  const platforms = readConfig(root).expo?.platforms ?? ["macos"];
  if (platforms.length !== 1 || !["macos", "windows"].includes(platforms[0])) throw new Error("Select a desktop target with --platform macos or --platform windows.");
  return platforms[0];
}
