import type { PublicSeat } from "@lifex/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { holdSeat, releaseSeat } from "@/api/seats.ts";
import { keys } from "@/api/keys.ts";
import { isApiError } from "@/api/errors.ts";
import { ErrorNotice } from "@/components/ErrorNotice.tsx";
import { useLang } from "@/i18n/i18n.ts";
import { formatMoney } from "@/lib/money.ts";
import { useWizard, type HeldSeat, type PassengerForm } from "@/stores/booking-wizard.ts";
import { RequireStep } from "../guards.tsx";
import { useHoldCountdown } from "../hooks/useHoldCountdown.ts";
import { usePublicConfig } from "../hooks/usePublicConfig.ts";
import { useSelectedFlight } from "../hooks/useSelectedFlight.ts";
import { seatsTotalUsd } from "../pricing.ts";
import { classOfCabin, groupRows, layoutFor } from "../seat-layout.ts";
import { Icon } from "../shell/Icon.tsx";
import { Shell } from "../shell/Shell.tsx";
import { useFlightSeats } from "@/ws/useFlightSeats.ts";
import { Link } from "react-router";

interface Tip {
  id: string;
  zone: "biz" | "std";
  extra: number;
  left: number;
  top: number;
  bg: string;
}

const initials = (p: PassengerForm | undefined, i: number) =>
  p?.ok ? `${p.first[0] ?? ""}${p.last[0] ?? ""}`.toUpperCase() : `P${i + 1}`;
const fullName = (p: PassengerForm | undefined, i: number, label: string) =>
  p?.ok ? `${p.first} ${p.last}` : label.replace("{n}", String(i + 1));

