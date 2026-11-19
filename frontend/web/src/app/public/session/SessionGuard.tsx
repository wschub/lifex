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

/** Pasos de la compra donde corre el plazo de 15 minutos (y donde NO corre el aviso de inactividad). */
const PURCHASE_STEPS = ["/seats", "/payment"];

/**
 * Vigila la sesión del sitio público y abre el modal en dos casos que no se pisan:
 *  - **inactividad** (`idleTimeoutMinutes`, 2 min): en cualquier sección MENOS `/seats` y `/payment`. «Continuar»
 *    deja al usuario donde estaba; «Cerrar» (o salir) descarta la compra y vuelve a la portada.
 *  - **tiempo de compra agotado** (`maxSeatLockMinutes`, 15 min desde que se abrió la reserva, o antes si ésta
 *    vence): SOLO en `/seats` y `/payment`. Descarta la compra al abrirse (se sueltan los asientos) y tanto
 *    «Cerrar» como «Continuar» llevan a la portada para empezar de cero.
 * Se pausa en la confirmación y mientras se procesa un pago.
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

  // Con una compra en marcha se precarga el catálogo, para nombrar la ruta en el aviso.
  const hasFlight = useWizard((s) => s.flightId !== null);
  useEffect(() => {
    if (hasFlight) void queryClient.prefetchQuery(citiesQuery());
  }, [hasFlight, queryClient]);

  const finished = pathname === "/confirmation" || confirmed;
  const onPurchaseStep = PURCHASE_STEPS.includes(pathname);
  const watching = shown === null && !finished && !paying;

  /** Suelta los asientos bloqueados (el backend también los libera al vencer) y limpia el asistente. */
  const discardPurchase = useCallback(() => {
    const state = useWizard.getState();
    if (state.booking && state.flightId) {
      for (const seat of state.seats) {
        if (seat) {
          void releaseSeat(state.flightId, seat.seatId, state.booking.token).catch(() => {});
        }
      }
    }
    state.reset();
  }, []);

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
      // El tiempo agotado descarta la compra al abrirse; la inactividad espera la decisión del usuario.
      if (reason === "timeout") discardPurchase();
    },
    [queryClient, discardPurchase],
  );

  useIdleTimer({
    timeoutMs: idleTimeoutMinutes * MINUTE,
    enabled: watching && !onPurchaseStep,
    onIdle: () => trigger("idle"),
  });

  const deadlineMs =
    booking && purchaseStartedAt !== null
      ? Math.min(purchaseStartedAt + maxSeatLockMinutes * MINUTE, Date.parse(booking.expiresAt))
      : null;
  useDeadline({
    deadlineMs: Number.isNaN(deadlineMs) ? null : deadlineMs,
    enabled: watching && onPurchaseStep,
    onExpire: () => trigger("timeout"),
  });

  /** Vuelve a la portada; con la inactividad, la compra en curso se descarta ahora. */
  const restart = useCallback(() => {
    if (shown?.reason === "idle") discardPurchase();
    open.current = false;
    setShown(null);
    void navigate("/", { replace: true });
  }, [shown, discardPurchase, navigate]);

  /** Con la inactividad, deja todo como estaba; con el tiempo agotado, no hay nada que conservar. */
  const keepGoing = useCallback(() => {
    if (shown?.reason === "idle") {
      open.current = false;
      setShown(null);
    } else {
      restart();
    }
  }, [shown, restart]);

  if (!shown) return null;
  return (
    <SessionModal
      reason={shown.reason}
      hasPurchase={shown.hasPurchase}
      minutes={shown.reason === "idle" ? idleTimeoutMinutes : maxSeatLockMinutes}
      summary={shown.summary}
      onClose={restart}
      onContinue={keepGoing}
      onEscape={keepGoing}
    />
  );
}
