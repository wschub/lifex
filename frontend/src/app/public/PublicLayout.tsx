import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Outlet, useLocation } from "react-router";
import { configQuery } from "@/api/queries.ts";
import { ErrorNotice } from "@/components/ErrorNotice.tsx";
import { useLang } from "@/i18n/i18n.ts";
import "./styles/lifex.css";

/** Salta a la sección (`/#ofertas`) tras navegar, como hacían las anclas del prototipo. */
function useScrollToHash() {
  const { hash, pathname } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [hash, pathname]);
}

/**
 * Raíz de la web pública: carga los estilos del prototipo, fija el idioma del documento y no pinta
 * ninguna página hasta tener la configuración (TRM e impuestos) para que ningún precio salga con valores de respaldo.
 */
export function PublicLayout() {
  const { lang, t } = useLang();
  const config = useQuery(configQuery());
  useScrollToHash();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <>
      <a className="sr-only" href="#main">
        {t("skip")}
      </a>
      {config.isError ? (
        <main id="main" className="co-main">
          <div className="wrap">
            <ErrorNotice error={config.error} onRetry={() => void config.refetch()} />
          </div>
        </main>
      ) : config.data ? (
        <Outlet />
      ) : null}
    </>
  );
}
