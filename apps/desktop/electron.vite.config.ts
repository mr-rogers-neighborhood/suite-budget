import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";

const core = fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url));
const renderer = fileURLToPath(new URL("./src/renderer/src", import.meta.url));

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@suite/budget-core", "@suite/desktop"] })],
    resolve: { alias: { "@suite/budget-core": core } },
    build: {
      // The wasm-bindgen glue requires a snippet file next to the module; leave it to Node.
      rollupOptions: { external: ["loro-crdt"] },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "@suite/budget-core": core, "@renderer": renderer } },
    optimizeDeps: {
      // Loro ships a wasm-bindgen entry; pre-bundling it breaks the wasm URL in dev.
      exclude: ["loro-crdt"],
    },
  },
});
