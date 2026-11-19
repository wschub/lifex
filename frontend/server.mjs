// Punto de entrada de producción: web en "/", dashboard en "/dashboard" y proxy de /api hacia el backend.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createFrontendServer } from "./server/app.mjs";

const dist = join(dirname(fileURLToPath(import.meta.url)), "dist");
const port = Number(process.env.PORT ?? 3001);
const backendUrl = process.env.BACKEND_INTERNAL_URL;

if (!backendUrl) {
  console.warn("BACKEND_INTERNAL_URL no está definida: /api responderá 503.");
}

createFrontendServer({ dist, backendUrl }).listen(port, "0.0.0.0", () => {
  console.log(`frontend en http://localhost:${port} (API → ${backendUrl ?? "sin configurar"})`);
});
