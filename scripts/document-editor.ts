import path from "node:path";
import { create } from "../packages/cli/src/create";
import { run } from "../packages/cli/src/commands";
import { hostPlatform } from "../packages/cli/src/platform";
export async function prepareDocumentEditor(root: string) {
  const framework = path.resolve(import.meta.dir, "..");
  await create(root, path.join(framework, "artifacts/packages/manifest.json"), hostPlatform(), true, "document-editor");
  return root;
}
if (import.meta.main) {
  const framework = path.resolve(import.meta.dir, "..");
  await run(framework, ["bun", "scripts/pack.ts", ...(process.platform === "win32" ? ["--platform=windows"] : [])]);
  await prepareDocumentEditor(path.resolve(process.argv[2] ?? ".legend/examples/DocumentEditor"));
}
