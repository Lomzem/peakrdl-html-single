import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  root: "shell",
  plugins: [tailwindcss(), svelte({ configFile: false }), viteSingleFile()],
  resolve: {
    alias: {
      $lib: path.resolve(import.meta.dirname, "src/lib"),
    },
  },
  build: {
    outDir: "../build-shell",
    emptyOutDir: true,
  },
});
