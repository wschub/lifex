import { z } from "zod";
import {
  flightStatusSchema,
  isoDateTime,
  seatClassSchema,
  seatStatusSchema,
  uuid,
} from "../common.ts";

export const publicSeatSchema = z.object({
  id: uuid,
  /** Ej. "08A". */
  identifier: z.string(),
  row: z.number().int(),
  column: z.string().length(1),
  seatClass: seatClassSchema,
  priceUsd: z.number(),
  status: seatStatusSchema,
});
export type PublicSeat = z.infer<typeof publicSeatSchema>;

/**
 * Snapshot del mapa de asientos (`GET /flights/:id/seats`). El cliente aplica encima los eventos
 * WebSocket con `version` mayor; si detecta un salto en la secuencia, vuelve a pedir el snapshot.
 */
export const seatMapSchema = z.object({
  flightId: uuid,
  flightStatus: flightStatusSchema,
  version: z.number().int(),
  seats: z.array(publicSeatSchema),
});
export type SeatMap = z.infer<typeof seatMapSchema>;

/** `POST /flights/:flightId/seats/:seatId/hold` (con el token de la reserva). 409 SEAT_UNAVAILABLE si ya no está libre. */
export const holdSeatResponseSchema = z.object({
  seat: publicSeatSchema,
  holdExpiresAt: isoDateTime,
});
export type HoldSeatResponse = z.infer<typeof holdSeatResponseSchema>;
