import { describe, expect, it } from "vitest";
import { purchaseLines } from "./purchase-lines.ts";

const cents = (n: number) => Math.round(n * 100);

describe("purchaseLines", () => {
  it("sin equipaje no incluye la línea de equipaje", () => {
    const lines = purchaseLines({
      seatsPriceUsd: 110,
      luggagePriceUsd: 0,
      taxesUsd: 20.9,
      totalPriceUsd: 130.9,
    });
    expect(lines.map((l) => l.key)).toEqual(["sum.tickets", "sum.taxes"]);
  });

  it("con equipaje lo muestra aparte y las líneas suman el total de la reserva", () => {
    const booking = {
      seatsPriceUsd: 100,
      luggagePriceUsd: 10,
      taxesUsd: 20.9,
      totalPriceUsd: 130.9,
    };
    const lines = purchaseLines(booking);
    expect(lines).toEqual([
      { key: "sum.tickets", usd: 100 },
      { key: "sum.luggage", usd: 10 },
      { key: "sum.taxes", usd: 20.9 },
    ]);
    expect(lines.reduce((sum, l) => sum + cents(l.usd), 0)).toBe(cents(booking.totalPriceUsd));
  });
});
