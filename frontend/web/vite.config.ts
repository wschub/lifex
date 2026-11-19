import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Los activos (fuentes, imágenes, logos, PNG de correo) se comparten con el panel en frontend/public.
  publicDir: "../public",
  resolve: {
    alias: {
      "@lifex/shared": src("../../shared/src/index.ts"),
      "@": src("./src"),
    },
  },
  // `shared/` (dos niveles arriba) vive fuera de la raíz del proyecto: el servidor de desarrollo debe poder leerlo.
  server: {
    port: 5173,
    fs: { allow: ["../.."] },
    // La API es /api en el mismo origen (igual que en producción): el proxy quita el prefijo.
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
