// Servidor estático mínimo para producción: web pública en "/" y dashboard en "/dashboard".
// Cada app es una SPA: una ruta sin archivo devuelve el index.html de su propia app.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(fileURLToPath(import.meta.url)), "dist");
const port = Number(process.env.PORT ?? 3001);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

function fileFor(pathname) {
  const clean = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
  const file = join(dist, clean);
  if (file !== dist && !file.startsWith(dist + sep)) return null; // fuera de dist
  if (existsSync(file) && statSync(file).isFile()) return file;
  const index = join(file, "index.html");
  if (existsSync(index) && statSync(index).isFile()) return index;
  return null;
}

createServer((req, res) => {
  const { pathname } = new URL(req.url ?? "/", "http://localhost");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  if (pathname === "/dashboard") {
    res.writeHead(301, { Location: "/dashboard/" }).end();
    return;
  }
  let file;
  try {
    file = fileFor(pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  // Sin archivo: SPA fallback de la app que corresponde. Los archivos con extensión que no existen son 404.
  if (!file && !extname(pathname)) {
    file = join(dist, pathname.startsWith("/dashboard/") ? "dashboard/index.html" : "index.html");
  }
  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  const hashed = /\/assets\//.test(file);
  res.writeHead(200, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Cache-Control": hashed ? "public, max-age=31536000, immutable" : "no-cache",
  });
  if (req.method === "HEAD") res.end();
  else createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () => console.log(`frontend en http://localhost:${port}`));
