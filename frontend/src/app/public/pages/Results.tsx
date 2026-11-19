import { useQueries, useQuery } from "@tanstack/react-query";
import type { PublicFlight } from "@lifex/shared";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { flightsQuery, luggageTypesQuery } from "@/api/queries.ts";
import { ErrorNotice } from "@/components/ErrorNotice.tsx";
import { useLang } from "@/i18n/i18n.ts";
import { formatDate } from "@/lib/dates.ts";
import { formatMoney } from "@/lib/money.ts";
import { addDays, todayBogota } from "@/lib/search-date.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { fareOptions, farePriceUsd, lowestPriceUsd } from "../fares.ts";
import { FlightMain } from "../FlightMain.tsx";
import { isBookable } from "../flight-view.ts";
import { useCities } from "../hooks/useCities.ts";
import { useFlightsLive } from "../hooks/useFlightsLive.ts";
import { usePublicConfig } from "../hooks/usePublicConfig.ts";
import { Icon } from "../shell/Icon.tsx";
import { Shell } from "../shell/Shell.tsx";

const CODE = /^[A-Z]{3}$/;

export function Results() {
  const { lang, t } = useLang("results");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const config = usePublicConfig();
  const { cityName } = useCities();
  const { setSearch, chooseFlight, setCabin } = useWizard();

  const from = (params.get("from") ?? "").toUpperCase();
  const to = (params.get("to") ?? "").toUpperCase();
  const date = params.get("date") ?? "";
  const pax = Math.min(4, Math.max(1, Number(params.get("pax")) || 1));
  const valid = CODE.test(from) && CODE.test(to) && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const [showAll, setShowAll] = useState(false);
  const [sortPrice, setSortPrice] = useState(false);
  const [bizOnly, setBizOnly] = useState(false);
  const [direct, setDirect] = useState(true);
  const [condOpen, setCondOpen] = useState(false);

  useFlightsLive();
  useEffect(() => {
    if (valid) setSearch({ from, to, date, pax });
  }, [valid, from, to, date, pax, setSearch]);

  const types = useQuery(luggageTypesQuery());
  const fares = useMemo(() => fareOptions(types.data?.luggageTypes ?? []), [types.data]);
  const light = fares.find((f) => f.id === "light");

  const days = useMemo(
    () => (valid ? Array.from({ length: 7 }, (_, i) => addDays(date, i - 3)) : []),
    [valid, date],
  );
  const dayQueries = useQueries({
    queries: days.map((d) => ({ ...flightsQuery({ from, to, date: d }), enabled: valid })),
  });
  const today = todayBogota();
  const dayPrices = dayQueries.map((q) =>
    q.data ? lowestPriceUsd(fares, q.data.flights, config.taxPercentage) : null,
  );
  const lowest = Math.min(...dayPrices.filter((p): p is number => p !== null));

  const current = dayQueries[3];
  const flights: PublicFlight[] = useMemo(() => {
    let list = [...(current?.data?.flights ?? [])];
    if (bizOnly) list = list.filter((f) => f.availableByClass.business > 0);
    list.sort((a, b) =>
      sortPrice
        ? a.averagePriceEconomyUsd - b.averagePriceEconomyUsd
        : a.departureDate.localeCompare(b.departureDate),
    );
    return showAll ? list : list.slice(0, 1);
  }, [current?.data, bizOnly, sortPrice, showAll]);
  const totalCount = current?.data?.flights.length ?? 0;

  if (!valid) return <Navigate to="/" replace />;

  const pick = (flight: PublicFlight) => {
    chooseFlight(flight.id);
    if (bizOnly) setCabin("business");
    navigate("/fares");
  };
  const statusLabel = (f: PublicFlight) =>
    f.soldOut || f.status === "SOLD_OUT"
      ? t("flight.soldOut")
      : f.status === "CANCELLED"
        ? t("flight.cancelled")
        : null;

  return (
    <Shell kind="co" step={1} title="lifex — Selecciona tu vuelo">
      <main id="main" className="co-main">
        <div className="wrap">
          <Link className="back-link" to="/">
            <span>
              <Icon name="arrow-left" />
            </span>
            <span>{t("modify")}</span>
          </Link>
          <h1 className="co-title">
            {t("title", { from: cityName(from, lang), to: cityName(to, lang) })}
          </h1>
          <p className="co-sub">{totalCount === 1 ? t("sub1") : t("sub", { n: totalCount })}</p>
          <div className="date-strip" id="dates" role="group" aria-label={t("dates.aria")}>
            {days.map((d, i) => {
              const price = dayPrices[i] ?? null;
              return (
                <button
                  key={d}
                  className={`date-btn${price !== null && price === lowest ? " lowest" : ""}`}
                  type="button"
                  aria-pressed={d === date}
                  disabled={d < today}
                  onClick={() => setParams({ from, to, date: d, pax: String(pax) })}
                >
                  <span>
                    {formatDate(`${d}T12:00:00Z`, lang, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="price num">
                    {price !== null ? formatMoney(price, lang, config.iataTrm) : "—"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="filters" role="group" aria-label={t("filters")}>
            <span>{t("filters")}</span>
            <button
              className="fchip"
              type="button"
              aria-pressed={direct}
              onClick={() => setDirect((v) => !v)}
            >
              <span>{t("f.direct")}</span>
            </button>
            <button
              className="fchip"
              type="button"
              aria-pressed={bizOnly}
              onClick={() => setBizOnly((v) => !v)}
            >
              <span>{t("cabin.business")}</span>
            </button>
            <button
              className="fchip"
              type="button"
              aria-pressed={sortPrice}
              onClick={() => setSortPrice((v) => !v)}
            >
              <span>{t("f.price")}</span>
            </button>
          </div>
          <div id="flights">
            {current?.isError ? (
              <ErrorNotice error={current.error} onRetry={() => void current.refetch()} />
            ) : flights.length === 0 && !current?.isPending ? (
              <p className="note">{t("f.none")}</p>
            ) : (
              flights.map((f) => {
                const label = statusLabel(f);
                const price = light ? farePriceUsd(light, f, config.taxPercentage) : null;
                return (
                  <article className="flight-card" key={f.id}>
                    <FlightMain flight={f} />
                    <div className="flight-price">
                      <small>{t("from")}</small>
                      <span className="price num">
                        {price !== null ? formatMoney(price, lang, config.iataTrm) : "—"}
                      </span>
                      <button
                        className="btn btn-primary btn-sm pick"
                        type="button"
                        disabled={!isBookable(f)}
                        onClick={() => pick(f)}
                      >
                        {label ?? t("select")}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
          {!showAll && totalCount > 1 ? (
            <div style={{ textAlign: "center", margin: "26px 0 34px" }}>
              <button className="btn btn-ghost" type="button" onClick={() => setShowAll(true)}>
                {t("more")}
              </button>
            </div>
          ) : (
            <div style={{ margin: "26px 0 34px" }} />
          )}
          <div className={`acc${condOpen ? " open" : ""}`} id="cond">
            <button
              className="acc-head"
              type="button"
              aria-expanded={condOpen}
              onClick={() => setCondOpen((o) => !o)}
            >
              <span>{t("cond")}</span>
              <span className="chev">
                <Icon name="chev" />
              </span>
            </button>
            <div className="acc-body">
              <p style={{ margin: 0, color: "var(--ink-2)" }}>{t("cond.p")}</p>
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}
