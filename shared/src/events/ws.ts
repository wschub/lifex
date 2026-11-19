import { z } from "zod";
import { isoDateTime, seatStatusSchema, uuid, flightStatusSchema } from "../common.ts";

/**
 * Catálogo de mensajes WebSocket (`ws://host/ws?token=<jwt de staff, opcional>`).
 *
 * Temas:
 *   flight:{id}     mapa de asientos de un vuelo (público)
 *   flights:search  cambios de estado de vuelos para las pantallas de resultados (público)
 *   dashboard:{id}  métricas de ocupación de un vuelo (exige el permiso `dashboard:read`)
 *
 * Resincronización: cada evento de vuelo trae un `version` secuencial. Al conectar, al reconectar o al
 * ver un salto en la secuencia, el cliente pide el snapshot por REST y aplica solo los eventos con
 * `version` mayor. El socket por sí solo no garantiza entrega: una desconexión corta puede perder eventos.
 */

export const TOPIC = {
  flight: (flightId: string) => `flight:${flightId}` as const,
  dashboard: (flightId: string) => `dashboard:${flightId}` as const,
  flightsSearch: "flights:search",
} as const;

const UUID_RE = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
export const topicSchema = z
  .string()
  .regex(new RegExp(`^(flight:${UUID_RE}|dashboard:${UUID_RE}|flights:search)$`));
export type Topic = z.infer<typeof topicSchema>;

// ───────────── Cliente → servidor ─────────────

export const clientMessageSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("subscribe"), topic: topicSchema }),
  z.object({ action: z.literal("unsubscribe"), topic: topicSchema }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

// ───────────── Servidor → cliente: control ─────────────

export const wsErrorCodeSchema = z.enum([
  "INVALID_JSON",
  "INVALID_TOPIC",
  "INVALID_ACTION",
  "TOO_MANY_TOPICS",
  "FORBIDDEN",
]);

export const controlMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("connected") }),
  z.object({ type: z.literal("subscribed"), topic: topicSchema }),
  z.object({ type: z.literal("unsubscribed"), topic: topicSchema }),
  z.object({ type: z.literal("error"), code: wsErrorCodeSchema, topic: topicSchema.optional() }),
]);

// ───────────── Servidor → cliente: eventos de vuelo ─────────────

const seatDataSchema = z.object({
  seatId: uuid,
  seatIdentifier: z.string(),
  status: seatStatusSchema,
});

function flightEvent<T extends string, D extends z.ZodType>(type: T, data: D) {
  return z.object({
    type: z.literal(type),
    topic: topicSchema,
    flightId: uuid,
    /** Secuencial por vuelo. */
    version: z.number().int(),
    data,
    at: isoDateTime,
  });
}

export const flightEventSchema = z.discriminatedUnion("type", [
  /** Un cliente bloqueó un asiento (queda BLOCKED hasta `MAX_SEAT_LOCK_TIME`). */
  flightEvent("SeatHeld", seatDataSchema),
  /** Se inició el pago: el asiento pasa a PAYMENT_PENDING y el job de expiración ya no lo libera. */
  flightEvent("SeatPaymentPending", seatDataSchema),
  /** Pago aprobado: el asiento queda RESERVED (estado final). */
  flightEvent("SeatSold", seatDataSchema),
  /** El asiento vuelve a FREE: lo soltó su dueño, venció el bloqueo o se rechazó el pago. */
  flightEvent(
    "SeatReleased",
    seatDataSchema.extend({
      reason: z.enum(["released", "expired", "payment_rejected"]),
      detail: z.string().optional(),
    }),
  ),
  /** Compra confirmada (una por orden). */
  flightEvent(
    "BookingConfirmed",
    z.object({
      orderId: uuid,
      reservationNumber: z.string(),
      seatIds: z.array(uuid),
      numAvailableSeats: z.number().int(),
    }),
  ),
  /** El admin cambió el estado del vuelo (o se agotó: SOLD_OUT). También se difunde en `flights:search`. */
  flightEvent(
    "FlightStatusChanged",
    z.object({ status: flightStatusSchema, previousStatus: flightStatusSchema }),
  ),
]);
export type FlightEvent = z.infer<typeof flightEventSchema>;
export type FlightEventType = FlightEvent["type"];

export const serverMessageSchema = z.union([controlMessageSchema, flightEventSchema]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
