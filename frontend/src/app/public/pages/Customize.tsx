import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { setBookingPassengers } from "@/api/bookings.ts";
import { releaseSeat } from "@/api/seats.ts";
import { ErrorNotice } from "@/components/ErrorNotice.tsx";
import { useLang } from "@/i18n/i18n.ts";
import { formatMoney } from "@/lib/money.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { RequireStep } from "../guards.tsx";
import { useHoldCountdown } from "../hooks/useHoldCountdown.ts";
import { usePublicConfig } from "../hooks/usePublicConfig.ts";
import { useSelectedFlight } from "../hooks/useSelectedFlight.ts";
import { toSetPassengersRequest } from "../booking-request.ts";
import { farePriceUsd } from "../fares.ts";
import { seatsTotalUsd } from "../pricing.ts";
import { Icon } from "../shell/Icon.tsx";
import { Shell } from "../shell/Shell.tsx";
import { SummaryBar } from "../shell/SummaryBar.tsx";

function CustomizeContent() {
  const { lang, t } = useLang("customize");
  const navigate = useNavigate();
  const config = usePublicConfig();
  const wizard = useWizard();
  const { search, flightId, booking, seats, passengers, holder, luggageTypeId, cabin } = wizard;
  const { flight, fare } = useSelectedFlight();
  const countdown = useHoldCountdown();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const count = search.pax;
  const held = seats.slice(0, count).filter((s) => !!s);
  const all = held.length === count;
  const biz = cabin === "business";
  const money = (usd: number) => formatMoney(usd, lang, config.iataTrm);

  const estimate = flight && fare ? farePriceUsd(fare, flight, config.taxPercentage) * count : 0;
  const total = held.length
    ? seatsTotalUsd(held, fare?.feePercentage ?? 0, config.taxPercentage)
    : estimate;
  const base = flight ? (biz ? flight.averagePriceBusinessUsd : flight.averagePriceEconomyUsd) : 0;
  /** Lo que suman los asientos por encima del precio base; con precios uniformes por cabina es 0 ("Gratis"). */
  const extra =
    held.reduce((sum, s) => sum + Math.max(0, s.priceUsd - base), 0) *
    (1 + (fare?.feePercentage ?? 0) / 100) *
    (1 + config.taxPercentage / 100);

  const clearSeats = async () => {
    const current = seats.filter((s) => !!s);
    wizard.setSeats([]);
    if (!flightId || !booking) return;
    await Promise.all(
      current.map((s) => releaseSeat(flightId, s.seatId, booking.token).catch(() => {})),
    );
  };

  const pay = async () => {
    if (!booking || !holder || luggageTypeId === null || pending) return;
    setPending(true);
    setError(null);
    try {
      await setBookingPassengers(
        booking.id,
        booking.token,
        toSetPassengersRequest({ passengers, holder, seats, luggageTypeId, count }),
      );
      navigate("/payment");
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  };

  return (
    <Shell
      kind="co"
      step={3}
      title="lifex — Personaliza tu viaje"
      bar={
        <SummaryBar
          totalUsd={total}
          backTo="/passengers"
          label="pay"
          ready={all && !pending}
          onNext={() => void pay()}
          onBlocked={() => navigate("/seats")}
        />
      }
    >
      <main id="main" className="co-main">
        <div className="wrap">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 26,
            }}
          >
            <h1 className="co-title" style={{ margin: 0 }}>
              {t("title")}
            </h1>
            <Link className="back-link" to="/passengers" style={{ margin: 0 }}>
              <span>
                <Icon name="arrow-left" />
              </span>
              <span>{t("back.pax")}</span>
            </Link>
          </div>
          {error ? <ErrorNotice error={error} onRetry={() => void pay()} /> : null}
          {countdown.expired ? (
            <div className="note warn" role="alert">
              <div>{t("hold.expired")}</div>
            </div>
          ) : null}
          <div className="opts" id="opts">
            <article
              className={`opt${all ? " chosen" : ""}`}
              id="optSeat"
              onClick={(e) => {
                if (!(e.target as HTMLElement).closest("a,button")) navigate("/seats");
              }}
            >
              <div className="art">
                <Icon name="seat" />
              </div>
              <h3>{t("seat.h")}</h3>
              <p>{t("seat.p")}</p>
              <div className="foot">
                {all ? (
                  <>
                    <div>
                      <small>{t("added")}</small>
                      <b className="num">{extra ? money(extra) : t("free")}</b>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Link
                        className="btn btn-ghost btn-sm"
                        to="/seats"
                        style={{ padding: "0 12px" }}
                        aria-label={t("edit")}
                      >
                        <Icon name="edit" />
                      </Link>
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        id="seatDel"
                        style={{ padding: "0 12px" }}
                        aria-label={t("remove")}
                        onClick={(e) => {
                          e.stopPropagation();
                          void clearSeats();
                        }}
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <small>{t("from")}</small>
                      <b className="num">{t("free")}</b>
                    </div>
                    <Link className="btn btn-ghost btn-sm" to="/seats">
                      {t("choose")}
                    </Link>
                  </>
                )}
              </div>
            </article>
            {(
              [
                ["luggage", "bag.h", "bag.p"],
                ["bike", "sport.h", "sport.p"],
              ] as const
            ).map(([icon, h, p]) => (
              <article className="opt" key={h}>
                <div className="art">
                  <Icon name={icon} />
                </div>
                <h3>{t(h)}</h3>
                <p>{t(p)}</p>
                <div className="foot">
                  <div>
                    <small>{t("soon.short")}</small>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    disabled
                    title={t("soon.short")}
                  >
                    {t("add")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </Shell>
  );
}

export function Customize() {
  return (
    <RequireStep step="customize">
      <CustomizeContent />
    </RequireStep>
  );
}
