import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { createFrontendServer, prefixCookiePath, stripApiPrefix } from "./app.mjs";

let dist;
let backend;
let front;
let backendPort;
let frontPort;
const seen = [];

const listen = (server) =>
  new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));

function call(path, { method = "GET", headers = {}, body, port = frontPort } = {}) {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method, headers, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () =>
        resolve({
          status: res.statusCode,
          headers: res.headers,
          text: Buffer.concat(chunks).toString(),
        }),
      );
    });
    req.on("error", reject);
    req.end(body);
  });
}

before(async () => {
  dist = mkdtempSync(join(tmpdir(), "lifex-dist-"));
  for (const [file, content] of Object.entries({
    "index.html": "<title>web</title>",
    "dashboard/index.html": "<title>dashboard</title>",
    "assets/app-abc123.js": "console.log('web')",
    "dashboard/assets/panel-def456.js": "console.log('panel')",
    "logo/lifex.svg": "<svg/>",
  })) {
    mkdirSync(join(dist, file, ".."), { recursive: true });
    writeFileSync(join(dist, file), content);
  }
  backend = createServer((req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      seen.push({
        url: req.url,
        method: req.method,
        headers: req.headers,
        body: Buffer.concat(chunks).toString(),
      });
      res.writeHead(req.url.startsWith("/teapot") ? 418 : 200, {
        "Content-Type": "application/json",
        "Set-Cookie": "refresh=abc; HttpOnly; Path=/auth",
      });
      res.end(JSON.stringify({ path: req.url }));
    });
  });
  backend.on("upgrade", (req, socket) => {
    seen.push({ url: req.url, upgrade: true, headers: req.headers });
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n",
    );
    socket.on("data", (data) => socket.write(data.toString().toUpperCase()));
  });
  backendPort = await listen(backend);
  front = createFrontendServer({ dist, backendUrl: `http://127.0.0.1:${backendPort}` });
  frontPort = await listen(front);
});

after(() => {
  front.closeAllConnections();
  backend.closeAllConnections();
  front.close();
  backend.close();
  rmSync(dist, { recursive: true, force: true });
});

describe("estáticos y fallback SPA", () => {
  it("/ y las rutas de la web devuelven el index de la web", async () => {
    for (const path of ["/", "/results", "/passengers"]) {
      const res = await call(path);
      assert.equal(res.status, 200);
      assert.match(res.text, /<title>web<\/title>/);
      assert.equal(res.headers["cache-control"], "no-cache");
    }
  });

  it("/dashboard redirige a /dashboard/ y sus rutas (también al refrescar) devuelven el index del dashboard", async () => {
    const redirect = await call("/dashboard");
    assert.equal(redirect.status, 301);
    assert.equal(redirect.headers.location, "/dashboard/");
    for (const path of ["/dashboard/", "/dashboard/login", "/dashboard/vuelos/abc"]) {
      const res = await call(path);
      assert.equal(res.status, 200, path);
      assert.match(res.text, /<title>dashboard<\/title>/, path);
    }
  });

  it("los assets con hash se cachean un año y un archivo inexistente es 404", async () => {
    const asset = await call("/assets/app-abc123.js");
    assert.equal(asset.status, 200);
    assert.match(asset.headers["cache-control"], /immutable/);
    assert.equal((await call("/dashboard/assets/panel-def456.js")).status, 200);
    assert.equal((await call("/assets/nope.js")).status, 404);
    // Salir de dist no es posible: una ruta sin extensión cae al fallback SPA y con extensión es 404.
    const traversal = await call("/%2e%2e/%2e%2e/etc/passwd");
    assert.match(traversal.text, /<title>web<\/title>/);
    assert.equal((await call("/%2e%2e/%2e%2e/etc/passwd.txt")).status, 404);
  });

  it("/healthz responde sin tocar el backend", async () => {
    const res = await call("/healthz");
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.text), { status: "ok" });
  });
});

