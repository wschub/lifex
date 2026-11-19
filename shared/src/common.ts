import { z } from "zod";

/**
 * Tipos básicos que comparten todos los contratos. Los valores de enum coinciden con los de la base
 * de datos; el front los traduce a texto legible según el idioma activo.
 */

export const uuid = z.uuid();
/** Fecha y hora en ISO 8601 (UTC), tal como las serializa la API. */
export const isoDateTime = z.iso.datetime();

export const localeSchema = z.enum(["es", "en"]);
export type Locale = z.infer<typeof localeSchema>;

export const flightStatusSchema = z.enum([
  "ACTIVE",
  "CANCELLED",
  "DELAYED",
  "SOLD_OUT",
  "FINALIZED",
]);
export type FlightStatus = z.infer<typeof flightStatusSchema>;

export const routeTypeSchema = z.enum(["DOMESTIC", "INTERNATIONAL"]);
export type RouteType = z.infer<typeof routeTypeSchema>;

export const seatClassSchema = z.enum(["ECONOMY", "BUSINESS"]);
export type SeatClass = z.infer<typeof seatClassSchema>;

export const seatStatusSchema = z.enum(["FREE", "BLOCKED", "PAYMENT_PENDING", "RESERVED"]);
export type SeatStatus = z.infer<typeof seatStatusSchema>;

export const orderStatusSchema = z.enum([
  "DRAFT",
  "PAYMENT_PENDING",
  "CONFIRMED",
  "CANCELLED",
  "EXPIRED",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const paymentStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const passengerTypeSchema = z.enum(["ADULT", "CHILD"]);
export type PassengerType = z.infer<typeof passengerTypeSchema>;

export const documentTypeSchema = z.enum(["CC", "CE", "TI", "PASSPORT"]);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const genderSchema = z.enum(["MASCULINO", "FEMENINO"]);
export type Gender = z.infer<typeof genderSchema>;

/** Cabecera obligatoria de `POST /bookings/:id/payments` (un UUID generado al entrar al checkout). */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

/** Ruta del endpoint WebSocket. */
export const WS_PATH = "/ws";

/** Los precios viajan siempre en USD; el front convierte a COP con la TRM (`IATA_TRM`) al mostrarlos. */
export type UsdAmount = number;
