/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** URL del panel (por defecto `/dashboard`, en el mismo dominio). En desarrollo: http://localhost:5174/dashboard */
  readonly VITE_DASHBOARD_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
