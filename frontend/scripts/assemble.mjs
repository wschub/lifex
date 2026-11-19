// Junta los dos builds en frontend/dist: la web pública en "/" y el dashboard en "/dashboard".
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

for (const project of ["web", "dashboard"]) {
  if (!existsSync(join(root, project, "dist"))) {
    throw new Error(`Falta ${project}/dist: ejecuta "npm run build" en frontend/.`);
  }
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, "web", "dist"), dist, { recursive: true });
cpSync(join(root, "dashboard", "dist"), join(dist, "dashboard"), { recursive: true });

// El dashboard carga fuentes, fotos y PNG de correo desde la raíz: no hace falta duplicarlos bajo /dashboard
// (solo se conserva `logo`, que el panel pide con su propia ruta base).
for (const folder of ["img", "fonts", "mail"]) {
  rmSync(join(dist, "dashboard", folder), { recursive: true, force: true });
}

console.log("frontend/dist listo: / → web, /dashboard → dashboard");