function SeatsContent() {
  const { lang, t } = useLang("seats");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const config = usePublicConfig();
  const { search, flightId, booking, passengers, seats, setSeats } = useWizard();
  const cabin = useWizard((s) => s.cabin);
  const { flight, fare } = useSelectedFlight();
  const map = useFlightSeats(flightId ?? "");
  const countdown = useHoldCountdown();

  const biz = cabin === "business";
  const seatClass = classOfCabin(cabin);
  const count = search.pax;
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [taken, setTaken] = useState(false);
  const [limit, setLimit] = useState(false);
  const [live, setLive] = useState("");
  const [tip, setTip] = useState<Tip | null>(null);

  const cabinSeats = useMemo(
    () => (map.data?.seats ?? []).filter((s) => s.seatClass === seatClass),
    [map.data, seatClass],
  );
  const layout = useMemo(
    () => layoutFor(seatClass, [...new Set(cabinSeats.map((s) => s.column))]),
    [cabinSeats, seatClass],
  );
  const rows = useMemo(() => groupRows(cabinSeats, layout), [cabinSeats, layout]);
  const mine = new Map(seats.flatMap((s, i) => (s ? [[s.seatId, i] as const] : [])));
  const money = (usd: number) => formatMoney(usd, lang, config.iataTrm);

  const fee = fare?.feePercentage ?? 0;
  const base = flight ? (biz ? flight.priceBusinessUsd : flight.priceEconomyUsd) : 0;
  /** Lo que cuesta el asiento por encima del precio base de la cabina; con precios uniformes es 0 ("Gratis"). */
  const extraOf = (seat: Pick<PublicSeat, "priceUsd">) =>
    Math.max(0, seat.priceUsd - base) * (1 + fee / 100) * (1 + config.taxPercentage / 100);
  const total = seatsTotalUsd(seats.slice(0, count), fee, config.taxPercentage);
  const chosen = seats.slice(0, count).filter(Boolean).length;
  const all = chosen === count;

  const release = async (index: number) => {
    const held = seats[index];
    if (!held || !flightId || !booking) return;
    const next = [...seats];
    next[index] = null;
    setSeats(next);
    setActive(index);
    try {
      await releaseSeat(flightId, held.seatId, booking.token);
    } catch {
      // si el backend ya lo había liberado (venció), el resultado es el mismo
    }
  };

  const toggle = async (seat: PublicSeat) => {
    if (busy || !flightId || !booking) return;
    const owner = mine.get(seat.id);
    if (owner !== undefined) {
      await release(owner);
      return;
    }
    const holding = seats.filter(Boolean).length;
    if (!seats[active] && holding >= config.maxHeldSeatsPerSession) {
      setLimit(true);
      return;
    }
    setBusy(true);
    setError(null);
    setTaken(false);
    setLimit(false);
    try {
      const result = await holdSeat(flightId, seat.id, booking.token);
      const heldSeat: HeldSeat = {
        seatId: seat.id,
        identifier: seat.identifier,
        seatClass: seat.seatClass,
        priceUsd: seat.priceUsd,
        holdExpiresAt: result.holdExpiresAt,
      };
      const previous = seats[active];
      const next = [...seats];
      next[active] = heldSeat;
      setSeats(next);
      if (previous) void releaseSeat(flightId, previous.seatId, booking.token).catch(() => {});
      const nextEmpty = Array.from({ length: count }, (_, i) => i).find((i) => !next[i]);
      if (nextEmpty !== undefined) setActive(nextEmpty);
      setLive(
        t("announce", {
          id: seat.identifier,
          name: fullName(passengers[active], active, t("pax")),
        }),
      );
    } catch (e) {
      if (isApiError(e) && e.code === "SEAT_UNAVAILABLE") {
        setTaken(true);
        void queryClient.invalidateQueries({ queryKey: keys.seatMap(flightId) });
      } else {
        setError(e);
      }
    } finally {
      setBusy(false);
    }
  };

  const showTip = (button: HTMLButtonElement, seat: PublicSeat) => {
    const rect = button.getBoundingClientRect();
    setTip({
      id: seat.identifier,
      zone: biz ? "biz" : "std",
      extra: extraOf(seat),
      left: Math.max(8, Math.min(window.innerWidth - 220, rect.left + rect.width / 2 - 90)),
      top: Math.max(8, rect.top - 64),
      bg: getComputedStyle(button).getPropertyValue("--seat-bg"),
    });
  };

  const lowest = cabinSeats.length ? Math.min(...cabinSeats.map((s) => s.priceUsd)) : 0;
  const lowestExtra = lowest ? extraOf({ priceUsd: lowest }) : 0;
  const zoneLow = lowestExtra ? money(lowestExtra) : t("free");
  const minutes =
    countdown.secondsLeft === null
      ? null
      : `${Math.floor(countdown.secondsLeft / 60)}:${String(countdown.secondsLeft % 60).padStart(2, "0")}`;

  return (
    <Shell kind="co" step={3} title="lifex — Selección de asientos" footer={false}>
      <main id="main" className="seat-page" style={{ display: "block" }}>
        <div className="seat-top">
          <div className="wrap">
            <h1 id="title">{t("title")}</h1>
            <div className="leg-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected="true"
                id="tab"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                {chosen > 0 ? <Icon name="check" /> : null}{" "}
                {t("leg", { from: search.from, to: search.to })}
              </button>
            </div>
          </div>
        </div>
        <div className="seat-body">
          <section aria-label="Pasajeros">
            {error ? <ErrorNotice error={error} /> : null}
            {taken ? (
              <div className="note warn" role="alert">
                <div>{t("seat.taken")}</div>
              </div>
            ) : null}
            {limit ? (
              <div className="note warn" role="alert">
                <div>{t("seat.limit", { n: config.maxHeldSeatsPerSession })}</div>
              </div>
            ) : null}
            {countdown.expired ? (
              <div className="note warn" role="alert">
                <div>{t("hold.expired")}</div>
              </div>
            ) : null}
            <div id="pax" className="stack">
              {Array.from({ length: count }, (_, i) => {
                const s = seats[i];
                return (
                  <div
                    key={i}
                    className={`pax-card${s ? " has" : ""}${i === active ? " active" : ""}`}
                    data-i={i}
                  >
                    <button
                      className="pax-pick"
                      type="button"
                      data-i={i}
                      aria-pressed={i === active}
                      aria-current={i === active ? "true" : undefined}
                      onClick={() => setActive(i)}
                    >
                      <span className="av">{s ? s.identifier : initials(passengers[i], i)}</span>
                      <span>
                        <b>{fullName(passengers[i], i, t("pax"))}</b>
                        <small>
                          {s
                            ? `${t(biz ? "z.biz" : "z.std")} · ${extraOf(s) ? money(extraOf(s)) : t("free")}`
                            : t("none")}
                        </small>
                      </span>
                    </button>
                    <button
                      className="rm"
                      type="button"
                      data-rm={i}
                      onClick={() => void release(i)}
                    >
                      {t("remove")}
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="legend" id="legend">
              <div>
                <span
                  className={`seat${biz ? " biz-seat" : ""}`}
                  data-zone={biz ? "biz" : "std"}
                  style={{ width: 30, display: "inline-block", pointerEvents: "none" }}
                />
                {t("avail")}
              </div>
              <div>
                <span
                  className="seat"
                  aria-pressed="true"
                  style={{
                    width: 30,
                    display: "inline-block",
                    pointerEvents: "none",
                    transform: "none",
                  }}
                />
                {t("sel")}
              </div>
              <div>
                <span
                  className="seat"
                  {...({ disabled: true } as object)}
                  style={{ width: 30, display: "inline-block", pointerEvents: "none" }}
                />
                {t("unav")}
              </div>
            </div>
          </section>
          <section aria-label="Mapa de la cabina">
            <div className={`cabin-shell ${biz ? "biz" : "eco"} seats-recede`} id="map">
              <div className="cols" style={{ gridTemplateColumns: layout.template }}>
                {layout.cols.flatMap((c, i) => [
                  <span key={c}>{c}</span>,
                  ...(layout.aisleAfter.includes(i) ? [<span key={`a${i}`} />] : []),
                  ...(layout.gapAfter.includes(i) ? [<span key={`g${i}`} />] : []),
                ])}
              </div>
              {!biz && rows.length ? (
                <div className="zone std">
                  <span>{t("z.std")}</span>
                  <b>
                    {t("from")} {zoneLow}
                  </b>
                </div>
              ) : null}
              {rows.map((r) => (
                <div
                  className="seatrow"
                  key={r.row}
                  style={{ gridTemplateColumns: layout.template }}
                >
                  {r.seats.flatMap((s, i) => [
                    s ? (
                      <SeatButton
                        key={s.id}
                        seat={s}
                        biz={biz}
                        owner={mine.get(s.id)}
                        initials={
                          mine.has(s.id)
                            ? initials(passengers[mine.get(s.id)!], mine.get(s.id)!)
                            : ""
                        }
                        label={`${t("seatIn", { id: s.identifier })} · ${t(biz ? "z.biz" : "z.std")}`}
                        unavailable={t("unav")}
                        onToggle={() => void toggle(s)}
                        onTip={showTip}
                        onTipOff={() => setTip(null)}
                      />
                    ) : (
                      <span key={`e${r.row}-${i}`} />
                    ),
                    ...(layout.aisleAfter.includes(i)
                      ? [
                          <span key={`n${r.row}-${i}`} className="rownum num">
                            {r.row}
                          </span>,
                        ]
                      : []),
                    ...(layout.gapAfter.includes(i) ? [<span key={`g${r.row}-${i}`} />] : []),
                  ])}
                </div>
              ))}
            </div>
          </section>
          <aside className="side-info" id="side" aria-live="polite">
            {biz ? (
              <>
                <h3>
                  <i style={{ ["--seat-bg" as string]: "#3B1F26" }} />
                  {t("z.biz")}
                </h3>
                <p>{t("d.biz")}</p>
                <div className="pic">
                  <img src="/img/business-seat.jpg" alt="" />
                </div>
                <p style={{ margin: "10px 0 0", fontSize: "12.5px", color: "var(--gray)" }}>
                  {t("ref")}
                </p>
              </>
            ) : (
              <>
                <div className="pic" style={{ marginBottom: 6 }}>
                  <img src="/img/economy-cabin.jpg" alt="" />
                </div>
                <p style={{ margin: "8px 0 0", fontSize: "12.5px", color: "var(--gray)" }}>
                  {t("ref")}
                </p>
                <details open>
                  <summary>
                    <i style={{ ["--seat-bg" as string]: "#CFD5DC" }} />
                    {t("z.std")}
                  </summary>
                  <p>{t("d.std")}</p>
                </details>
              </>
            )}
          </aside>
        </div>
        <div className="seat-foot" id="sfoot">
          <div className="wrap">
            <Link className="btn btn-ghost" to="/customize">
              {t("back")}
            </Link>
            <div className="acts">
              <div className="tot">
                <small>{t("totalPay")}</small>
                <b className="num">{money(total)}</b>
                {minutes ? <small>{t("hold.left", { time: minutes })}</small> : null}
              </div>
              <Link className="btn btn-ghost only-m" to="/customize">
                {t("back")}
              </Link>
              <button
                className="btn btn-dark"
                type="button"
                id="ok"
                disabled={!all}
                aria-disabled={all ? undefined : true}
                onClick={() => all && navigate("/customize")}
              >
                {t(biz ? "confirm" : "cont")}
              </button>
            </div>
          </div>
        </div>
        <div
          className={`seat-tip${tip ? " on" : ""}`}
          id="tip"
          role="status"
          style={tip ? { left: tip.left, top: tip.top } : undefined}
        >
          {tip ? (
            <>
              <i style={{ ["--seat-bg" as string]: tip.bg }}>{tip.id}</i>
              <div>
                <b>{t(tip.zone === "biz" ? "z.biz" : "z.std")}</b>
                {tip.extra ? money(tip.extra) : t("free")}
              </div>
            </>
          ) : null}
        </div>
        <div className="sr-only" id="live" aria-live="polite">
          {live}
        </div>
      </main>
    </Shell>
  );
}

interface SeatButtonProps {
  seat: PublicSeat;
  biz: boolean;
  owner: number | undefined;
  initials: string;
  label: string;
  unavailable: string;
  onToggle: () => void;
  onTip: (button: HTMLButtonElement, seat: PublicSeat) => void;
  onTipOff: () => void;
}
function SeatButton({
  seat,
  biz,
  owner,
  initials: ini,
  label,
  unavailable,
  onToggle,
  onTip,
  onTipOff,
}: SeatButtonProps) {
  const selected = owner !== undefined;
  const taken = !selected && seat.status !== "FREE";
  return (
    <button
      type="button"
      className={`seat${biz ? " biz-seat" : ""}`}
      data-id={seat.identifier}
      data-zone={biz ? "biz" : "std"}
      disabled={taken}
      aria-pressed={selected}
      aria-label={`${label}${taken ? ` · ${unavailable}` : ""}`}
      onClick={onToggle}
      onMouseEnter={(e) => !taken && onTip(e.currentTarget, seat)}
      onFocus={(e) => !taken && onTip(e.currentTarget, seat)}
      onMouseLeave={onTipOff}
      onBlur={onTipOff}
    >
      {selected ? ini : ""}
    </button>
  );
}

export function Seats() {
  return (
    <RequireStep step="seats">
      <SeatsContent />
    </RequireStep>
  );
}
