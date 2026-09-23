import path from "node:path";
import { create } from "../packages/cli/src/create.ts";
import { run } from "../packages/cli/src/commands.ts";
import { hostPlatform } from "../packages/cli/src/platform.ts";
const framework = path.resolve(import.meta.dirname, "..");
await run(framework, [process.execPath, "scripts/pack.ts"]);
await create(path.resolve(process.argv[2] ?? ".frame/examples/Settings"), path.join(framework, "artifacts/packages/manifest.json"), hostPlatform(), true);
