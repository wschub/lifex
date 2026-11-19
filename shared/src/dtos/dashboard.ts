import { z } from "zod";
import { isoDateTime, uuid } from "../common.ts";

export const seatCountsSchema = z.object({
  free: z.number().int(),
  blocked: z.number().int(),
  paymentPending: z.number().int(),
  reserved: z.number().int(),
});
export type SeatCounts = z.infer<typeof seatCountsSchema>;

/** `GET /dashboard/flights/:id` (permiso `dashboard:read`). Los conteos son los reales de la tabla de asientos. */
export const flightMetricsSchema = z.object({
  flightId: uuid,
  status: z.string(),
  from: z.string(),
  to: z.string(),
  departureDate: isoDateTime,
  arrivalDate: isoDateTime,
  numMaxSeats: z.number().int(),
  numAvailableSeats: z.number().int(),
  /** Porcentaje 0–100. */
  occupancyRate: z.number(),
  /** Versión del último evento del vuelo, para encadenar los eventos del tema `dashboard:{id}`. */
  version: z.number().int(),
  seats: seatCountsSchema,
  byClass: z.object({ economy: seatCountsSchema, business: seatCountsSchema }),
});
export type FlightMetrics = z.infer<typeof flightMetricsSchema>;
export const flightMetricsResponseSchema = z.object({ metrics: flightMetricsSchema });

export const dashboardFlightRowSchema = z.object({
  flightId: uuid,
  status: z.string(),
  from: z.string(),
  to: z.string(),
  departureDate: isoDateTime,
  numMaxSeats: z.number().int(),
  numAvailableSeats: z.number().int(),
  occupancyRate: z.number(),
});
export type DashboardFlightRow = z.infer<typeof dashboardFlightRowSchema>;
/** `GET /dashboard/flights?date=AAAA-MM-DD` */
export const dashboardFlightsResponseSchema = z.object({
  flights: z.array(dashboardFlightRowSchema),
});
