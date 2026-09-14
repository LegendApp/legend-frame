require("@legend-apps/cli/src/runtime-entry.cjs");
if (!(globalThis as any).__THREADED_RUNTIME_ENV__) {
  require("./global.css");
  require("uniwind").Uniwind.setTheme("system");
  const { registerRootComponent } = require("expo");
  registerRootComponent(require("./App").default);
}
