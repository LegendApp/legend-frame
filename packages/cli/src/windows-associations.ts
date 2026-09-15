import { createHash } from "node:crypto";
import path from "node:path";
import { existsSync, rmSync } from "node:fs";
import { run } from "./commands";
import { readAppConfig, readJson, stateFile, writeJson } from "./project";
const knownTypes: Record<string, string[]> = { "public.plain-text": ["txt"], "public.text": ["txt"], "public.json": ["json"], "public.html": ["html", "htm"], "net.daringfireball.markdown": ["md", "markdown"], "public.png": ["png"], "public.jpeg": ["jpg", "jpeg"], "com.adobe.pdf": ["pdf"] };
export function associationPlan(expo: any, executable: string) {
  const project = expo.extra?.legend?.projectId;
  if (typeof project !== "string" || !project) throw new Error("Windows associations require project identity");
  const appId = `Legend.${createHash("sha256").update(project).digest("hex")}`;
  const protocols: string[] = [...new Set<string>(expo.scheme === undefined ? [] : Array.isArray(expo.scheme) ? expo.scheme : [expo.scheme])];
  for (const scheme of protocols) if (!/^[a-z][a-z0-9+.-]*$/i.test(scheme)) throw new Error("Invalid association scheme");
  const extensions: string[] = [];
  for (const type of expo.extra?.legend?.documentTypes ?? []) {
    const names = type.extensions ?? type.contentTypes?.flatMap((uti: string) => knownTypes[uti] ?? []);
    if (!names?.length) throw new Error(`Add extensions to document type ${type.name} for Windows; its UTIs have no known extension mapping`);
    for (const name of names) {
      if (typeof name !== "string" || !/^[a-z0-9][a-z0-9_-]{0,30}$/i.test(name)) throw new Error("Document extensions must be simple names without a dot");
      extensions.push(name.toLowerCase());
    }
  }
  if (!path.win32.isAbsolute(executable) || /["\r\n\0]/.test(executable)) throw new Error("Association executable must be an absolute Windows path");
  return { appId, name: expo.name, executable, protocols, extensions: [...new Set(extensions)] };
}
export async function registerWindowsAssociations(root: string, app: string) {
  const expo = readAppConfig(root).expo;
  const plan = associationPlan(expo, path.join(app, "MyApp.exe"));
  const file = stateFile(root, "windows-associations.json"), pending = `${file}.pending`;
  const previous = existsSync(file) ? readJson(file) : undefined;
  // Keep the last successful plan until registration and stale-entry cleanup succeed.
  writeJson(pending, { ...plan, previous });
  try {
    await run(root, ["pwsh.exe", "-NoProfile", "-File", path.join(import.meta.dir, "windows-associations.ps1"), "-PlanFile", pending], { capture: true });
    writeJson(file, plan);
  } finally { rmSync(pending, { force: true }); }
}
