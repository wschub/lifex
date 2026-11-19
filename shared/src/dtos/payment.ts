import { z } from "zod";
import { orderStatusSchema, paymentStatusSchema, uuid } from "../common.ts";

/**
 * `POST /bookings/:id/payments` con la cabecera `Idempotency-Key`. El número de tarjeta nunca se
 * guarda: solo marca y últimos 4 dígitos.
 *
 * Tarjetas de prueba: 4242 4242 4242 4242 (aprobada), 4000 0000 0000 0002 (rechazada),
 * 4000 0000 0000 9995 (timeout de la pasarela).
 */
export const requestPaymentSchema = z
  .object({
    card: z
      .object({
        number: z.string().max(25),
        holderName: z.string().max(100),
        expMonth: z.number().int().min(1).max(12),
        expYear: z.number().int(),
        cvv: z.string().max(4),
      })
      .strict(),
  })
  .strict();
export type RequestPayment = z.infer<typeof requestPaymentSchema>;

/**
 * 202 Accepted: el pago se procesa de forma asíncrona. El resultado llega por WebSocket
 * (`BookingConfirmed` / `SeatReleased`) o consultando `GET /bookings/:id`.
 */
export const paymentAcceptedSchema = z.object({
  payment: z.object({ id: uuid, status: paymentStatusSchema }),
  booking: z.object({ id: uuid, status: orderStatusSchema }),
});
export type PaymentAccepted = z.infer<typeof paymentAcceptedSchema>;
