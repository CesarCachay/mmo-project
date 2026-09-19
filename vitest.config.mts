import { fileURLToPath, URL } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "#app": fileURLToPath(new URL("./apps/server/src", import.meta.url)),
    },
  },

  test: {
    exclude: [
      ...configDefaults.exclude,
      "**/dist/**",
      // Nest's generated *.spec.ts files are owned by the server Jest suite.
      "**/*.spec.ts",
    ],
  },
});
