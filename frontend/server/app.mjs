// Servidor de producción del frontend (sin dependencias):
//  - web pública en "/" y dashboard en "/dashboard", cada una con su fallback SPA
//  - /healthz propio (no depende del backend)
//  - proxy de /api/* → backend /* y de /api/ws → backend /ws (con upgrade), en el mismo origen
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { extname, join, normalize, sep } from "node:path";

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

const API_PREFIX = "/api";
const HOP_BY_HOP = [
  "connection",
  "keep-alive",
  "proxy-connection",
  "transfer-encoding",
  "te",
  "trailer",
];

/** `/api/x?y=1` → `/x?y=1` y `/api` → `/`. Devuelve null si la ruta no es de la API. */
export function stripApiPrefix(url) {
  const match = /^\/api(\/[^?]*)?(\?.*)?$/.exec(url);
  if (!match) return null;
  return (match[1] ?? "/") + (match[2] ?? "");
}

/** `Path=/auth` → `Path=/api/auth` (el navegador ve la API bajo el prefijo /api). */
export function prefixCookiePath(cookie) {
  return cookie.replace(/(;\s*Path=)(\/[^;]*)/i, `$1${API_PREFIX}$2`);
}

function forwardedHeaders(req, target, { keepUpgrade = false } = {}) {
  const headers = { ...req.headers };
  if (!keepUpgrade) for (const name of HOP_BY_HOP) delete headers[name];
  headers.host = target.host;
  // Se conservan Origin y Cookie (validación CSRF y sesión). La IP del cliente es la que ya trae el proxy
  // de Railway; si no hay, la del socket. El backend lee el último salto con TRUST_PROXY=1.
  headers["x-forwarded-for"] = req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "";
  headers["x-forwarded-proto"] = req.headers["x-forwarded-proto"] ?? "http";
  headers["x-forwarded-host"] = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  return headers;
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

export function createFrontendServer({ dist, backendUrl }) {
  const target = backendUrl ? new URL(backendUrl) : null;
  const send = target?.protocol === "https:" ? httpsRequest : httpRequest;

  function fileFor(pathname) {
    const clean = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, "");
    const file = join(dist, clean);
    if (file !== dist && !file.startsWith(dist + sep)) return null; // fuera de dist
    if (existsSync(file) && statSync(file).isFile()) return file;
    const index = join(file, "index.html");
    if (existsSync(index) && statSync(index).isFile()) return index;
    return null;
  }

  function serveStatic(req, res, pathname) {
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
    // Sin archivo: fallback SPA de la app que corresponde. Una ruta con extensión que no existe es 404.
    if (!file && !extname(pathname)) {
      file = join(dist, pathname.startsWith("/dashboard/") ? "dashboard/index.html" : "index.html");
    }
    if (!file) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    const extension = extname(file);
    const cache = /[\\/]assets[\\/]/.test(file)
      ? "public, max-age=31536000, immutable" // nombres con hash
      : extension === ".html"
        ? "no-cache"
        : "public, max-age=86400";
    res.writeHead(200, {
      "Content-Type": TYPES[extension] ?? "application/octet-stream",
      "Cache-Control": cache,
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") res.end();
    else createReadStream(file).pipe(res);
  }

  function proxyHttp(req, res, path) {
    if (!target) {
      sendJson(res, 503, {
        code: "BACKEND_NOT_CONFIGURED",
        detail: "BACKEND_INTERNAL_URL is not set",
      });
      return;
    }
    const upstream = send(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        method: req.method,
        path,
        headers: forwardedHeaders(req, target),
        timeout: 30_000,
      },
      (response) => {
        const headers = { ...response.headers };
        // La API se ve bajo /api: la cookie de refresh (Path=/auth) debe enviarse a /api/auth/*.
        if (headers["set-cookie"])
          headers["set-cookie"] = headers["set-cookie"].map(prefixCookiePath);
        res.writeHead(response.statusCode ?? 502, headers);
        response.pipe(res);
      },
    );
    upstream.on("timeout", () => upstream.destroy(new Error("upstream timeout")));
    upstream.on("error", () => {
      if (!res.headersSent)
        sendJson(res, 502, { code: "BAD_GATEWAY", detail: "The API is unreachable" });
      else res.destroy();
    });
    req.pipe(upstream);
  }

  function proxyUpgrade(req, socket, head, path) {
    if (!target) return socket.destroy();
    const upstream = send({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || undefined,
      method: req.method,
      path,
      headers: forwardedHeaders(req, target, { keepUpgrade: true }),
    });
    upstream.on("upgrade", (response, upstreamSocket, upstreamHead) => {
      let lines = `HTTP/1.1 101 Switching Protocols\r\n`;
      for (let i = 0; i < response.rawHeaders.length; i += 2) {
        lines += `${response.rawHeaders[i]}: ${response.rawHeaders[i + 1]}\r\n`;
      }
      socket.write(lines + "\r\n");
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) upstreamSocket.write(head);
      upstreamSocket.pipe(socket);
      socket.pipe(upstreamSocket);
      upstreamSocket.on("error", () => socket.destroy());
      socket.on("error", () => upstreamSocket.destroy());
      socket.on("close", () => upstreamSocket.destroy());
      upstreamSocket.on("close", () => socket.destroy());
    });
    // El backend no aceptó el upgrade (p. ej. 401): se le devuelve su respuesta al cliente.
    upstream.on("response", (response) => {
      socket.write(
        `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\nConnection: close\r\n\r\n`,
      );
      socket.end();
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
    upstream.end();
  }

  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    const pathname = url.split("?")[0];
    if (pathname === "/healthz") {
      sendJson(res, 200, { status: "ok" });
      return;
    }
    const apiPath = stripApiPrefix(url);
    if (apiPath !== null) {
      proxyHttp(req, res, apiPath);
      return;
    }
    serveStatic(req, res, pathname);
  });

  server.on("upgrade", (req, socket, head) => {
    const apiPath = stripApiPrefix(req.url ?? "");
    if (apiPath === null || !/^\/ws(\?|$)/.test(apiPath)) return socket.destroy();
    proxyUpgrade(req, socket, head, apiPath);
  });

  return server;
}
