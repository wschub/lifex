import { useEffect, useState } from "react";
import { useWizard, type HeldSeat } from "@/stores/booking-wizard.ts";

const expiryOf = (seat: HeldSeat) => Date.parse(seat.holdExpiresAt);

/**
 * Vigila los bloqueos de asiento de la reserva: cuando uno vence lo quita del estado (el backend ya lo
 * liberó) y deja `holdExpired` activo para avisar. Devuelve también los segundos que quedan del más próximo.
 * Con `enabled = false` (pago en curso: el asiento ya no vence) no hace nada.
 */
export function useHoldCountdown(
  enabled = true,
  now: () => number = Date.now,
): { expired: boolean; secondsLeft: number | null; dismiss: () => void } {
  const seats = useWizard((s) => s.seats);
  const expired = useWizard((s) => s.holdExpired);
  const expireHolds = useWizard((s) => s.expireHolds);
  const dismiss = useWizard((s) => s.dismissHoldExpired);
  const [tick, setTick] = useState(() => now());

  useEffect(() => {
    if (!enabled) return;
    const held = seats.filter((s): s is HeldSeat => !!s);
    if (held.length === 0) return;
    const id = setInterval(() => {
      const current = now();
      setTick(current);
      if (held.some((s) => expiryOf(s) <= current)) {
        expireHolds(seats.map((s) => (s && expiryOf(s) <= current ? null : s)));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [enabled, seats, expireHolds, now]);

  const held = seats.filter((s): s is HeldSeat => !!s);
  const nextExpiry = held.length ? Math.min(...held.map(expiryOf)) : null;
  return {
    expired,
    secondsLeft:
      !enabled || nextExpiry === null ? null : Math.max(0, Math.ceil((nextExpiry - tick) / 1000)),
    dismiss,
  };
}
