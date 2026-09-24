#!/usr/bin/env node
// Keep the npm entry point executable under Node; the CLI currently requires Bun.
const { spawnSync } = require("node:child_process");
const result = spawnSync("bun", [require.resolve("@legendapp/spark-cli/src/index.ts"), ...process.argv.slice(2)], { stdio: "inherit" });
if (result.error) {
  console.error(`Legend Spark requires Bun 1.3.14+ on PATH. ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
