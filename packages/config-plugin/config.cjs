const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { validateWindow } = require("@legend-apps/window-options");
const { identity } = require("./identity.cjs");
const filename = "desktop.config.json";
function readConfig(root) {
  const file = path.join(root, filename);
  if (!fs.existsSync(file)) return JSON.parse(fs.readFileSync(path.join(root, "app.json"), "utf8"));
  return toExpo(JSON.parse(fs.readFileSync(file, "utf8")));
}
function toExpo(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Desktop config must be an object");
  const allowed = ["$schema", "name", "projectId", "version", "window", "macos", "platforms", "scheme", "documentTypes", "menuBarOnly", "updates", "include", "signing", "helpers", "expo"];
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown desktop configuration field: ${key}`);
  for (const key of ["name", "projectId", "version"]) if (typeof value[key] !== "string" || !value[key].trim()) throw new Error(`Desktop config needs ${key}`);
  const platforms = value.platforms ?? ["macos"];
  if (!Array.isArray(platforms) || platforms.length !== 1 || !["macos", "windows"].includes(platforms[0])) throw new Error("platforms must select macos or windows");
  if (platforms[0] === "macos" && (!value.macos || typeof value.macos.bundleIdentifier !== "string" || !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value.macos.bundleIdentifier))) throw new Error("macos.bundleIdentifier must be a reverse-DNS identifier");
  validateWindow(value.window ?? {});
  if (value.include !== undefined && (!Array.isArray(value.include) || value.include.some(x => typeof x !== "string"))) throw new Error("include must be a list of package names");
  if (value.helpers !== undefined && (!value.helpers || typeof value.helpers !== "object" || Array.isArray(value.helpers) || Object.entries(value.helpers).some(([key, file]) => !/^[A-Za-z0-9_-]+$/.test(key) || typeof file !== "string" || file.startsWith("/")))) throw new Error("helpers must map simple names to project-relative files");
  const extra = { projectId: value.projectId };
  for (const key of ["window", "documentTypes", "menuBarOnly", "updates", "include", "signing", "helpers"]) if (value[key] !== undefined) extra[key] = value[key];
  const backend = value.expo ?? {};
  if (!backend || typeof backend !== "object" || Array.isArray(backend)) throw new Error("expo overrides must be an object");
  const hex = createHash("sha256").update(value.projectId).digest("hex");
  const guid = `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
  const config = {
    ...backend,
    name: value.name, slug: value.name.toLowerCase().replace(/[^a-z0-9-]/g, "-"), version: value.version,
    platforms, newArchEnabled: true,
    ...(value.macos ? { macos: { ...value.macos, infoPlist: { CFBundleName: value.name, ...value.macos.infoPlist } } } : {}),
    ...(value.scheme !== undefined ? { scheme: value.scheme } : {}),
    extra: { ...backend.extra, legend: extra },
    experiments: { ...backend.experiments, outOfTreePlatforms: true },
    windows: backend.windows ?? { namespace: "DesktopApp", displayName: value.name, packageGuid: guid, projectGuid: guid },
    plugins: ["@legend-apps/desktop-config", ...(backend.plugins ?? []).filter(p => (Array.isArray(p) ? p[0] : p) !== "@legend-apps/desktop-config")],
  };
  identity(config);
  return { expo: config };
}
// Expo tools read this generated transport file. All framework consumers resolve
// the canonical source; the generated file is never edited by SDK commands.
function prepareConfig(root) {
  if (fs.existsSync(path.join(root, filename)) && ["app.config.js", "app.config.ts"].some(name => fs.existsSync(path.join(root, name)))) throw new Error("desktop.config.json cannot be combined with an Expo app.config file; put backend overrides under expo in desktop.config.json");
  const result = readConfig(root);
  if (fs.existsSync(path.join(root, filename))) {
    const file = path.join(root, "app.json");
    const content = JSON.stringify(result, null, 2) + "\n";
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf8") !== content) {
      const temporary = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, content); fs.renameSync(temporary, file);
    }
  }
  return result;
}
function writeUpdates(root, updates) {
  const file = path.join(root, filename);
  if (fs.existsSync(file)) {
    const value = JSON.parse(fs.readFileSync(file, "utf8")); value.updates = updates; toExpo(value);
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n"); fs.renameSync(temporary, file);
  } else {
    const value = readConfig(root); value.expo.extra ??= {}; value.expo.extra.legend ??= {}; value.expo.extra.legend.updates = updates;
    const target = path.join(root, "app.json"); const temporary = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + "\n"); fs.renameSync(temporary, target);
  }
}
module.exports = { readConfig, toExpo, prepareConfig, writeUpdates };
