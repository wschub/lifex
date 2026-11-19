import { z } from "zod";
import {
  documentTypeSchema,
  genderSchema,
  isoDateTime,
  orderStatusSchema,
  passengerTypeSchema,
  paymentStatusSchema,
  uuid,
} from "../common.ts";

/** `POST /bookings`: abre la reserva. El idioma se toma de `Accept-Language`. */
export const startBookingRequestSchema = z
  .object({
    flightId: uuid,
    contactEmail: z.string().max(320),
    contactPhone: z.string().max(30).optional(),
  })
  .strict();
export type StartBookingRequest = z.infer<typeof startBookingRequestSchema>;

export const bookingPassengerSchema = z.object({
  id: uuid,
  fullName: z.string(),
  lastName: z.string(),
  passengerType: passengerTypeSchema,
  seatId: uuid.nullable(),
  seatIdentifier: z.string().nullable(),
  luggageTypeId: z.number().int().nullable(),
  /** Solo cuando la reserva está confirmada. */
  ticketCode: z.string().nullable(),
});

export const publicBookingSchema = z.object({
  id: uuid,
  orderNumber: z.string(),
  /** Código de reserva (PNR) de 6 caracteres. */
  reservationNumber: z.string(),
  flightId: uuid,
  status: orderStatusSchema,
  contactEmail: z.string(),
  contactPhone: z.string().nullable(),
  /** La reserva y su token de invitado caducan juntos. */
  expiresAt: isoDateTime,
  flightPriceUsd: z.number(),
  taxesUsd: z.number(),
  totalPriceUsd: z.number(),
  passengers: z.array(bookingPassengerSchema),
  payment: z.object({ id: uuid, status: paymentStatusSchema }).nullable(),
});
export type PublicBooking = z.infer<typeof publicBookingSchema>;

/** El `token` es el JWT de la sesión de invitado: va en `Authorization: Bearer` en todas las llamadas de la reserva. */
export const startBookingResponseSchema = z.object({
  booking: publicBookingSchema,
  token: z.string(),
  expiresInSeconds: z.number().int(),
});
export type StartBookingResponse = z.infer<typeof startBookingResponseSchema>;

export const passengerInputSchema = z
  .object({
    fullName: z.string().max(200),
    lastName: z.string().max(200),
    documentType: documentTypeSchema,
    documentNumber: z.string().max(40),
    gender: genderSchema,
    /** AAAA-MM-DD */
    dateBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    nationalityCountryId: z.number().int().positive(),
    /** Asiento que la sesión tiene bloqueado ahora mismo. */
    seatId: uuid,
    luggageTypeId: z.number().int().positive().optional(),
  })
  .strict();
export type PassengerInput = z.infer<typeof passengerInputSchema>;

/** `PUT /bookings/:id/passengers`: reemplaza los pasajeros; el primero es el comprador. */
export const setPassengersRequestSchema = z
  .object({ passengers: z.array(passengerInputSchema).min(1).max(20) })
  .strict();
export type SetPassengersRequest = z.infer<typeof setPassengersRequestSchema>;

export const bookingResponseSchema = z.object({ booking: publicBookingSchema });
