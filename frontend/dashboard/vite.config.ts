import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  // El dashboard se sirve bajo /dashboard (la web pública vive en /): ambos proyectos se publican juntos.
  base: "/dashboard/",
  plugins: [react(), tailwindcss()],
  // Activos compartidos con la web (logos, fuentes) en frontend/public.
  publicDir: "../public",
  resolve: {
    alias: {
      "@lifex/shared": src("../../shared/src/index.ts"),
      "@": src("./src"),
    },
  },
  // `shared/` (dos niveles arriba) vive fuera de la raíz del proyecto: el servidor de desarrollo debe poder leerlo.
  server: { port: 5174, strictPort: true, fs: { allow: ["../.."] } },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
