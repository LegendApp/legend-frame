import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Archive tests rebuild the shared CLI output used by subprocess tests.
    fileParallelism: false,
  },
});