describe("proxy de /api", () => {
  it("quita el prefijo /api, conserva query, cookies, Origin y estado, y añade X-Forwarded-*", async () => {
    seen.length = 0;
    const res = await call("/api/flights?from=BOG&to=MDE", {
      headers: {
        Origin: "https://lifex.example.com",
        Cookie: "a=b",
        "X-Forwarded-For": "203.0.113.7",
        "X-Forwarded-Proto": "https",
      },
    });
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.text), { path: "/flights?from=BOG&to=MDE" });
    assert.match(String(res.headers["set-cookie"]), /refresh=abc; HttpOnly; Path=\/api\/auth/);
    const forwarded = seen.at(-1);
    assert.equal(forwarded.headers.origin, "https://lifex.example.com");
    assert.equal(forwarded.headers.cookie, "a=b");
    assert.equal(forwarded.headers["x-forwarded-for"], "203.0.113.7");
    assert.equal(forwarded.headers["x-forwarded-proto"], "https");
    assert.equal(forwarded.headers["x-forwarded-host"], `127.0.0.1:${frontPort}`);
  });

  it("reenvía el cuerpo y el método, y devuelve los errores del backend tal cual", async () => {
    seen.length = 0;
    const res = await call("/api/teapot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.c" }),
    });
    assert.equal(res.status, 418);
    assert.equal(seen.at(-1).method, "POST");
    assert.equal(seen.at(-1).body, '{"email":"a@b.c"}');
  });

  it("si el backend no responde devuelve 502 y sin BACKEND_INTERNAL_URL devuelve 503", async () => {
    const down = createFrontendServer({ dist, backendUrl: "http://127.0.0.1:1" });
    const downPort = await listen(down);
    assert.equal((await call("/api/x", { port: downPort })).status, 502);
    down.close();
    const none = createFrontendServer({ dist });
    const nonePort = await listen(none);
    assert.equal((await call("/api/x", { port: nonePort })).status, 503);
    none.close();
  });

  it("prefixCookiePath mueve la cookie bajo /api sin tocar el resto de atributos", () => {
    assert.equal(
      prefixCookiePath(
        "refresh_token=x; Path=/auth; Expires=Thu, 26 Nov 2026 12:13:14 GMT; HttpOnly; Secure; SameSite=Lax",
      ),
      "refresh_token=x; Path=/api/auth; Expires=Thu, 26 Nov 2026 12:13:14 GMT; HttpOnly; Secure; SameSite=Lax",
    );
    assert.equal(prefixCookiePath("a=b; HttpOnly"), "a=b; HttpOnly");
  });

  it("stripApiPrefix solo toca rutas bajo /api", () => {
    assert.equal(stripApiPrefix("/api"), "/");
    assert.equal(stripApiPrefix("/api/ws?token=1"), "/ws?token=1");
    assert.equal(stripApiPrefix("/apix/y"), null);
    assert.equal(stripApiPrefix("/results"), null);
  });
});

describe("WebSocket en /api/ws", () => {
  it("hace el upgrade hacia /ws del backend con la query y reenvía los datos en los dos sentidos", async () => {
    seen.length = 0;
    const received = await new Promise((resolve, reject) => {
      const req = request({
        host: "127.0.0.1",
        port: frontPort,
        agent: false,
        path: "/api/ws?token=abc",
        headers: {
          Connection: "Upgrade",
          Upgrade: "websocket",
          Origin: "https://lifex.example.com",
        },
      });
      req.on("upgrade", (res, socket) => {
        assert.equal(res.statusCode, 101);
        socket.on("data", (data) => {
          socket.destroy();
          resolve(data.toString());
        });
        socket.write("hola");
      });
      req.on("error", reject);
      req.end();
    });
    assert.equal(received, "HOLA");
    assert.equal(seen.at(-1).url, "/ws?token=abc");
    assert.equal(seen.at(-1).headers.origin, "https://lifex.example.com");
  });

  it("un upgrade que no es /api/ws se corta", async () => {
    const closed = await new Promise((resolve) => {
      const req = request({
        host: "127.0.0.1",
        port: frontPort,
        path: "/otra",
        headers: { Connection: "Upgrade", Upgrade: "websocket" },
      });
      req.on("upgrade", () => resolve(false));
      req.on("error", () => resolve(true));
      req.end();
    });
    assert.equal(closed, true);
  });
});
