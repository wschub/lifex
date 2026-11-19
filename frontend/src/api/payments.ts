import { paymentAcceptedSchema, type RequestPayment } from "@lifex/shared";
import { apiFetch } from "./http.ts";

/**
 * Inicia el pago (202: se procesa de forma asíncrona). La misma `idempotencyKey` en un reintento devuelve
 * el mismo pago en vez de crear otro. El número de tarjeta solo viaja aquí; nunca se guarda en el navegador.
 */
export const requestPayment = (
  bookingId: string,
  token: string,
  card: RequestPayment["card"],
  idempotencyKey: string,
) =>
  apiFetch(`/bookings/${bookingId}/payments`, paymentAcceptedSchema, {
    method: "POST",
    json: { card },
    bookingToken: token,
    idempotencyKey,
  });
