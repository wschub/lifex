export interface PricingLine {
  seatPriceUsd: number;
  /** null si el pasajero no eligió equipaje. */
  luggageFeePercentage: number | null;
}

export interface Pricing {
  /** Asientos + recargo de equipaje, en USD. */
  flightPrice: number;
  taxes: number;
  totalPrice: number;
}

const toCents = (usd: number): number => Math.round(usd * 100);
const fromCents = (cents: number): number => cents / 100;

/** El dinero se suma en centavos enteros para evitar errores de coma flotante. */
export function computePricing(lines: readonly PricingLine[], taxPercentage: number): Pricing {
  let flightCents = 0;
  for (const line of lines) {
    const seat = toCents(line.seatPriceUsd);
    const luggage =
      line.luggageFeePercentage === null ? 0 : Math.round((seat * line.luggageFeePercentage) / 100);
    flightCents += seat + luggage;
  }
  const taxCents = Math.round((flightCents * taxPercentage) / 100);
  return {
    flightPrice: fromCents(flightCents),
    taxes: fromCents(taxCents),
    totalPrice: fromCents(flightCents + taxCents),
  };
}
