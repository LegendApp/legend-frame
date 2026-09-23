import { buildCLI } from "./build-node.mjs";
buildCLI();
await import("../packages/cli/dist/index.js");
