/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  /** URL de la web pública (por defecto `/`, mismo dominio). En desarrollo: http://localhost:5173 */
  readonly VITE_WEB_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
