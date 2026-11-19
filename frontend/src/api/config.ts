import { WS_PATH } from "@lifex/shared";

const DEFAULT_API_URL = "http://localhost:3000";

/** URL base de la API, sin barra final (`VITE_API_URL`). */
export function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, "");
}

/** URL del WebSocket derivada de la de la API: http→ws, https→wss, más `/ws`. */
export function wsUrl(): string {
  return apiBaseUrl().replace(/^http/, "ws") + WS_PATH;
}
