#!/usr/bin/env bun
import { hostPlatform, type DesktopPlatform } from "./platform.ts";
import path from "node:path";
import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { create, refreshLocalPackages } from "./create.ts";
import { buildMode } from "./build-mode.ts";
import { initializeUpdates } from "./updates.ts";
import { packageApp } from "./package.ts";
import { credentials } from "./credentials.ts";
import { build, analyze } from "./build.ts";
import { dev, launch } from "./dev.ts";
import { doctor, run } from "./commands.ts";
import { findFramework, findProject, legendHome, packageManifest, registerRuntime } from "./local.ts";
import { readJson, stateFile, VERSION, writeJson } from "./project.ts";

try {
  const argv = process.argv.slice(2);
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      project: { type: "string" },
      platform: { type: "string" },
      packages: { type: "string" },
      port: { type: "string" },
      go: { type: argv[0] === "dev" ? "string" : "boolean" },
      dev: { type: "boolean" },
      release: { type: "boolean" },
      preview: { type: "boolean" },
      force: { type: "boolean" },
      "no-open": { type: "boolean" },
      "submission-id": { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.platform && !["macos", "windows"].includes(values.platform)) throw new Error("Platform must be macos or windows.");
  if (values.platform && positionals[0] !== "create" && !(positionals[0] === "sdk" && ["build-go", "pack"].includes(positionals[1] ?? ""))) throw new Error("--platform selects the create or SDK build-go target; other commands use desktop.config.json.");
  const platform = (values.platform ?? hostPlatform()) as DesktopPlatform;
  const projectOption = values.project as string | undefined;
  const start = path.resolve(projectOption ?? process.cwd());
  const project = () => findProject(start);
  const port = values.port === undefined ? undefined : Number(values.port);
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error("Port must be an integer between 1 and 65535.");
  const command = positionals[0];
  if (values.help || !command) {
    console.log(`Legend

  legend create MyApp  Create an app (--platform macos|windows; defaults to this machine)
  legend dev           Develop with Fast Refresh
  legend build         Build a standalone app
  legend package       Sign and notarize a distribution archive

Inside an app: bun dev, bun run build, bun run package

Advanced: updates init <feedURL>, credentials, doctor, analyze, open [app], build --dev, build --preview
Windows: dev and build --dev; production builds are not yet supported.
SDK maintainers: sdk pack, sdk build-go [--platform windows], sdk register <runtime directory>
Overrides: --project <directory>, --port <number>, dev --go <Go.app>, create --packages <manifest>`);
  } else switch (command) {
    case "create": {
      if (!positionals[1]) throw new Error("Usage: legend create MyApp");
      await create(path.resolve(positionals[1]), packageManifest(values.packages as string | undefined), platform);
      break;
    }
    case "sdk": {
      switch (positionals[1]) {
        case "pack": {
          const framework = findFramework(start) ?? findFramework();
          if (!framework) throw new Error("Run legend sdk pack inside the framework checkout.");
          await run(framework, ["bun", path.join(framework, "scripts/pack.ts"), ...(platform === "windows" ? ["--platform=windows"] : [])]);
          break;
        }
        case "register": {
          if (!positionals[2]) throw new Error("Usage: legend sdk register <runtime directory>");
          const result = registerRuntime(positionals[2]);
          console.log(`Registered Legend Go for SDK ${result.runtime.framework}. Apps will discover it automatically.`);
          break;
        }
        case "build-go": {
          let root: string;
          if (projectOption) root = project();
          else {
            root = path.join(legendHome(), "sdk-builds", VERSION, ...(platform === "windows" ? ["windows"] : []), "LegendGo");
            const manifest = packageManifest(values.packages as string | undefined);
            if (!existsSync(path.join(root, "package.json"))) await create(root, manifest, platform);
            else await refreshLocalPackages(root, manifest);
          }
          await build(root, "go", !!values.force);
          break;
        }
        default: throw new Error("SDK commands: legend sdk pack, legend sdk build-go, legend sdk register <runtime directory>");
      }
      break;
    }
    case "doctor":
      await doctor(start);
      console.log("Native toolchain available.");
      break;
    case "updates": {
      if (positionals[1] !== "init" || !positionals[2]) throw new Error("Usage: legend updates init https://example.com/updates/appcast.xml");
      await initializeUpdates(project(), positionals[2]);
      break;
    }
    case "credentials":
      await credentials(project(), true);
      console.log("Signing credentials configured. Run legend package to prepare a distribution archive.");
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
    case "dev":
      await dev(project(), values.go as string | undefined, port, !!values["no-open"]);
      break;
    case "open": {
      // No path opens the project's last standalone build. In-session `o` opens the development runtime.
      const root = positionals[1] ? start : project();
      const record = stateFile(root, "release-build.json");
      if (!positionals[1] && !existsSync(record)) throw new Error("No standalone app has been built. Run bun run build first.");
      const product = positionals[1] ? path.resolve(positionals[1]) : readJson(record).app;
      if (!existsSync(product)) throw new Error("The app binary is missing. Rebuild it with bun run build.");
      const app = await launch(root, product, port);
      await app.exited;
      break;
    }
    default: throw new Error(`Unknown command: ${command}. Run legend --help.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
