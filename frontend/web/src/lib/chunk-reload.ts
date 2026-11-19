/**
 * Tras un despliegue, los archivos de la versión anterior (con nombres con hash) ya no existen en el servidor. Una
 * pestaña que seguía abierta pide uno de ellos y el navegador responde «Failed to fetch dynamically imported
 * module». La solución es recargar para bajar el `index.html` nuevo; esto lo hace una sola vez para no entrar en un
 * bucle si el fallo fuera otro (por ejemplo, sin conexión).
 */

const STORAGE_KEY = "lx-chunk-reload";
/** Si ya se recargó hace menos de esto, no se vuelve a recargar. */
const RELOAD_WINDOW_MS = 15_000;

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
];

/** ¿El error viene de no poder cargar un archivo de la aplicación (versión vieja o red)? */
export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "";
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Recarga la página una vez. Devuelve `false` (y no recarga) si ya se recargó hace poco: ahí el problema no es
 * una versión vieja y conviene mostrar el error en vez de repetir.
 */
export function reloadOnce(
  reload: () => void = () => window.location.reload(),
  now: () => number = Date.now,
): boolean {
  try {
    const last = Number(sessionStorage.getItem(STORAGE_KEY) ?? 0);
    if (now() - last < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(STORAGE_KEY, String(now()));
  } catch {
    // sin sessionStorage no se puede evitar el bucle: mejor no recargar
    return false;
  }
  reload();
  return true;
}
