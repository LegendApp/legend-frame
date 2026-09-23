import path from "node:path";
import { create } from "../packages/cli/src/create.ts";
import { run } from "../packages/cli/src/commands.ts";
import { hostPlatform } from "../packages/cli/src/platform.ts";
export async function prepareDocumentEditor(root: string) {
  const framework = path.resolve(import.meta.dirname, "..");
  await create(root, path.join(framework, "artifacts/packages/manifest.json"), hostPlatform(), true, "document-editor");
  return root;
}
if (import.meta.main) {
  const framework = path.resolve(import.meta.dirname, "..");
  await run(framework, [process.execPath, "scripts/pack.ts", ...(process.platform === "win32" ? ["--platform=windows"] : [])]);
  await prepareDocumentEditor(path.resolve(process.argv[2] ?? ".spark/examples/DocumentEditor"));
}
