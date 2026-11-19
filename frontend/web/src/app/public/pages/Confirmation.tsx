import { ticketQrPath } from "@lifex/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { apiBaseUrl } from "@/api/config.ts";
import { flightQuery, ticketsQuery, bookingQuery } from "@/api/queries.ts";
import { ErrorNotice } from "@/components/ErrorNotice.tsx";
import { useLang } from "@/i18n/i18n.ts";
import { formatDate } from "@/lib/dates.ts";
import { PurchaseSummary } from "../PurchaseSummary.tsx";
import { formatMoney } from "@/lib/money.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { fareLabel, MILES_PER_USD } from "../fares.ts";
import { flightTimes } from "../flight-view.ts";
import { RequireStep } from "../guards.tsx";
import { useCities } from "../hooks/useCities.ts";
import { usePublicConfig } from "../hooks/usePublicConfig.ts";
import { Icon } from "../shell/Icon.tsx";
import { Shell } from "../shell/Shell.tsx";

function ConfirmationContent() {
  const { lang, t } = useLang("confirmation");
  const config = usePublicConfig();
  const { cityName } = useCities();
  const { confirmedBookingId, booking, fareId, reset } = useWizard();
  const token = booking?.token ?? "";
  const id = confirmedBookingId ?? "";

  const order = useQuery({ ...bookingQuery(id, token), enabled: !!token });
  const flightId = order.data?.booking.flightId;
  const flight = useQuery({ ...flightQuery(flightId ?? ""), enabled: !!flightId });
  // Los boletos se emiten justo después de aprobar el pago: se consulta hasta que aparezcan.
  const tickets = useQuery({
    ...ticketsQuery(id, token),
    enabled: !!token,
    retry: false,
    refetchInterval: (q) => (q.state.data?.tickets.length ? false : 1500),
  });

  const paid = order.data?.booking.totalPriceUsd ?? 0;
  const mult = MILES_PER_USD[fareId ?? "light"];
  const miles = new Intl.NumberFormat(lang === "en" ? "en-US" : "es-CO").format(
    Math.round(paid * mult),
  );
  const f = flight.data?.flight;
  const ft = f ? flightTimes(f) : null;

  return (
    <Shell kind="site" title="lifex — Tu viaje está confirmado">
      <main id="main" style={{ paddingBottom: 40 }}>
        <div className="wrap">
          <section className="confirm-hero">
            <div className="window" aria-hidden="true" id="okWin">
              <Icon name="check" />
            </div>
            <h1>{t("h")}</h1>
            <p>{t("p")}</p>
            <div className="code-box num" id="code" aria-label="Código de reserva">
              {order.data?.booking.reservationNumber ?? ""}
            </div>
          </section>
          {order.isError ? (
            <ErrorNotice error={order.error} onRetry={() => void order.refetch()} />
          ) : null}
          {!tickets.data?.tickets.length ? (
            <p className="sample-note" style={{ textAlign: "center" }} role="status">
              {t("conf.pending")}
            </p>
          ) : null}
          {f && ft
            ? (tickets.data?.tickets ?? []).map((ticket) => (
                <article className="boarding" key={ticket.ticketCode} aria-label="Pase de abordar">
                  <div className="main">
                    <small>{t("b.pax")}</small>
                    <b style={{ font: "500 22px var(--font-display)" }}>
                      {" "}
                      {ticket.passengerFullName}
                    </b>
                    <div className="big">
                      <span>{f.from.iataCode}</span>
                      <span>
                        <Icon name="plane" style={{ transform: "rotate(90deg)" }} />
                      </span>
                      <span>{f.to.iataCode}</span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        color: "var(--gray)",
                        fontSize: 15,
                      }}
                    >
                      <span>{cityName(f.from.iataCode, lang)}</span>
                      <span>{cityName(f.to.iataCode, lang)}</span>
                    </div>
                    <div className="meta">
                      <div>
                        <small>{t("b.date")}</small>
                        <b>
                          {formatDate(f.departureDate, lang, {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </b>
                      </div>
                      <div>
                        <small>{t("b.time")}</small>
                        <b className="num">{ft.dep}</b>
                      </div>
                    </div>
                  </div>
                  <div className="stub">
                    <div>
                      <small>{t("b.cabin")}</small>
                      <b>
                        {fareId
                          ? fareLabel(fareId, t)
                          : ticket.seatClass === "BUSINESS"
                            ? "Business"
                            : "Economy"}
                      </b>
                    </div>
                    <div>
                      <small>{t("b.seat")}</small>
                      <b>{ticket.seatIdentifier}</b>
                    </div>
                    <div>
                      <small>{t("b.paid")}</small>
                      <b className="num">{formatMoney(paid, lang, config.iataTrm)}</b>
                    </div>
                    <div>
                      <small>{t("b.miles")}</small>
                      <b className="num">{t("miles", { n: miles })}</b>
                    </div>
                    <div>
                      <img
                        src={`${apiBaseUrl()}${ticketQrPath(ticket.ticketCode)}`}
                        width={96}
                        height={96}
                        alt={`QR ${ticket.ticketCode}`}
                        style={{ background: "#fff", borderRadius: 8, padding: 4 }}
                      />
                    </div>
                  </div>
                </article>
              ))
            : null}
          {order.data ? (
            <section
              className="order"
              aria-label={t("sum.title")}
              style={{ position: "static", maxWidth: 880, margin: "28px auto 0" }}
            >
              <div className="panel">
                <h2>{t("sum.title")}</h2>
                <PurchaseSummary booking={order.data.booking} />
              </div>
            </section>
          ) : null}
          <div style={{ textAlign: "center", marginTop: 34 }}>
            <Link className="btn btn-ghost" to="/" id="home" onClick={reset}>
              {t("home")}
            </Link>
          </div>
        </div>
      </main>
    </Shell>
  );
}

export function Confirmation() {
  return (
    <RequireStep step="confirmation">
      <ConfirmationContent />
    </RequireStep>
  );
}
