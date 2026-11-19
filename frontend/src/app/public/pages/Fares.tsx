import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ErrorNotice } from "@/components/ErrorNotice.tsx";
import { useLang } from "@/i18n/i18n.ts";
import { formatMoney } from "@/lib/money.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { FARE_ITEMS, farePriceUsd, type FareOption } from "../fares.ts";
import { FlightMain } from "../FlightMain.tsx";
import { RequireStep } from "../guards.tsx";
import { usePublicConfig } from "../hooks/usePublicConfig.ts";
import { useSelectedFlight } from "../hooks/useSelectedFlight.ts";
import { Icon } from "../shell/Icon.tsx";
import { Shell } from "../shell/Shell.tsx";

function FareItems({ id }: { id: FareOption["id"] }) {
  const { t } = useLang("fares");
  return (
    <ul>
      {FARE_ITEMS[id].map(([key, included, icon]) => (
        <li key={key} className={included ? "" : "no"}>
          <Icon name={icon} />
          <span>{t(key)}</span>
        </li>
      ))}
    </ul>
  );
}

function FaresContent() {
  const { lang, t } = useLang("fares");
  const navigate = useNavigate();
  const config = usePublicConfig();
  const { search, cabin: storedCabin, chooseFare } = useWizard();
  const { flight, fares, loading, error, refetch } = useSelectedFlight();
  const [cabin, setCabin] = useState(storedCabin);
  const money = (usd: number) => formatMoney(usd, lang, config.iataTrm);
  const economy = fares.filter((f) => f.cabin === "economy");
  const business = fares.filter((f) => f.cabin === "business");
  const light = economy.find((f) => f.id === "light");

  const choose = (fare: FareOption) => {
    chooseFare({ fareId: fare.id, luggageTypeId: fare.luggageTypeId, cabin: fare.cabin });
    navigate("/summary");
  };

  return (
    <Shell kind="co" step={1} title="lifex — Elige tu tarifa">
      <main id="main" className="co-main">
        <div className="wrap">
          <Link
            className="back-link"
            to={`/results?from=${search.from}&to=${search.to}&date=${search.date}&pax=${search.pax}`}
          >
            <span>
              <Icon name="arrow-left" />
            </span>
            <span>{t("back.results")}</span>
          </Link>
          <h1 className="co-title">{t("title")}</h1>
          <p className="co-sub">{t("sub")}</p>
          {error ? <ErrorNotice error={error} onRetry={refetch} /> : null}
          {flight && !loading ? (
            <>
              <div className="flight-card" style={{ marginBottom: 28 }}>
                <FlightMain flight={flight} />
                <div className="flight-price">
                  {flight.offer ? (
                    <span className="badge">
                      {t("offer.tag", { n: flight.offer.discountPercentage })}
                    </span>
                  ) : null}
                  <small>{t("from")}</small>
                  <span className="price num">
                    {light ? money(farePriceUsd(light, flight, config.taxPercentage)) : "—"}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="cabin-toggle" role="group" aria-label={t("cabin.aria")}>
                  <button
                    type="button"
                    aria-pressed={cabin === "economy"}
                    onClick={() => setCabin("economy")}
                  >
                    {t("cabin.economy")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={cabin === "business"}
                    onClick={() => setCabin("business")}
                  >
                    {t("cabin.business")}
                  </button>
                </div>
              </div>
              <div className="fare-panel" id="panel">
                {cabin === "economy" ? (
                  <div className="fare-grid econ">
                    {economy.map((fare) => (
                      <div
                        key={fare.id}
                        className={`fare${fare.id === "classic" ? " featured" : ""}`}
                        data-f={fare.id}
                        onClick={() => choose(fare)}
                      >
                        {fare.id === "classic" ? <span className="tag">{t("rec")}</span> : null}
                        <h3>{t(`fare.${fare.id}`)}</h3>
                        <FareItems id={fare.id} />
                        <div className="price-row">
                          <button
                            type="button"
                            className={`btn ${fare.id === "classic" ? "btn-primary" : "btn-dark"}`}
                          >
                            {t("choose", {
                              price: money(farePriceUsd(fare, flight, config.taxPercentage)),
                            })}
                          </button>
                          <small className="per">{t("per")}</small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="biz-intro">
                      <div className="pic">
                        <img src="/img/business-seat.jpg" alt="" />
                      </div>
                      <div className="copy">
                        <h3>{t("biz.h")}</h3>
                        <p>
                          {t("biz.p")}{" "}
                          <span style={{ color: "var(--gray)", fontSize: "13.5px" }}>
                            ({t("biz.n")})
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="fare-grid biz">
                      {business.map((fare) => (
                        <div
                          key={fare.id}
                          className={`fare biz-fare${fare.id === "royal" ? " featured" : ""}`}
                          data-f={fare.id}
                          onClick={() => choose(fare)}
                        >
                          {fare.id === "royal" ? <span className="tag">{t("full")}</span> : null}
                          <h3>Business {t(`fare.${fare.id}`)}</h3>
                          <FareItems id={fare.id} />
                          <div className="price-row">
                            <button type="button" className="btn">
                              {t("choose", {
                                price: money(farePriceUsd(fare, flight, config.taxPercentage)),
                              })}
                            </button>
                            <small className="per">{t("per")}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : null}
        </div>
      </main>
    </Shell>
  );
}

export function Fares() {
  return (
    <RequireStep step="fares">
      <FaresContent />
    </RequireStep>
  );
}
