import type { Seat } from "../domain/entities/seat.entity.ts";

export interface PublicSeat {
  id: string;
  identifier: string;
  row: number;
  column: string;
  seatClass: Seat["seatClass"];
  /** USD. */
  priceUsd: number;
  status: Seat["status"];
}

/** Nunca expone la sesión que bloquea el asiento. */
export function toPublicSeat(seat: Seat, priceUsd: number = seat.price): PublicSeat {
  return {
    id: seat.id,
    identifier: seat.identifier,
    row: seat.row,
    column: seat.column,
    seatClass: seat.seatClass,
    priceUsd,
    status: seat.status,
  };
}
