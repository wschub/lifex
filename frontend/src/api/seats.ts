import { holdSeatResponseSchema } from "@lifex/shared";
import { z } from "zod";
import { apiFetch } from "./http.ts";

/** Bloquea el asiento para la reserva (409 `SEAT_UNAVAILABLE` si otra persona lo tiene). */
export const holdSeat = (flightId: string, seatId: string, token: string) =>
  apiFetch(`/flights/${flightId}/seats/${seatId}/hold`, holdSeatResponseSchema, {
    method: "POST",
    bookingToken: token,
  });

/** Suelta un bloqueo propio (204 sin cuerpo). */
export const releaseSeat = (flightId: string, seatId: string, token: string) =>
  apiFetch(`/flights/${flightId}/seats/${seatId}/hold`, z.unknown(), {
    method: "DELETE",
    bookingToken: token,
  });
