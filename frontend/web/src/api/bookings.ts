import {
  bookingResponseSchema,
  startBookingResponseSchema,
  type SetPassengersRequest,
  type StartBookingRequest,
} from "@lifex/shared";
import { apiFetch } from "./http.ts";

/** Abre la reserva de invitado: devuelve la reserva y el token que firma todas las llamadas siguientes. */
export const startBooking = (input: StartBookingRequest) =>
  apiFetch("/bookings", startBookingResponseSchema, { method: "POST", json: input });

/** Reemplaza los pasajeros de la reserva (el primero es el comprador) con sus asientos ya bloqueados. */
export const setBookingPassengers = (id: string, token: string, input: SetPassengersRequest) =>
  apiFetch(`/bookings/${id}/passengers`, bookingResponseSchema, {
    method: "PUT",
    json: input,
    bookingToken: token,
  });
