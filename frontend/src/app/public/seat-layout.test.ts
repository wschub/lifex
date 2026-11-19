import type { PublicSeat } from "@lifex/shared";
import { describe, expect, it } from "vitest";
import { groupRows, layoutFor } from "./seat-layout.ts";

const seat = (row: number, column: string): PublicSeat => ({
  id: `${row}${column}`.padEnd(36, "0"),
  identifier: `${String(row).padStart(2, "0")}${column}`,
  row,
  column,
  seatClass: "ECONOMY",
  priceUsd: 10,
  status: "FREE",
});

describe("layoutFor", () => {
  it("Business de 4 columnas es 1-2-1 con 7 pistas de grid", () => {
    const l = layoutFor("BUSINESS", ["F", "A", "D", "C"]);
    expect(l.cols).toEqual(["A", "C", "D", "F"]);
    expect(l.aisleAfter).toEqual([0, 2]);
    expect(l.gapAfter).toEqual([1]);
  });
  it("Economy de 6 columnas es 3-3 y de 8 es 2-4-2", () => {
    expect(layoutFor("ECONOMY", [..."ABCDEF"]).aisleAfter).toEqual([2]);
    expect(layoutFor("ECONOMY", [..."ABCDEFGH"]).aisleAfter).toEqual([1, 5]);
  });
  it("una cantidad de columnas desconocida se dibuja en un solo bloque", () => {
    const l = layoutFor("ECONOMY", [..."ABCDE"]);
    expect(l.aisleAfter).toEqual([]);
    expect(l.template).toBe("repeat(5, 1fr)");
  });
});

describe("groupRows", () => {
  it("agrupa por fila y deja null donde falta un asiento", () => {
    const layout = layoutFor("ECONOMY", [..."ABCDEF"]);
    const rows = groupRows([seat(2, "A"), seat(1, "B"), seat(1, "A")], layout);
    expect(rows.map((r) => r.row)).toEqual([1, 2]);
    expect(rows[0]!.seats.map((s) => s?.column ?? null)).toEqual([
      "A",
      "B",
      null,
      null,
      null,
      null,
    ]);
    expect(rows[1]!.seats[0]?.column).toBe("A");
  });
});
