import { WS_PATH } from "@lifex/shared";

/** Por defecto la API cuelga de /api en el mismo origen (en producción lo atiende el proxy de server.mjs;
 * en desarrollo, el proxy de Vite hacia el backend). */
const DEFAULT_API_URL = "/api";

/** URL base de la API, sin barra final: `VITE_API_URL` (absoluta) o `/api` (mismo origen). */
export function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
}

/**
 * URL del WebSocket derivada de la de la API: con una URL absoluta, http→ws y https→wss; con una ruta
 * relativa (`/api`), el mismo host de la página con ws o wss según su protocolo. Siempre termina en `/ws`.
 */
export function wsUrl(): string {
  const base = apiBaseUrl();
  if (/^https?:\/\//.test(base)) return base.replace(/^http/, "ws") + WS_PATH;
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.host}${base}${WS_PATH}`;
}
