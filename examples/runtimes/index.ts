require("@legendapp/spark/runtime-entry");
if (!(globalThis as any).__THREADED_RUNTIME_ENV__) {
  const { registerRootComponent } = require("expo");
  registerRootComponent(require("./App").default);
}
