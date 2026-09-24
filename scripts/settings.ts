import path from "node:path";
import { create } from "../packages/cli/src/create";
import { run } from "../packages/cli/src/commands";
import { hostPlatform } from "../packages/cli/src/platform";
const framework = path.resolve(import.meta.dir, "..");
await run(framework, ["bun", "scripts/pack.ts"]);
await create(path.resolve(process.argv[2] ?? ".spark/examples/Settings"), path.join(framework, "artifacts/packages/manifest.json"), hostPlatform(), true);
