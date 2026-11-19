import type { PublicBooking } from "@lifex/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { keys } from "@/api/keys.ts";
import { citiesQuery } from "@/api/queries.ts";
import { releaseSeat } from "@/api/seats.ts";
import { useWizard, type WizardState } from "@/stores/booking-wizard.ts";
import type { AirportEntry } from "../hooks/useCities.ts";
import { usePublicConfig } from "../hooks/usePublicConfig.ts";
import { SessionModal, type SessionReason, type SessionSummary } from "./SessionModal.tsx";
import { useDeadline } from "./useDeadline.ts";
import { useIdleTimer } from "./useIdleTimer.ts";

interface Shown {
  reason: SessionReason;
  hasPurchase: boolean;
  summary: SessionSummary | null;
}

const MINUTE = 60_000;

/** Ruta, pasajeros y, si ya está en caché, código y total de la compra que se va a descartar. */
function summarize(
  state: WizardState,
  cities: AirportEntry[] | undefined,
  booking: PublicBooking | undefined,
): SessionSummary | null {
  if (state.flightId === null || !state.search.to) return null;
  const entry = (iata: string) => {
    const found = cities?.find((city) => city.iata === iata);
    return { name: found?.name ?? iata, nameEs: found?.nameEs ?? iata, iata };
  };
  return {
    from: entry(state.search.from),
    to: entry(state.search.to),
    pax: state.passengers.length || state.search.pax,
    ...(booking
      ? { reservationNumber: booking.reservationNumber, totalUsd: booking.totalPriceUsd }
      : {}),
  };
}

/**
 * Vigila la sesión en todo el sitio público y abre el modal en dos casos:
 *  - inactividad: `idleTimeoutMinutes` sin actividad en cualquier sección;
 *  - tiempo de compra agotado: pasaron `maxSeatLockMinutes` desde que se abrió la reserva (o ésta venció).
 * Al dispararse, la compra se descarta (se sueltan los asientos y se limpia el asistente); cerrar o continuar
 * lleva a la portada para empezar de cero. Se pausa en la confirmación y mientras se procesa un pago.
 */
export function SessionGuard() {
  const { idleTimeoutMinutes, maxSeatLockMinutes } = usePublicConfig();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const booking = useWizard((s) => s.booking);
  const purchaseStartedAt = useWizard((s) => s.purchaseStartedAt);
  const paying = useWizard((s) => s.paymentKey !== null);
  const confirmed = useWizard((s) => s.confirmedBookingId !== null);
  const [shown, setShown] = useState<Shown | null>(null);
  /** Evita abrir el aviso dos veces (los efectos pueden dispararse dos veces seguidas antes de repintar). */
  const open = useRef(false);

  // Con una compra en marcha se precarga el catálogo, para nombrar la ruta si hay que descartarla.
  const hasFlight = useWizard((s) => s.flightId !== null);
  useEffect(() => {
    if (hasFlight) void queryClient.prefetchQuery(citiesQuery());
  }, [hasFlight, queryClient]);

  const finished = pathname === "/confirmation" || confirmed;
  const watching = shown === null && !finished && !paying;

  const trigger = useCallback(
    (reason: SessionReason) => {
      if (open.current) return;
      open.current = true;
      const state = useWizard.getState();
      const cities = queryClient.getQueryData<{
        cities: {
          name: string;
          nameEs: string;
          countryIsoCode: string;
          imageName: string | null;
          airports: { iataCode: string }[];
        }[];
      }>(keys.cities);
      const entries: AirportEntry[] | undefined = cities?.cities.flatMap((city) =>
        city.airports.map((airport) => ({
          iata: airport.iataCode,
          name: city.name,
          nameEs: city.nameEs,
          countryIsoCode: city.countryIsoCode,
          imageName: city.imageName,
        })),
      );
      const cached = state.booking
        ? queryClient.getQueryData<{ booking: PublicBooking }>(keys.booking(state.booking.id))
        : undefined;
      setShown({
        reason,
        hasPurchase: state.flightId !== null,
        summary: summarize(state, entries, cached?.booking),
      });
      // Se sueltan los asientos bloqueados (el backend también los libera al vencer) y se empieza de cero.
      if (state.booking && state.flightId) {
        for (const seat of state.seats) {
          if (seat) {
            void releaseSeat(state.flightId, seat.seatId, state.booking.token).catch(() => {});
          }
        }
      }
      state.reset();
    },
    [queryClient],
  );

  useIdleTimer({
    timeoutMs: idleTimeoutMinutes * MINUTE,
    enabled: watching,
    onIdle: () => trigger("idle"),
  });

  const deadlineMs =
    booking && purchaseStartedAt !== null
      ? Math.min(purchaseStartedAt + maxSeatLockMinutes * MINUTE, Date.parse(booking.expiresAt))
      : null;
  useDeadline({
    deadlineMs: Number.isNaN(deadlineMs) ? null : deadlineMs,
    enabled: watching,
    onExpire: () => trigger("timeout"),
  });

  const close = useCallback(() => {
    open.current = false;
    setShown(null);
    void navigate("/", { replace: true });
  }, [navigate]);

  if (!shown) return null;
  return (
    <SessionModal
      reason={shown.reason}
      hasPurchase={shown.hasPurchase}
      minutes={shown.reason === "idle" ? idleTimeoutMinutes : maxSeatLockMinutes}
      summary={shown.summary}
      onClose={close}
    />
  );
}
