import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    passWithNoTests: true,
    coverage: { provider: "v8", reporter: ["text", "html"] },
    testTimeout: 15_000,
  },
  resolve: {
    alias: { "@": new URL("./src", import.meta.url).pathname },
  },
});
