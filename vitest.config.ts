import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const core = fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url));
const renderer = fileURLToPath(new URL("./apps/desktop/src/renderer/src", import.meta.url));

export default defineConfig({
  test: {
    testTimeout: 20_000,
    projects: [
      {
        resolve: { alias: { "@suite/budget-core": core } },
        test: {
          name: "core",
          environment: "node",
          include: ["packages/core/src/**/*.test.ts"],
        },
      },
      {
        resolve: { alias: { "@suite/budget-core": core } },
        test: {
          name: "main",
          environment: "node",
          include: ["apps/desktop/src/main/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: { "@suite/budget-core": core, "@renderer": renderer } },
        test: {
          name: "renderer",
          environment: "jsdom",
          include: ["apps/desktop/src/renderer/src/**/*.test.{ts,tsx}"],
          setupFiles: ["apps/desktop/src/renderer/src/test/setup.ts"],
        },
      },
    ],
  },
});
