import { vi } from "vitest";

type Handler = unknown | ((url: URL, init?: RequestInit) => unknown);
export type ApiRoutes = Record<string, Handler>;

/** Respuesta con un problem details como los que devuelve el backend. */
export const problem = (status: number, code: string, detail = code) => ({
  __status: status,
  body: { type: "about:blank", title: code, status, code, detail },
});

/**
 * Sustituye `fetch` por un servidor falso. Las claves son `"GET /flights"` (método + ruta); el valor es el
 * cuerpo JSON o una función que lo calcula. `problem(...)` devuelve un error HTTP. Devuelve el espía.
 */
export function mockApi(routes: ApiRoutes) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    // La API vive bajo /api en el mismo origen; las rutas de las pruebas son las del backend (sin prefijo).
    const path = url.pathname.replace(/^\/api(?=\/|$)/, "");
    const method = (init?.method ?? "GET").toUpperCase();
    const handler = routes[`${method} ${path}`];
    if (handler === undefined) {
      return new Response(JSON.stringify({ code: "NOT_MOCKED", detail: `${method} ${path}` }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    const value = typeof handler === "function" ? await handler(url, init) : handler;
    const status =
      typeof value === "object" && value !== null && "__status" in value
        ? (value as { __status: number }).__status
        : 200;
    const body =
      typeof value === "object" && value !== null && "__status" in value
        ? (value as { body: unknown }).body
        : value;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", spy);
  return spy;
}
