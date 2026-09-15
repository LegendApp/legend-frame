import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { readJson, writeJson } from "../packages/cli/src/project";

export async function packTemplates(root: string, output: string, packages: Record<string, string>) {
  const templates: Record<string, string> = {};
  const local = Object.fromEntries(Object.entries(packages).map(([name, file]) => [name, `file:./${file}`]));
  for (const [variant, folder] of Object.entries({ macos: "blank-typescript", windows: "windows", universal: "universal" })) {
    const source = path.join(root, "packages/cli/templates", folder);
    const pkg = readJson(path.join(source, "package.json"));
    // Every desktop SDK carries the pinned cross-platform Runtimes archive.
    if (pkg.dependencies["@react-native-runtimes/core"] && !local["@react-native-runtimes/core"]) continue;
    const temporary = mkdtempSync(path.join(os.tmpdir(), "legend-template-"));
    try {
      cpSync(source, temporary, { recursive: true });
      for (const name of Object.keys(pkg.dependencies)) if (local[name]) pkg.dependencies[name] = local[name];
      pkg.overrides = { ...pkg.overrides, ...local };
      writeJson(path.join(temporary, "package.json"), pkg);
      const archive = path.join(temporary, "template.tgz");
      const child = Bun.spawn(["bun", "pm", "pack", "--filename", archive], { cwd: temporary, stdout: "pipe", stderr: "pipe" });
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      if (code || !existsSync(archive)) throw new Error(`Could not pack ${variant} template: ${stdout}\n${stderr}`);
      const hash = createHash("sha256").update(readFileSync(archive)).digest("hex").slice(0, 12);
      const file = `${pkg.name}-${hash}.tgz`;
      copyFileSync(archive, path.join(output, file)); templates[variant] = file;
    } finally { rmSync(temporary, { recursive: true, force: true }); }
  }
  writeJson(path.join(output, "templates.json"), templates);
}
