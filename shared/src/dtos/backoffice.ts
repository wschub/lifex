import { z } from "zod";
import { isoDateTime, routeTypeSchema, uuid } from "../common.ts";

/** `GET /dashboard/aircraft` (solo administrador): la flota con sus capacidades y alcance. */
export const aircraftRowSchema = z.object({
  id: z.number().int(),
  internalIdentifier: z.string(),
  /** Modelo (por ejemplo "Boeing 787-9"). */
  reference: z.string(),
  description: z.string(),
  descriptionEs: z.string(),
  typeRange: routeTypeSchema,
  /** Alcance en millas náuticas y en kilómetros. */
  rangeNauticalMiles: z.number().int(),
  rangeKm: z.number().int(),
  totalSeats: z.number().int(),
  businessSeats: z.number().int(),
  economySeats: z.number().int(),
  seatColumns: z.string(),
  status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
  /** Vuelos que salen de ahora en adelante con este avión. */
  upcomingFlights: z.number().int(),
});
export type AircraftRow = z.infer<typeof aircraftRowSchema>;
export const aircraftResponseSchema = z.object({ aircraft: z.array(aircraftRowSchema) });

const pageMeta = { page: z.number().int(), pageSize: z.number().int(), total: z.number().int() };

/** Un cliente: quien compró (reservas confirmadas), agrupado por correo de contacto. */
export const customerRowSchema = z.object({
  email: z.string(),
  /** Titular de su última compra. */
  name: z.string(),
  phone: z.string().nullable(),
  purchases: z.number().int(),
  totalUsd: z.number(),
  lastPurchaseAt: isoDateTime,
});
export type CustomerRow = z.infer<typeof customerRowSchema>;
/** `GET /dashboard/customers?search=&page=&pageSize=` (solo administrador). */
export const customersResponseSchema = z.object({
  customers: z.array(customerRowSchema),
  ...pageMeta,
});

export const purchaseStatusSchema = z.enum([
  "DRAFT",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
]);
export type PurchaseStatus = z.infer<typeof purchaseStatusSchema>;

/** Una compra (reserva) con su cliente, su vuelo y su pago. */
export const purchaseRowSchema = z.object({
  id: uuid,
  reservationNumber: z.string(),
  createdAt: isoDateTime,
  status: purchaseStatusSchema,
  customerName: z.string(),
  customerEmail: z.string(),
  customerPhone: z.string().nullable(),
  passengers: z.number().int(),
  totalUsd: z.number(),
  flight: z.object({
    id: uuid,
    routeType: routeTypeSchema,
    from: z.string(),
    to: z.string(),
    fromCity: z.string(),
    toCity: z.string(),
    departureDate: isoDateTime,
  }),
  payment: z
    .object({
      status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
      cardBrand: z.string(),
      cardLast4: z.string(),
    })
    .nullable(),
});
export type PurchaseRow = z.infer<typeof purchaseRowSchema>;
/**
 * `GET /dashboard/purchases?search=&status=&email=&dateFrom=&dateTo=&origin=&destination=&page=&pageSize=`
 * (solo administrador). Sin `status`, las confirmadas; `ALL` trae todas menos los borradores.
 */
export const purchasesResponseSchema = z.object({
  purchases: z.array(purchaseRowSchema),
  ...pageMeta,
});
