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
  server: {
    port: 5173,
    fs: { allow: [".."] },
    // Opcional en desarrollo: con VITE_API_URL=http://localhost:5173/api el navegador habla con el mismo
    // origen y no depende del CORS del backend (que hoy no admite la cabecera Idempotency-Key).
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
