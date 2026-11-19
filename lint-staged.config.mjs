// pre-commit: lint + formato solo de los archivos en staging, dentro de cada subproyecto afectado.
import path from "node:path";

const root = import.meta.dirname;
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

/** Ejecuta los comandos desde la carpeta del subproyecto (ahí viven su eslint y prettier). */
const inProject = (dir, commands) => (files) => {
  const relative = files.map((file) => path.relative(path.join(root, dir), file));
  return commands.map((command) =>
    `sh -c ${quote(`cd ${dir} && ${command} ${relative.map(quote).join(" ")}`)}`,
  );
};

const code = ["npx eslint --fix --no-warn-ignored", "npx prettier --write --ignore-unknown"];
const other = ["npx prettier --write --ignore-unknown"];

export default {
  "backend/**/*.{ts,js,mjs,cjs}": inProject("backend", code),
  "backend/**/*.{css,md,yml}": inProject("backend", other),
  "frontend/web/**/*.{ts,tsx,js,mjs}": inProject("frontend/web", code),
  "frontend/web/**/*.{css,md}": inProject("frontend/web", other),
  "frontend/dashboard/**/*.{ts,tsx,js,mjs}": inProject("frontend/dashboard", code),
  "frontend/dashboard/**/*.{css,md}": inProject("frontend/dashboard", other),
  "shared/**/*.ts": inProject("shared", other),
};
