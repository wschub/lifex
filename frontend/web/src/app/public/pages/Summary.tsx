import { useNavigate } from "react-router";
import { ErrorNotice } from "@/components/ErrorNotice.tsx";
import { useLang } from "@/i18n/i18n.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatMoney } from "@/lib/money.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { FARE_ITEMS, fareLabel, farePriceUsd } from "../fares.ts";
import { FlightMain } from "../FlightMain.tsx";
import { RequireStep } from "../guards.tsx";
import { useCities } from "../hooks/useCities.ts";
import { usePublicConfig } from "../hooks/usePublicConfig.ts";
import { useSelectedFlight } from "../hooks/useSelectedFlight.ts";
import { Icon } from "../shell/Icon.tsx";
import { Shell } from "../shell/Shell.tsx";
import { SummaryBar } from "../shell/SummaryBar.tsx";
import { Link } from "react-router";

function SummaryContent() {
  const { lang, t } = useLang("summary");
  const navigate = useNavigate();
  const config = usePublicConfig();
  const { cityName } = useCities();
  const { search, fareId } = useWizard();
  const { flight, fare, error, refetch } = useSelectedFlight();
  const money = (usd: number) => formatMoney(usd, lang, config.iataTrm);
  const unit = flight && fare ? farePriceUsd(fare, flight, config.taxPercentage) : 0;

  return (
    <Shell
      kind="co"
      step={1}
      title="lifex — Resumen de viaje"
      bar={
        <SummaryBar
          totalUsd={unit * search.pax}
          ready={!!flight && !!fare}
          onNext={() => navigate("/passengers")}
        />
      }
    >
      <main id="main" className="co-main">
        <div className="wrap">
          <h1 className="co-title">{t("title")}</h1>
          {error ? <ErrorNotice error={error} onRetry={refetch} /> : null}
          {flight && fareId ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 16,
                  margin: "26px 0 14px",
                  flexWrap: "wrap",
                }}
              >
                <h2 id="legTitle" style={{ fontSize: 24 }}>
                  {t("leg", {
                    from: cityName(flight.from.iataCode, lang),
                    to: cityName(flight.to.iataCode, lang),
                  })}{" "}
                  <span
                    style={{
                      font: "400 16px var(--font-text)",
                      color: "var(--gray)",
                      marginLeft: 10,
                    }}
                  >
                    {formatDate(flight.departureDate, lang, {
                      weekday: "long",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </h2>
                <Link className="link" to="/fares">
                  {t("edit.sel")}
                </Link>
              </div>
              <article className="sel-flight" id="sel">
                <span className="tick">
                  <Icon name="check" />
                </span>
                <FlightMain flight={flight} />
                <div className="fare-name">
                  <b className="cab">{fareLabel(fareId, t)}</b>
                  <span className="price num">{money(unit)}</span>
                </div>
              </article>
              <section
                className="panel"
                style={{ marginTop: 24, padding: "26px 30px" }}
                aria-labelledby="incl"
              >
                <h2 id="incl" style={{ fontSize: 22, marginBottom: 16 }}>
                  {t("incl")}
                </h2>
                <ul
                  className="fare"
                  style={{
                    border: 0,
                    padding: 0,
                    cursor: "default",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
                    gap: "12px 32px",
                    listStyle: "none",
                    margin: 0,
                  }}
                >
                  {FARE_ITEMS[fareId].map(([key, included, icon]) => (
                    <li
                      key={key}
                      style={{
                        display: "flex",
                        gap: 11,
                        alignItems: "flex-start",
                        ...(included ? {} : { color: "var(--gray-soft)" }),
                      }}
                    >
                      <Icon name={icon} />
                      <span>{t(key)}</span>
                    </li>
                  ))}
                </ul>
                <p style={{ marginTop: 18, color: "var(--gray)", fontSize: "14.5px" }}>
                  {t("taxes.incl")}
                </p>
              </section>
            </>
          ) : null}
        </div>
      </main>
    </Shell>
  );
}

export function Summary() {
  return (
    <RequireStep step="summary">
      <SummaryContent />
    </RequireStep>
  );
}
