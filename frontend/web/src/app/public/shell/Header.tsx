import { Link } from "react-router";
import { formatDate } from "@/lib/dates.ts";
import { useLang } from "@/i18n/i18n.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { Icon } from "./Icon.tsx";
import { LangMenu } from "./LangMenu.tsx";

/** Encabezado de las páginas con navegación (portada, confirmación, créditos). */
export function SiteHeader({ current }: { current?: "home" }) {
  const { t } = useLang();
  return (
    <header className="site-header">
      <div className="wrap">
        <Link className="brand" to="/" aria-label="lifex">
          <img src="/logo/lifex-horizontal.svg" alt="lifex" width="123" height="49" />
        </Link>
        <nav className="nav" aria-label="Principal">
          <a href="/#buscar" aria-current={current === "home" ? "page" : undefined}>
            {t("nav.book")}
          </a>
          <a href="/#ofertas">{t("nav.offers")}</a>
          <Link to="/confirmation">{t("nav.trips")}</Link>
          <a href="/#lifexperience">{t("nav.lx")}</a>
        </nav>
        <div className="tools">
          <LangMenu />
          {/* Carga completa a propósito: el dashboard lleva sus propios estilos y no deben mezclarse. */}
          <a className="login" href={`${import.meta.env.VITE_DASHBOARD_URL ?? "/dashboard"}/login`}>
            <Icon name="user" />
            <span>{t("login")}</span>
          </a>
        </div>
      </div>
    </header>
  );
}

/** Encabezado del checkout: logo, resumen del viaje, paso actual y selector de idioma. */
export function CheckoutHeader({ step }: { step: 1 | 2 | 3 | 4 }) {
  const { lang, t } = useLang();
  const search = useWizard((s) => s.search);
  const pax = search.pax;
  return (
    <header className="co-header">
      <div className="wrap">
        <Link className="brand" to="/" aria-label="lifex">
          <img src="/logo/lifex-horizontal.svg" alt="lifex" width="85" height="34" />
        </Link>
        <div className="trip-pill">
          <span className="route">
            {search.from}
            <Icon name="arrow" />
            {search.to}
          </span>
          <span>
            {formatDate(`${search.date}T12:00:00Z`, lang, { day: "numeric", month: "short" })}
          </span>
          <span>
            <Icon name="user" /> {t(pax > 1 ? "paxN" : "pax1", { n: pax })}
          </span>
        </div>
        <ol className="stepper" aria-label={t("step.of", { n: step })}>
          {([1, 2, 3, 4] as const).map((i) => (
            <li
              key={i}
              className={i < step ? "done" : i === step ? "current" : ""}
              aria-current={i === step ? "step" : undefined}
            >
              <span className="step-win" title={t(`step.${i}`)}>
                {i < step ? <Icon name="check" /> : i}
              </span>
              <span className="sr-only">{t(`step.${i}`)}</span>
            </li>
          ))}
        </ol>
        <div className="tools">
          <LangMenu />
        </div>
      </div>
    </header>
  );
}
