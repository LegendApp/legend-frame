import path from "node:path";
import { prepareConfig, selectTarget, supportedPlatforms } from "@legend-apps/desktop-config/config.cjs";
import { dev } from "./dev";
import { findProject } from "./local";
import { hostPlatform } from "./platform";
import { nodeCommand } from "./windows";

// Consume only Legend options. Expo validates its flags, aliases and values.
export function devArguments(args: string[]) {
  const legend: { project?: string; platform?: string; goBinary?: string; noOpen?: boolean } = {};
  const expo: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const [key, ...inline] = arg.split("=");
    if (key === "--no-open") {
      if (inline.length) throw new Error("--no-open does not take a value");
      legend.noOpen = true;
    } else if (["--project", "--platform", "--go-binary"].includes(key!)) {
      const value = inline.length ? inline.join("=") : args[++i];
      if (!value || value.startsWith("-")) throw new Error(`${key} needs a value`);
      if (key === "--project") legend.project = value;
      else if (key === "--platform") legend.platform = value;
      else legend.goBinary = value;
    } else expo.push(arg);
  }
  return { ...legend, expo };
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
    console.log("Legend dev options:\n  --project <directory>    Application directory\n  --platform <platform>    Initial launch target; all declared platforms stay available\n  --go-binary <path>     Register and use a Legend Go binary\n  --no-open                Wait for a launch key (explicit Expo launch flags still apply)\n\nAll other options belong to expo start:\n");
    const child = Bun.spawn(nodeCommand(start, "expo", "expo", ["start", "--help"]), { cwd: start, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    process.exitCode = await child.exited;
    return;
  }
  const root = findProject(start);
  const { desktop, initial } = devTargets(supportedPlatforms(root), options.platform ?? process.env.LEGEND_PLATFORM);
  // This selects only desktop build/signature state in the supervisor. Expo's
  // child uses shared development config and chooses each JS graph per request.
  process.env.LEGEND_PLATFORM = desktop ?? initial;
  const expo = [...options.expo];
  if (!options.noOpen && ["ios", "android", "web"].includes(initial)) expo.push(`--${initial}`);
  if (desktop) {
    await dev(root, options.goBinary, expo, !!options.noOpen || initial !== desktop || (desktop === "windows" ? process.platform !== "win32" : process.platform !== "darwin"));
  } else {
    if (options.goBinary) throw new Error("--go-binary needs a desktop platform in desktop.config.json");
    prepareConfig(root);
    const child = Bun.spawn(nodeCommand(root, "expo", "expo", ["start", root, ...expo]), {
      cwd: root, env: { ...process.env, LEGEND_DEV_SESSION: "1" }, stdin: "inherit", stdout: "inherit", stderr: "inherit",
    });
    const stop = () => child.kill();
    process.on("SIGINT", stop); process.on("SIGTERM", stop);
    try { process.exitCode = await child.exited; }
    finally { process.off("SIGINT", stop); process.off("SIGTERM", stop); }
  }
}
