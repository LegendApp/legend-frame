import { copyFileSync, existsSync, lstatSync, mkdirSync, realpathSync, chmodSync } from "node:fs";
import path from "node:path";
export function resolveHelpers(root: string, helpers: Record<string, string> = {}) {
  const base = realpathSync(root);
  return Object.entries(helpers).map(([name, relative]) => {
    if (!/^[A-Za-z0-9_-]+$/.test(name) || typeof relative !== "string" || path.isAbsolute(relative)) throw new Error("Helpers need simple names and project-relative file paths");
    const file = path.resolve(base, relative);
    if (!file.startsWith(base + path.sep) || !existsSync(file) || !lstatSync(file).isFile() || !realpathSync(file).startsWith(base + path.sep)) throw new Error(`Helper must be a regular file inside the project: ${name}`);
    return { name, file, relative: path.relative(base, file) };
  });
}
export function copyHelpers(root: string, app: string, helpers: Record<string, string> = {}, platform: "macos" | "windows" = "macos") {
  const files = resolveHelpers(root, helpers);
  if (!files.length) return;
  const destination = path.join(app, platform === "windows" ? "Helpers" : "Contents/Helpers"); mkdirSync(destination, { recursive: true });
  for (const helper of files) { const file = path.join(destination, helper.name + (platform === "windows" ? ".exe" : "")); copyFileSync(helper.file, file); chmodSync(file, 0o755); }
}
