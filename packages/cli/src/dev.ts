import { existsSync, rmSync, watch, appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { binary, run, cancelCommands } from "./commands.ts";
import { build } from "./build.ts";
import { reload } from "./metro.ts";
import {
  dependencyStamp,
  goConfigurationIssues,
  incompatible,
  nativePackages,
  readJson,
  runtimeFor,
  stateFile,
  writeJson,
  type Runtime,
} from "./project.ts";

export async function launch(root: string, app: string, port?: number) {
  const info = await run(
    root,
    [
      "/usr/libexec/PlistBuddy",
      "-c",
      "Print :CFBundleExecutable",
      path.join(app, "Contents/Info.plist"),
    ],
    { capture: true },
  );
  const executable = path.join(app, "Contents/MacOS", info.trim());
  const runtimeFile = path.join(app, "Contents/Resources/legend-runtime.json");
  const developmentJS =
    !existsSync(runtimeFile) || readJson(runtimeFile).mode !== "preview";
  // Direct executable launch retains the exact product path and process ownership.
  // RN's native packager websocket reads RCT_jsLocation independently of the
  // JS bundle URL. The process argument domain avoids persistent preference edits.
  return Bun.spawn(
    [executable, ...(port ? ["-RCT_jsLocation", `127.0.0.1:${port}`] : [])],
    {
      cwd: root,
      env: {
        ...process.env,
        ...(port
          ? {
              LEGEND_BUNDLE_URL: `http://127.0.0.1:${port}/index.bundle?platform=macos&dev=${developmentJS}&minify=false`,
            }
          : {}),
      },
      stdout: "inherit",
      stderr: "inherit",
    },
  );
}
export async function dev(
  root: string,
  goApp: string | undefined,
  port = 19120,
  noOpen = false,
) {
  if (
    await fetch(`http://127.0.0.1:${port}/status`).then(
      () => true,
      () => false,
    )
  )
    throw new Error(`Port ${port} is already in use. Choose --port.`);
  let target: "go" | "dev" = "go";
  const settingsFile = stateFile(root, "settings.json");
  const settings = existsSync(settingsFile) ? readJson(settingsFile) : {};
  const explicitGo = !!goApp;
  goApp ??= settings.goApp;
  if (goApp) goApp = path.resolve(goApp);
  if (!explicitGo && settings.target === "dev") target = "dev";
  let current: { app: string; runtime: Runtime } | undefined;
  let appProcess: ReturnType<typeof Bun.spawn> | undefined;
  let busy = false;
  let status = "";
  let stamp = dependencyStamp(root);
  let restartPending = false;
  let closing = false;
  let metro: ReturnType<typeof Bun.spawn> | undefined;
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  async function startMetro() {
    const previous = metro;
    metro = undefined;
    if (previous && previous.exitCode === null) {
      previous.kill();
      await previous.exited;
    }
    const env = { ...process.env };
    delete env.CI;
    mkdirSync(stateFile(root, "logs"), { recursive: true });
    const log = stateFile(root, "logs/metro.log");
    const child = Bun.spawn(
      [
        binary(root, "expo"),
        "start",
        "--localhost",
        "--port",
        String(port),
        "--max-workers",
        "2",
      ],
      { cwd: root, env, stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    );
    metro = child;
    async function logStream(stream: ReadableStream<Uint8Array>) {
      for await (const chunk of stream) appendFileSync(log, chunk);
    }
    void logStream(child.stdout);
    void logStream(child.stderr);
    void child.exited.then(() => {
      if (metro === child && !closing) {
        console.error(`Metro exited. See ${log}`);
        close();
      }
    });
    for (let attempt = 0; attempt < 120; attempt++) {
      if (child.exitCode !== null)
        throw new Error(`Metro failed to start. See ${log}`);
      if (
        await fetch(`http://127.0.0.1:${port}/status`).then(
          (r) => r.ok,
          () => false,
        )
      ) {
        console.log(`Metro ready at http://127.0.0.1:${port} (log: ${log})`);
        restartPending = false;
        return;
      }
      await Bun.sleep(500);
    }
    child.kill();
    throw new Error(`Metro did not become ready. See ${log}`);
  }
  async function check() {
    const native = nativePackages(root);
    current = undefined;
    if (
      target === "go" &&
      goApp &&
      existsSync(path.join(goApp, "Contents/Resources/legend-runtime.json"))
    )
      current = {
        app: goApp,
        runtime: readJson(
          path.join(goApp, "Contents/Resources/legend-runtime.json"),
        ),
      };
    if (target === "dev" && existsSync(stateFile(root, "dev-build.json")))
      current = readJson(stateFile(root, "dev-build.json"));
    const issues = current
      ? incompatible(current.runtime, native)
      : [`No ${target} runtime available`];
    if (
      current &&
      target === "dev" &&
      current.runtime.fingerprint !==
        runtimeFor(root, native, "dev").fingerprint
    )
      issues.push("native configuration or host changed");
    if (target === "go")
      issues.push(
        ...goConfigurationIssues(readJson(path.join(root, "app.json"))),
      );
    const next = issues.length
      ? `Custom development build required: ${issues.join(", ")}`
      : `${target === "go" ? "Legend Go" : "Development build"} ready`;
    writeJson(stateFile(root, "session.json"), {
      compatible: !issues.length,
      reason: next,
      target,
      port,
    });
    // An existing HMR websocket can push code without another bundle request.
    // Stop only the process owned by this session when its native ABI is stale.
    if (issues.length && appProcess && appProcess.exitCode === null) {
      appProcess.kill();
      await appProcess.exited;
    }
    if (next !== status) {
      status = next;
      console.log(
        `\n${status}\ns  Switch/build · o  Open · r  Reload · j  Debugger · q  Quit`,
      );
    }
    return !issues.length;
  }
  async function open() {
    if ((await check()) && current) {
      if (restartPending) await startMetro();
      if (appProcess && appProcess.exitCode === null) {
        appProcess.kill();
        await appProcess.exited;
      }
      appProcess = await launch(root, current.app, port);
    }
  }
  function close() {
    if (closing) return;
    closing = true;
    clearInterval(timer);
    clearTimeout(debounce);
    watcher.close();
    appProcess?.kill();
    metro?.kill();
    cancelCommands(root);
    rmSync(stateFile(root, "session.json"), { force: true });
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    process.stdin.pause();
    finish();
  }
  let debounce: ReturnType<typeof setTimeout> | undefined;
  // Suspend bundle requests promptly while a package manager changes the graph.
  const watcher = watch(root, (_event, filename) => {
    if (
      !filename ||
      ![
        "package.json",
        "bun.lock",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "app.json",
        "metro.config.js",
      ].includes(String(filename)) ||
      closing
    )
      return;
    writeJson(stateFile(root, "session.json"), {
      compatible: false,
      reason: "Dependencies changed; checking runtime",
    });
    restartPending = true;
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (!busy) void refresh();
    }, 400);
  });
  async function refresh() {
    if (busy || closing) return;
    busy = true;
    try {
      const next = dependencyStamp(root);
      if (next !== stamp) {
        restartPending = true;
        stamp = next;
      }
      const compatible = await check();
      if (restartPending && compatible) {
        const wasOpen = appProcess?.exitCode === null;
        await startMetro();
        // A new Metro dependency map needs a fresh app connection, not the old HMR graph.
        if (wasOpen) await open();
      }
    } catch (error) {
      writeJson(stateFile(root, "session.json"), {
        compatible: false,
        reason: String(error),
      });
      console.error(String(error));
    } finally {
      busy = false;
    }
  }
  const timer = setInterval(refresh, 2000);
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
  try {
    busy = true;
    await check();
    await startMetro();
    if (!noOpen) await open();
  } catch (error) {
    close();
    throw error;
  } finally {
    busy = false;
  }
  if (process.stdin.isTTY) process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", async (data) => {
    const key = data.toString().trim().toLowerCase();
    if (key === "q" || key === "\u0003") {
      close();
      return;
    }
    if (busy || closing) return;
    busy = true;
    try {
      if (key === "s") {
        if (target === "dev" && (await check())) {
          target = "go";
          await open();
        } else {
          writeJson(stateFile(root, "session.json"), {
            compatible: false,
            reason: "Preparing custom development build",
          });
          if (appProcess && appProcess.exitCode === null) {
            appProcess.kill();
            await appProcess.exited;
          }
          await build(root, "dev");
          if (closing) return;
          target = "dev";
          restartPending = true;
          await open();
        }
        writeJson(settingsFile, { target, goApp });
      } else if (key === "o") await open();
      else if (key === "r") await reload(port);
      else if (key === "j") {
        const targets = (await fetch(`http://127.0.0.1:${port}/json/list`).then(
          (r) => r.json(),
        )) as { id: string; reactNative?: { logicalDeviceId?: string } }[];
        const inspector = targets
          .reverse()
          .find((item) => item.reactNative?.logicalDeviceId);
        if (!inspector)
          throw new Error("No compatible Hermes debugger is connected.");
        const response = await fetch(
          `http://127.0.0.1:${port}/open-debugger?target=${encodeURIComponent(inspector.id)}`,
          { method: "POST", signal: AbortSignal.timeout(5000) },
        );
        if (!response.ok)
          throw new Error(
            `Debugger could not open (${response.status}). See the Metro log.`,
          );
      }
    } catch (error) {
      if (!closing) {
        console.error(String(error));
        await check();
      }
    } finally {
      busy = false;
    }
  });
  writeJson(settingsFile, { target, goApp });
  await finished;
  process.off("SIGINT", close);
  process.off("SIGTERM", close);
}
