import type { HeldSeat } from "@/stores/booking-wizard.ts";

const toCents = (usd: number) => Math.round(usd * 100);

/**
 * Misma regla que el backend (`computePricing`): por pasajero asiento + recargo de equipaje (% del asiento),
 * y los impuestos (%) sobre la suma. Solo sirve para mostrar el total antes de confirmar; el valor
 * que se cobra es el de la reserva (`totalPriceUsd`).
 */
export function seatsTotalUsd(
  seats: readonly (HeldSeat | null)[],
  feePercentage: number,
  taxPercentage: number,
): number {
  let flight = 0;
  for (const seat of seats) {
    if (!seat) continue;
    const base = toCents(seat.priceUsd);
    flight += base + Math.round((base * feePercentage) / 100);
  }
  const tax = Math.round((flight * taxPercentage) / 100);
  return (flight + tax) / 100;
}
