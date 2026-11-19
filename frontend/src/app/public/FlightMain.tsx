import type { PublicFlight } from "@lifex/shared";
import { useLang } from "@/i18n/i18n.ts";
import { flightTimes, formatDuration } from "./flight-view.ts";
import { Icon } from "./shell/Icon.tsx";

/** Bloque horario de una tarjeta de vuelo: salida, línea de vuelo con duración y llegada. */
export function FlightMain({ flight }: { flight: PublicFlight }) {
  const { t } = useLang();
  const ft = flightTimes(flight);
  return (
    <div className="flight-main">
      <div className="fl-time num">
        {ft.dep}
        <small>{flight.from.iataCode}</small>
      </div>
      <div className="fl-line">
        <b>{t("direct")}</b> · {formatDuration(ft.durationMinutes)}
        <div className="track">
          <Icon name="plane" />
        </div>
        {t("operated")}
      </div>
      <div className="fl-time num" style={{ textAlign: "right" }}>
        {ft.arr}
        {ft.nextDay ? (
          <sup style={{ font: "500 13px var(--font-text)", color: "var(--gray)", marginLeft: 4 }}>
            {t("next.day")}
          </sup>
        ) : null}
        <small>{flight.to.iataCode}</small>
      </div>
    </div>
  );
}
