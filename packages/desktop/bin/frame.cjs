#!/usr/bin/env node
import(require("node:url").pathToFileURL(require.resolve("@legendapp/frame-cli/dist/index.js")).href).catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
