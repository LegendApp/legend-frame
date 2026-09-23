import type { PackageManager } from "./package-manager.ts";
import { spawnProcess } from "./process.ts";
import { examples, type Example } from "./examples.ts";
import { prepareGoProfile } from "./go-profile.ts";
import { exportSDK, importSDK } from "./sdk-transfer.ts";
import { hostPlatform, type AppPlatform } from "./platform.ts";
import path from "node:path";
import { parseArgs } from "node:util";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { prepareConfig, readConfig, isExpoProject } from "@legendapp/frame-desktop-config/config.cjs";
import { nodeCommand, prepareWindows } from "./windows.ts";
import { create, refreshLocalPackages } from "./create.ts";
import { addDesktop } from "./add-desktop.ts";
import { buildMode } from "./build-mode.ts";
import { initializeUpdates } from "./updates.ts";
import { packageApp } from "./package.ts";
import { credentials } from "./credentials.ts";
import { build, analyze } from "./build.ts";
import { launch } from "./dev.ts";
import { doctor, run } from "./commands.ts";
import { findFramework, findProject, frameHome, packageManifest, registerRuntime } from "./local.ts";
import { readJson, stateFile, VERSION, writeJson } from "./project.ts";
import { devCommand } from "./dev-command.ts";

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "dev") return devCommand(argv.slice(1));
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      example: { type: "string" },
      "package-manager": { type: "string" },
      runtime: { type: "string", multiple: true },
      universal: { type: "boolean" },
      device: { type: "string" },
      project: { type: "string" },
      platform: { type: "string" },
      packages: { type: "string" },
      port: { type: "string" },
      runner: { type: "boolean" },
      prebuilt: { type: "boolean" },
      go: { type: "boolean" }, // Legacy desktop build alias; dev --go belongs to Expo.
      dev: { type: "boolean" },
      release: { type: "boolean" },
      preview: { type: "boolean" },
      force: { type: "boolean" },
      "no-open": { type: "boolean" },
      "submission-id": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.platform && !["macos", "windows", "ios", "android", "web"].includes(values.platform)) throw new Error("Platform must be macos, windows, ios, android, or web.");
  if (values.platform) process.env.FRAME_PLATFORM = values.platform;
  const platform = (values.platform ?? hostPlatform()) as AppPlatform;
  const projectOption = values.project as string | undefined;
  const start = path.resolve(projectOption ?? process.cwd());
  const project = () => findProject(start);
  const port = values.port === undefined ? undefined : Number(values.port);
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error("Port must be an integer between 1 and 65535.");
  const command = positionals[0];
  if (!values.help && !values.platform && !(command === "open" && positionals[1]) && ["build", "prebuild", "analyze", "package", "open", "updates", "credentials"].includes(command ?? "") && isExpoProject(project())) {
    process.env.FRAME_PLATFORM = readConfig(project()).expo.platforms[0];
  }
  if (values.example && (command !== "create" || !examples.includes(values.example as Example))) throw new Error(`Use create --example ${examples.join(" | ")}`);
  if (values.universal && command !== "create") throw new Error("--universal is a create option.");
  if (!values.help && ["build", "prebuild"].includes(command ?? "")) {
    const root = project();
    const selected = readConfig(root).expo.platforms[0];
    if (["ios", "android", "web"].includes(selected)) {
      if (command === "build" && selected === "web") throw new Error("Use expo export --platform web for web production output.");
      if (command === "prebuild" && selected === "web") throw new Error("Web has no native project to prebuild.");
      if (values.runner || values.prebuilt || values.go || values.release || values.preview || (command === "build" && !values.dev)) throw new Error("Mobile builds use --dev in this slice; Expo owns mobile distribution workflows.");
      prepareConfig(root);
      const args = command === "prebuild" ? ["prebuild", "--platform", selected, "--no-install"] : [`run:${selected}`, ...(values.device ? ["--device", values.device] : []), ...(port ? ["--port", String(port)] : [])];
      const manifest = readFileSync(path.join(root, "package.json"), "utf8");
      try {
        const child = spawnProcess(nodeCommand(root, "expo", "expo", args), { cwd: root, env: process.env, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
        process.exitCode = await child.exited;
      } finally {
        writeFileSync(path.join(root, "package.json"), manifest);
      }
      process.exit(process.exitCode);
    }
  }
  if (values.help || !command) {
    console.log(`Legend Frame

  frame create MyApp  Create an app (--universal for shared Settings; --platform selects a target)
  frame create MyEditor --example document-editor  Shared document editor
  frame create MyNotes --example notes-lite        Local notes
  frame create MyMusic --example music-lite        Audio queue
  frame create MyDiff --example diff-lite          Text comparison
  frame add desktop  Add desktop to an existing Expo app without replacing its entry point
  frame dev           Develop with Fast Refresh
  frame build         Build a standalone desktop app
  frame prebuild      Generate a Windows/mobile native project
  frame package       Sign and notarize a distribution archive

Inside an app: npm run dev, npm run build, npm run package (or pnpm, yarn, bun)

Advanced: updates init <feedURL>, credentials, doctor, analyze, open [app], build --dev, build --preview
Windows: dev and build --dev; production builds are not yet supported.
SDK transfer: sdk export <directory> [--runtime <Frame Runner directory>], sdk import <directory>
SDK maintainers: sdk pack, sdk build-runner [--platform windows], sdk register <runtime directory>
Targets: dev/build/prebuild --platform macos|windows|ios|android|web
Overrides: --project <directory>, --port <number>, dev --runner-binary <runtime path>, create --packages <manifest>, create --package-manager npm|pnpm|yarn|bun`);
  } else switch (command) {
    case "add": {
      if (positionals[1] !== "desktop") throw new Error("Usage: frame add desktop [--project <Expo app>]");
      await addDesktop(start, packageManifest(values.packages as string | undefined));
      break;
    }
    case "create": {
      if (!positionals[1]) throw new Error("Usage: frame create MyApp");
      if (!values.universal && !["macos", "windows"].includes(platform)) throw new Error("Use create --universal for mobile/web targets");
      await create(path.resolve(positionals[1]), packageManifest(values.packages as string | undefined), platform, !!values.universal || !!values.example, values.example as Example | undefined, values["package-manager"] as PackageManager | undefined);
      break;
    }
    case "sdk": {
      if (!["macos", "windows"].includes(platform)) throw new Error("SDK commands require a desktop target");
      switch (positionals[1]) {
        case "export": {
          if (!positionals[2]) throw new Error("Usage: frame sdk export <directory> [--runtime <Frame Runner directory>]");
          console.log(`Exported SDK to ${exportSDK(packageManifest(values.packages as string | undefined), positionals[2], values.runtime)}. Transfer the directory and run node install.mjs there.`);
          break;
        }
        case "import": {
          if (!positionals[2]) throw new Error("Usage: frame sdk import <SDK directory>");
          console.log(`Registered SDK from ${importSDK(positionals[2])}`);
          break;
        }
        case "pack": {
          const framework = findFramework(start) ?? findFramework();
          if (!framework) throw new Error("Run frame sdk pack inside the framework checkout.");
          await run(framework, [process.execPath, path.join(framework, "scripts/pack.ts"), ...(platform === "windows" ? ["--platform=windows"] : [])]);
          break;
        }
        case "register": {
          if (!positionals[2]) throw new Error("Usage: frame sdk register <runtime directory>");
          const result = registerRuntime(positionals[2]);
          console.log(`Registered Frame Runner for SDK ${result.runtime.framework}. Apps will discover it automatically.`);
          break;
        }
        case "build-go": // Legacy alias; persisted runtime metadata still uses "go".
        case "build-prebuilt": // Legacy command alias.
        case "build-runner": {
          let root: string;
          if (projectOption) root = project();
          else {
            root = path.join(frameHome(), "sdk-builds", VERSION, ...(platform === "windows" ? ["windows"] : []), "FrameRunner");
            const manifest = packageManifest(values.packages as string | undefined);
            if (!existsSync(path.join(root, "package.json"))) await create(root, manifest, platform);
            else await refreshLocalPackages(root, manifest);
            await prepareGoProfile(root, manifest, platform as "macos" | "windows");
          }
          await build(root, "go", !!values.force);
          break;
        }
        default: throw new Error("SDK commands: frame sdk pack, frame sdk build-runner, frame sdk register <runtime directory>");
      }
      break;
    }
    case "prebuild":
      if (readConfig(project()).expo.platforms[0] !== "windows") throw new Error("For macOS, frame build --dev generates and builds the native project.");
      await prepareWindows(project(), "dev");
      break;
    case "doctor":
      await doctor(start);
      console.log("Native toolchain available.");
      break;
    case "updates": {
      if (positionals[1] !== "init" || !positionals[2]) throw new Error("Usage: frame updates init https://example.com/updates/appcast.xml");
      await initializeUpdates(project(), positionals[2]);
      break;
    }
    case "credentials":
      await credentials(project(), true);
      console.log("Signing credentials configured. Run frame package to prepare a distribution archive.");
      break;
    case "package": {
      if (process.platform !== "darwin" || process.arch !== "arm64") throw new Error("Packaging currently supports Apple Silicon macOS only.");
      const result = await packageApp(project(), { force: !!values.force, submissionId: values["submission-id"] as string | undefined });
      if (result.pending) process.exitCode = 2;
      break;
    }
    case "build": {
      const mode = buildMode(values);
      const root = project();
      await build(root, mode, !!values.force);
      if (mode === "dev") {
        const settings = stateFile(root, "settings.json");
        writeJson(settings, { ...(existsSync(settings) ? readJson(settings) : {}), target: "dev" });
      }
      break;
    }
    case "analyze": {
      const result = await analyze(project());
      console.log(JSON.stringify({ included: result.included.map((p) => p.name), excluded: result.excluded.map((p) => p.name) }, null, 2));
      break;
    }
    case "open": {
      // No path opens the project's last standalone build. In-session `o` opens the development runtime.
      const root = positionals[1] ? start : project();
      const record = stateFile(root, "release-build.json");
      if (!positionals[1] && !existsSync(record)) throw new Error("No standalone app has been built. Run npm run build first.");
      const product = positionals[1] ? path.resolve(positionals[1]) : readJson(record).app;
      if (!existsSync(product)) throw new Error("The app binary is missing. Rebuild it with npm run build.");
      const app = await launch(root, product, port);
      await app.exited;
      break;
    }
    default: throw new Error(`Unknown command: ${command}. Run frame --help.`);
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
