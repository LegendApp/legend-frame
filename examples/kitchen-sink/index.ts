require("@legendapp/spark/runtime-entry");
if (!(globalThis as any).__THREADED_RUNTIME_ENV__) {
  require("./global.css");
  require("uniwind").Uniwind.setTheme("system");
  const { registerRootComponent } = require("expo");
  registerRootComponent(require("./App").default);
}
