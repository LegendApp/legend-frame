import { readAppConfig } from "./project.ts";
import { existsSync, rmSync, watch, appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { binary, run, cancelCommands } from "./commands.ts";
import { build } from "./build.ts";
import { reload } from "./metro.ts";
import { availablePort, findGo, readRuntime, registerRuntime } from "./local.ts";
import { sessionStatus } from "./session-status.ts";
import {
  prepareConfig,
  dependencyStamp,
  goConfigurationIssues,
  incompatible,
  nativePackages,
  readJson,
  projectEnvironment,
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
        ...projectEnvironment(root),
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
  requestedPort?: number,
  noOpen = false,
) {
  const port = await availablePort(requestedPort);
  let target: "go" | "dev" = "go";
  const settingsFile = stateFile(root, "settings.json");
  const settings = existsSync(settingsFile) ? readJson(settingsFile) : {};
  const explicitGo = !!goApp;
  goApp ??= settings.goApp;
  if (goApp) goApp = path.resolve(goApp);
  if (explicitGo) registerRuntime(goApp!);
  if (!explicitGo && settings.target === "dev") target = "dev";
  let current: { app: string; runtime: Runtime } | undefined;
  let appProcess: ReturnType<typeof Bun.spawn> | undefined;
  let launchedRuntime: { app: string; fingerprint: string } | undefined;
  let busy = false;
  let status = "";
  let canBuild = false;
  const appName = readAppConfig(root).expo?.name ?? path.basename(root);
  let stamp = dependencyStamp(root);
  let restartPending = false;
  let reopenPending = false;
  let closing = false;
  let metro: ReturnType<typeof Bun.spawn> | undefined;
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });
  async function startMetro() {
    prepareConfig(root);
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
        await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(1000) }).then(
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
    if (target === "go") {
      if (explicitGo) {
        const runtime = readRuntime(goApp!);
        if (runtime?.mode === "go") current = { app: goApp!, runtime };
      } else {
        current = findGo(native, goApp);
        if (current) goApp = current.app;
      }
    }
    if (target === "dev" && existsSync(stateFile(root, "dev-build.json"))) {
      const record = readJson(stateFile(root, "dev-build.json"));
      const runtime = readRuntime(record.app);
      if (runtime?.mode === "dev") current = { app: record.app, runtime };
    }
    const issues = current ? incompatible(current.runtime, native) : [];
    if (
      current && target === "dev" &&
      current.runtime.fingerprint !== runtimeFor(root, native, "dev").fingerprint
    ) issues.push("Native configuration or host changed.");
    if (target === "go") {
      for (let i = 0; i < issues.length; i++) {
        const name = issues[i]!;
        if (native.some((pkg) => pkg.name === name)) {
          issues[i] = current?.runtime.modules[name]
            ? `${name} has changed since this Go runtime was built.`
            : `${name} isn’t included in Legend Go.`;
        }
      }
      issues.push(...goConfigurationIssues(readAppConfig(root)));
    }
    const view = sessionStatus(target, !!current, issues, appProcess?.exitCode === null);
    if (view.compatible && current && appProcess?.exitCode === null &&
      (launchedRuntime?.app !== current.app || launchedRuntime.fingerprint !== current.runtime.fingerprint)) {
      // Discovery can find a different compatible binary after a native edit.
      // Relaunch before allowing that new runtime selection to serve the app.
      restartPending = true;
      appProcess.kill();
      await appProcess.exited;
      appProcess = undefined;
      reopenPending = true;
    }
    canBuild = view.canBuild;
    const next = view.message;
    writeJson(stateFile(root, "session.json"), {
      compatible: view.compatible,
      reason: next,
      target,
      port,
    });
    // An existing HMR websocket can push code without another bundle request.
    // Stop only the process owned by this session when its native ABI is stale.
    if (!view.compatible && appProcess && appProcess.exitCode === null) {
      appProcess.kill();
      await appProcess.exited;
    }
    if (next !== status) {
      status = next;
      console.log(
        `\nLegend · ${appName}\n\n${status}\n\n${view.actions}`,
      );
    }
    return view.compatible;
  }
  async function open() {
    if ((await check()) && current) {
      if (restartPending) await startMetro();
      if (appProcess && appProcess.exitCode === null) {
        appProcess.kill();
        await appProcess.exited;
      }
      appProcess = await launch(root, current.app, port);
      launchedRuntime = { app: current.app, fingerprint: current.runtime.fingerprint };
      reopenPending = false;
      await check();
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
        "desktop.config.json",
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
        const wasOpen = appProcess?.exitCode === null || reopenPending;
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
        // Selecting a target never starts a compiler. The next prompt offers `b` if needed.
        target = target === "dev" ? "go" : "dev";
        if (appProcess && appProcess.exitCode === null) {
          appProcess.kill();
          await appProcess.exited;
        }
        await open();
        writeJson(settingsFile, { target, goApp });
      } else if (key === "b" && !(await check()) && canBuild) {
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
