import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";
export function which(command: string, env: Record<string, string | undefined> = process.env): string | undefined {
  const extensions = process.platform === "win32" ? ["", ...(env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")] : [""];
  const directories = command.includes(path.sep) || path.isAbsolute(command) ? [""] : (env.PATH ?? "").split(path.delimiter);
  for (const directory of directories) {
    for (const extension of extensions) {
      const file = path.resolve(directory, command + extension);
      try { if (statSync(file).isFile()) { accessSync(file, constants.X_OK); return file; } } catch {}
    }
  }
  return undefined;
}
