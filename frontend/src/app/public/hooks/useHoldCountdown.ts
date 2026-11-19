import { useEffect, useState } from "react";
import { useWizard, type HeldSeat } from "@/stores/booking-wizard.ts";

const expiryOf = (seat: HeldSeat) => Date.parse(seat.holdExpiresAt);

/**
 * Vigila los bloqueos de asiento de la reserva: cuando uno vence lo quita del estado (el backend ya lo
 * liberó) y avisa con `expired = true`. Devuelve también los segundos que quedan del bloqueo más próximo.
 */
export function useHoldCountdown(now: () => number = Date.now): {
  expired: boolean;
  secondsLeft: number | null;
  dismiss: () => void;
} {
  const seats = useWizard((s) => s.seats);
  const setSeats = useWizard((s) => s.setSeats);
  const [expired, setExpired] = useState(false);
  const [tick, setTick] = useState(() => now());

  useEffect(() => {
    const held = seats.filter((s): s is HeldSeat => !!s);
    if (held.length === 0) return;
    const id = setInterval(() => {
      const current = now();
      setTick(current);
      if (held.some((s) => expiryOf(s) <= current)) {
        setSeats(seats.map((s) => (s && expiryOf(s) <= current ? null : s)));
        setExpired(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [seats, setSeats, now]);

  const held = seats.filter((s): s is HeldSeat => !!s);
  const nextExpiry = held.length ? Math.min(...held.map(expiryOf)) : null;
  return {
    expired,
    secondsLeft: nextExpiry === null ? null : Math.max(0, Math.ceil((nextExpiry - tick) / 1000)),
    dismiss: () => setExpired(false),
  };
}
