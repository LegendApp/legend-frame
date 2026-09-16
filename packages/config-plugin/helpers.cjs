// Shared by Expo configuration and the CLI; filesystem checks happen at build time.
const targets = ["macos-arm64", "macos-x64", "windows-arm64", "windows-x64"];
function relative(value) {
  return typeof value === "string" && value.length > 0 && !/[\\\0:]/.test(value) && !value.startsWith("/") && value.split("/").every(part => part && part !== "." && part !== "..");
}
function validateHelpers(helpers = {}) {
  if (!helpers || typeof helpers !== "object" || Array.isArray(helpers)) throw new Error("helpers must be an object");
  const names = Object.keys(helpers).map(name => name.toLowerCase());
  if (new Set(names).size !== names.length) throw new Error("Helper names must be unique ignoring case");
  for (const [name, value] of Object.entries(helpers)) {
    if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error("Helpers need simple names");
    if (typeof value === "string") { if (!relative(value)) throw new Error(`Helper ${name} needs a project-relative file`); continue; }
    if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length) throw new Error(`Helper ${name} needs target bundles`);
    for (const [target, bundle] of Object.entries(value)) {
      if (!targets.includes(target) || !bundle || typeof bundle !== "object" || Array.isArray(bundle) || Object.keys(bundle).some(key => !["directory", "executable"].includes(key)) || !relative(bundle.directory) || !relative(bundle.executable)) throw new Error(`Invalid helper bundle: ${name}/${target}; expected directory and executable relative paths`);
    }
  }
  return helpers;
}
module.exports = { validateHelpers };
