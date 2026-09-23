import { spawnProcess } from "./process.ts";
import path from "node:path";
import { prepareConfig, selectTarget, supportedPlatforms } from "@legendapp/frame-desktop-config/config.cjs";
import { dev } from "./dev.ts";
import { findProject } from "./local.ts";
import { hostPlatform } from "./platform.ts";
import { nodeCommand } from "./windows.ts";

// Consume only frame options. Expo validates its flags, aliases and values.
export function devArguments(args: string[]) {
  const frame: { project?: string; platform?: string; prebuiltBinary?: string; noOpen?: boolean } = {};
  const expo: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const [key, ...inline] = arg.split("=");
    if (key === "--no-open") {
      if (inline.length) throw new Error("--no-open does not take a value");
      frame.noOpen = true;
    } else if (["--project", "--platform", "--runner-binary", "--prebuilt-binary", "--go-binary"].includes(key!)) {
      const value = inline.length ? inline.join("=") : args[++i];
      if (!value || value.startsWith("-")) throw new Error(`${key} needs a value`);
      if (key === "--project") frame.project = value;
      else if (key === "--platform") frame.platform = value;
      else frame.prebuiltBinary = value;
    } else expo.push(arg);
  }
  return { ...frame, expo };
}

export function devTargets(platforms: string[], initial?: string, host = hostPlatform()) {
  if (initial && !platforms.includes(initial)) throw new Error(`Platform ${initial} is not supported by this project`);
  const desktop = initial && ["macos", "windows"].includes(initial) ? initial
    : platforms.includes(host) ? host : platforms.find(p => ["macos", "windows"].includes(p));
  return { desktop, initial: selectTarget(platforms, initial) };
}

export async function devCommand(args: string[]) {
  const options = devArguments(args);
  const start = path.resolve(options.project ?? process.cwd());
  if (options.expo.includes("--help") || options.expo.includes("-h")) {
    console.log("frame dev options:\n  --project <directory>    Application directory\n  --platform <platform>    Initial launch target; all declared platforms stay available\n  --runner-binary <path>  Register and use a Frame Runner\n  --no-open                Wait for a launch key (explicit Expo launch flags still apply)\n\nAll other options belong to expo start:\n");
    const child = spawnProcess(nodeCommand(start, "expo", "expo", ["start", "--help"]), { cwd: start, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    process.exitCode = await child.exited;
    return;
  }
  const root = findProject(start);
  const { desktop, initial } = devTargets(supportedPlatforms(root), options.platform ?? process.env.FRAME_PLATFORM);
  // This selects only desktop build/signature state in the supervisor. Expo's
  // child uses shared development config and chooses each JS graph per request.
  process.env.FRAME_PLATFORM = desktop ?? initial;
  const expo = [...options.expo];
  if (!options.noOpen && ["ios", "android", "web"].includes(initial)) expo.push(`--${initial}`);
  if (desktop) {
    await dev(root, options.prebuiltBinary, expo, !!options.noOpen || initial !== desktop || (desktop === "windows" ? process.platform !== "win32" : process.platform !== "darwin"));
  } else {
    if (options.prebuiltBinary) throw new Error("--runner-binary needs a desktop platform in desktop.config.json");
    prepareConfig(root);
    const child = spawnProcess(nodeCommand(root, "expo", "expo", ["start", root, ...expo]), {
      cwd: root, env: { ...process.env, FRAME_DEV_SESSION: "1" }, stdin: "inherit", stdout: "inherit", stderr: "inherit",
    });
    const stop = () => child.kill();
    process.on("SIGINT", stop); process.on("SIGTERM", stop);
    try { process.exitCode = await child.exited; }
    finally { process.off("SIGINT", stop); process.off("SIGTERM", stop); }
  }
}
