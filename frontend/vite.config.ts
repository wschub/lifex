import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@lifex/shared": src("../shared/src/index.ts"),
      "@": src("./src"),
    },
  },
  // `shared/` vive fuera de la raíz del proyecto: el servidor de desarrollo debe poder leerlo.
  server: { port: 5173, fs: { allow: [".."] } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
