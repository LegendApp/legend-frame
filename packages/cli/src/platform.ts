import { existsSync } from "node:fs";
import path from "node:path";
import { machine } from "node:os";
import { readConfig } from "@legend-apps/desktop-config/config.cjs";
export type AppPlatform = "ios" | "android" | "web" | DesktopPlatform;
export type DesktopPlatform = "macos" | "windows";
export const hostPlatform = (): DesktopPlatform => process.platform === "win32" ? "windows" : "macos";
export type WindowsArchitecture = "arm64" | "x64";
export function windowsArchitecture(
  host: string = process.platform,
  machineArch: string = machine(),
  env: Partial<NodeJS.ProcessEnv> = process.env,
): WindowsArchitecture {
  const explicit = env.LEGEND_WINDOWS_ARCH?.toLowerCase();
  if (explicit !== undefined) {
    if (explicit === "arm64" || explicit === "x64") return explicit;
    throw new Error("LEGEND_WINDOWS_ARCH must be arm64 or x64.");
  }
  // Use the OS CPU rather than process.arch: Node/Bun may run under emulation.
  if (host === "win32") {
    if (machineArch.toLowerCase() === "arm64" || machineArch.toLowerCase() === "aarch64") return "arm64";
    const native = (env.PROCESSOR_ARCHITEW6432 ?? env.PROCESSOR_ARCHITECTURE ?? machineArch).toLowerCase();
    if (native === "arm64") return "arm64";
    if (["amd64", "x64", "x86_64"].includes(native)) return "x64";
    throw new Error(`Unsupported Windows architecture: ${native}. Use Windows x64 or ARM64.`);
  }
  return "x64";
}
export const architecture = (platform: DesktopPlatform) => platform === "windows" ? windowsArchitecture() : "arm64" as const;
export function projectPlatform(root: string): DesktopPlatform {
  if (!["app.json", "desktop.config.json"].some(name => existsSync(path.join(root, name)))) return "macos";
  const platforms = readConfig(root).expo?.platforms ?? ["macos"];
  if (platforms.length !== 1 || !["macos", "windows"].includes(platforms[0])) throw new Error("Select a desktop target with --platform macos or --platform windows.");
  return platforms[0];
}
