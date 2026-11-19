export interface PricingLine {
  seatPriceUsd: number;
  /** null si el pasajero no eligió equipaje. */
  luggageFeePercentage: number | null;
}

export interface Pricing {
  /** Suma de los precios de asiento congelados al bloquear, en USD. */
  seatsPrice: number;
  /** Suma del recargo de equipaje (costo adicional sobre el precio del asiento), en USD. */
  luggagePrice: number;
  /** Asientos + recargo de equipaje, en USD: siempre `seatsPrice + luggagePrice`. */
  flightPrice: number;
  taxes: number;
  totalPrice: number;
}

const toCents = (usd: number): number => Math.round(usd * 100);
const fromCents = (cents: number): number => cents / 100;

/** El dinero se suma en centavos enteros para evitar errores de coma flotante. */
export function computePricing(lines: readonly PricingLine[], taxPercentage: number): Pricing {
  let seatsCents = 0;
  let luggageCents = 0;
  for (const line of lines) {
    const seat = toCents(line.seatPriceUsd);
    seatsCents += seat;
    if (line.luggageFeePercentage !== null) {
      luggageCents += Math.round((seat * line.luggageFeePercentage) / 100);
    }
  }
  const flightCents = seatsCents + luggageCents;
  const taxCents = Math.round((flightCents * taxPercentage) / 100);
  return {
    seatsPrice: fromCents(seatsCents),
    luggagePrice: fromCents(luggageCents),
    flightPrice: fromCents(flightCents),
    taxes: fromCents(taxCents),
    totalPrice: fromCents(flightCents + taxCents),
  };
}
