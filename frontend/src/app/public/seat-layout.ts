import type { PublicSeat, SeatClass } from "@lifex/shared";

export interface SeatLayout {
  /** Letras de columna en el orden en que se dibujan. */
  cols: string[];
  /** `grid-template-columns` de cada fila (asientos, pasillos y números de fila). */
  template: string;
  /** Tras estas columnas (índice) va el número de fila. */
  aisleAfter: number[];
  /** Tras estas columnas va un hueco estrecho (solo Business 1-2-1). */
  gapAfter: number[];
}

const BUSINESS_TEMPLATE =
  "minmax(0, 78px) minmax(24px, 1fr) minmax(0, 78px) 12px minmax(0, 78px) minmax(24px, 1fr) minmax(0, 78px)";

/**
 * Distribución de la cabina según las columnas que trae el mapa: Business 1-2-1 (4 columnas),
 * Economy 3-3 (6) o 2-4-2 (8). Cualquier otra cantidad se dibuja en un solo bloque, sin pasillos.
 */
export function layoutFor(seatClass: SeatClass, columns: readonly string[]): SeatLayout {
  const cols = [...columns].sort();
  if (seatClass === "BUSINESS" && cols.length === 4) {
    return { cols, template: BUSINESS_TEMPLATE, aisleAfter: [0, 2], gapAfter: [1] };
  }
  if (seatClass === "ECONOMY" && cols.length === 6) {
    return { cols, template: "repeat(3, 1fr) 30px repeat(3, 1fr)", aisleAfter: [2], gapAfter: [] };
  }
  if (seatClass === "ECONOMY" && cols.length === 8) {
    return {
      cols,
      template: "repeat(2, 1fr) 30px repeat(4, 1fr) 30px repeat(2, 1fr)",
      aisleAfter: [1, 5],
      gapAfter: [],
    };
  }
  return { cols, template: `repeat(${cols.length}, 1fr)`, aisleAfter: [], gapAfter: [] };
}

export interface SeatRow {
  row: number;
  /** Un asiento por columna del layout, `null` donde no hay. */
  seats: (PublicSeat | null)[];
}

/** Agrupa los asientos de una cabina por fila, en el orden de columnas del layout. */
export function groupRows(seats: readonly PublicSeat[], layout: SeatLayout): SeatRow[] {
  const byRow = new Map<number, Map<string, PublicSeat>>();
  for (const seat of seats) {
    const row = byRow.get(seat.row) ?? new Map<string, PublicSeat>();
    row.set(seat.column, seat);
    byRow.set(seat.row, row);
  }
  return [...byRow.entries()]
    .sort(([a], [b]) => a - b)
    .map(([row, cells]) => ({ row, seats: layout.cols.map((c) => cells.get(c) ?? null) }));
}

export const classOfCabin = (cabin: "economy" | "business"): SeatClass =>
  cabin === "business" ? "BUSINESS" : "ECONOMY";
