import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.config.*",
        "**/types.ts",
      ],
    },
    include: [
      "packages/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
    ],
    resolve: {
      alias: {
        "@canopy-sight/config": path.resolve(__dirname, "./packages/config/src"),
        "@canopy-sight/database": path.resolve(__dirname, "./packages/database/src"),
        "@canopy-sight/validators": path.resolve(__dirname, "./packages/validators/src"),
        "@canopy-sight/auth": path.resolve(__dirname, "./packages/auth/src"),
        "@canopy-sight/utils": path.resolve(__dirname, "./packages/utils/src"),
      },
    },
  },
});
