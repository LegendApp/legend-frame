import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnProcess } from "./process.ts";

/** npm is pinned tooling for tarball format, independently of the app's installer. */
export async function packArchive(directory: string, destination: string) {
  const req = createRequire(import.meta.url);
  const npm = path.join(path.dirname(req.resolve("npm/package.json")), "bin/npm-cli.js");
  const temporary = mkdtempSync(path.join(os.tmpdir(), "spark-pack-"));
  try {
    const child = spawnProcess([process.execPath, npm, "pack", "--json", "--ignore-scripts", "--cache", path.join(temporary, "cache"), "--pack-destination", temporary], { cwd: directory });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    if (code) throw new Error(`Could not pack ${directory}: ${stderr}\n${stdout}`);
    const [result] = JSON.parse(stdout);
    mkdirSync(path.dirname(destination), { recursive: true });
    renameSync(path.join(temporary, result.filename), destination);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
