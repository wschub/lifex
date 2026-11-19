import type { PublicBooking } from "@lifex/shared";

export type PurchaseLineKey = "sum.tickets" | "sum.luggage" | "sum.taxes";

export interface PurchaseLine {
  key: PurchaseLineKey;
  usd: number;
}

type Breakdown = Pick<
  PublicBooking,
  "seatsPriceUsd" | "luggagePriceUsd" | "taxesUsd" | "totalPriceUsd"
>;

/**
 * Líneas de la tabla de la compra con los valores de la reserva, sin recalcular: tiquetes/asientos,
 * equipaje (solo si hay) e impuestos. El total (`totalPriceUsd`) se muestra aparte.
 */
export function purchaseLines(booking: Breakdown): PurchaseLine[] {
  return [
    { key: "sum.tickets", usd: booking.seatsPriceUsd },
    ...(booking.luggagePriceUsd > 0
      ? [{ key: "sum.luggage", usd: booking.luggagePriceUsd } as const]
      : []),
    { key: "sum.taxes", usd: booking.taxesUsd },
  ];
}
