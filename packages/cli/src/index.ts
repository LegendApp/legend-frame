#!/usr/bin/env bun
import path from "node:path";
import { create } from "./create.ts";
import { build, analyze } from "./build.ts";
import { dev, launch } from "./dev.ts";
import { doctor } from "./commands.ts";

const args = process.argv.slice(2);
function option(name: string) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}
const root = path.resolve(option("--project") ?? process.cwd());
try {
  switch (args[0]) {
    case "create": {
      if (!args[1] || !option("--packages"))
        throw new Error(
          "Usage: legend create <directory> --packages <local archive manifest>",
        );
      await create(path.resolve(args[1]), path.resolve(option("--packages")!));
      break;
    }
    case "doctor":
      await doctor(root);
      console.log("Native toolchain available.");
      break;
    case "build":
      await build(
        root,
        args.includes("--go")
          ? "go"
          : args.includes("--release")
            ? "release"
            : args.includes("--preview")
              ? "preview"
              : "dev",
        args.includes("--force"),
      );
      break;
    case "analyze": {
      const result = await analyze(root);
      console.log(
        JSON.stringify(
          {
            included: result.included.map((p) => p.name),
            excluded: result.excluded.map((p) => p.name),
          },
          null,
          2,
        ),
      );
      break;
    }
    case "dev":
      await dev(
        root,
        option("--go"),
        Number(option("--port") ?? 19120),
        args.includes("--no-open"),
      );
      break;
    case "open": {
      if (!args[1])
        throw new Error("Usage: legend open <app> [--port <metro-port>]");
      const app = await launch(
        root,
        path.resolve(args[1]),
        option("--port") ? Number(option("--port")) : undefined,
      );
      await app.exited;
      break;
    }
    default:
      console.log(
        "Legend prototype: create, dev, build [--go|--release], analyze, doctor, open. See docs/development.md.",
      );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
