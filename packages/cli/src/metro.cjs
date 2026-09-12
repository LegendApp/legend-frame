const fs = require("node:fs");
const path = require("node:path");
const { gate } = require("./metro-gate.cjs");
const ENTRY = "@legend-apps/cli/src/runtime-entry.cjs";

// Production discovery omits the registry: otherwise scanning an unused task
// would itself make that task (and all its native dependencies) reachable.
function runtimePlan(root, env = process.env) {
  if (env.LEGEND_RUNTIME_DISCOVERY === "1") return { enabled: false, roots: [] };
  if (env.LEGEND_RUNTIME_SOURCES) {
    const sources = JSON.parse(fs.readFileSync(env.LEGEND_RUNTIME_SOURCES, "utf8"));
    return { enabled: sources.enabled, roots: sources.roots, production: true };
  }
  return { enabled: true, roots: fs.readdirSync(root, { withFileTypes: true })
    .filter(e => e.isFile() && /\.[jt]sx?$/.test(e.name) && !/^(metro|babel|react-native)\.config\./.test(e.name))
    .map(e => e.name).concat(["src"]) };
}
function withDesktop(config, options = {}) {
  const root = path.resolve(config.projectRoot || process.cwd());
  const core = require.resolve("@react-native-runtimes/core/metro", { paths: [root] });
  const { withThreadedRuntime, generateThreadedRuntimeEntry } = require(core);
  const plan = runtimePlan(root);
  const generatedEntry = path.join(root, ".threaded-runtime/entry.js");
  if (plan.enabled) {
    config = withThreadedRuntime(config, { ...options, roots: plan.roots, watch: plan.production ? false : options.watch });
    // Production roots come from Metro's resolved graph, including worker files
    // shipped by dependencies. Do not register unrelated index.<name>.ts files.
    if (plan.production) generateThreadedRuntimeEntry({ projectRoot: root, generatedEntry, roots: plan.roots, runtimeEntries: [] });
  } else {
    config = { ...config, transformer: { ...config.transformer,
      babelTransformerPath: path.join(path.dirname(core), "metro-transformer.js") } };
  }
  const resolveRequest = config.resolver?.resolveRequest;
  const enhanceMiddleware = config.server?.enhanceMiddleware;
  return { ...config,
    resolver: { ...config.resolver, resolveRequest(context, name, platform) {
      if (name === ENTRY) return { type: "sourceFile", filePath: plan.enabled ? generatedEntry : path.join(__dirname, "runtime-entry.cjs") };
      return resolveRequest ? resolveRequest(context, name, platform) : context.resolveRequest(context, name, platform);
    } },
    server: { ...config.server, enhanceMiddleware(middleware, server) {
      return gate(root, enhanceMiddleware ? enhanceMiddleware(middleware, server) : middleware);
    } },
  };
}
module.exports = { withDesktop, runtimePlan };
