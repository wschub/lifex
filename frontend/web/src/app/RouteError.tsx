import { useEffect } from "react";
import { useRouteError } from "react-router";
import { isChunkLoadError, reloadOnce } from "@/lib/chunk-reload.ts";
import { useLang } from "@/i18n/i18n.ts";

/**
 * Pantalla de error de las rutas. Si el fallo es un archivo de una versión anterior de la web (tras un
 * despliegue), recarga sola una vez; en cualquier otro caso muestra un aviso con los estilos del sitio.
 */
export function RouteError() {
  const error = useRouteError();
  const { t } = useLang();
  const stale = isChunkLoadError(error);
  const reloading = stale && !sessionReloaded();

  useEffect(() => {
    if (stale) reloadOnce();
  }, [stale]);

  if (reloading) return null; // se está recargando

  return (
    <main id="main" className="co-main">
      <div className="wrap">
        <div className="note warn" role="alert">
          <div>
            <b>{t("error.title")}</b>
            <div>{stale ? t("error.update") : t("error.generic")}</div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => (stale ? window.location.reload() : window.location.assign("/"))}
            >
              {stale ? t("error.reload") : t("error.home")}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/** ¿Ya se recargó hace poco? (entonces no hay una recarga en marcha y hay que mostrar el aviso). */
function sessionReloaded(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem("lx-chunk-reload") ?? 0) < 15_000;
  } catch {
    return true;
  }
}
