import { z } from "zod";
import { isoDateTime, routeTypeSchema, uuid } from "../common.ts";

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
  routeType: routeTypeSchema,
  /** Códigos IATA de origen y destino. */
  from: z.string(),
  to: z.string(),
  /** Ciudades en español. */
  fromCity: z.string(),
  toCity: z.string(),
  departureDate: isoDateTime,
  numMaxSeats: z.number().int(),
  numAvailableSeats: z.number().int(),
  occupancyRate: z.number(),
});
export type DashboardFlightRow = z.infer<typeof dashboardFlightRowSchema>;
/**
 * `GET /dashboard/flights?date=AAAA-MM-DD&from=MDE&to=BOG&page=1&pageSize=20`: todos los vuelos (nacionales e
 * internacionales), ordenados por salida y paginados. Todos los filtros son opcionales; sin fecha, los que aún no salieron.
 */
export const dashboardFlightsResponseSchema = z.object({
  flights: z.array(dashboardFlightRowSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  /** Total de vuelos que cumplen los filtros (todas las páginas). */
  total: z.number().int(),
});

const occupancyFiguresSchema = z.object({
  total: z.number().int(),
  sold: z.number().int(),
  /** Porcentaje 0–100 con un decimal. */
  occupancyRate: z.number(),
});

/**
 * `GET /dashboard/overview?date=AAAA-MM-DD` (por defecto, hoy en hora de Colombia): indicadores y series de los
 * vuelos que salen ese día, para las gráficas del panel.
 */
export const dashboardOverviewSchema = z.object({
  date: z.string(),
  flights: z.object({
    total: z.number().int(),
    domestic: z.number().int(),
    international: z.number().int(),
    byStatus: z.record(z.string(), z.number().int()),
  }),
  seats: occupancyFiguresSchema.extend({
    available: z.number().int(),
    byClass: z.object({ economy: occupancyFiguresSchema, business: occupancyFiguresSchema }),
    byRouteType: z.object({
      domestic: occupancyFiguresSchema,
      international: occupancyFiguresSchema,
    }),
  }),
  /** Vuelos que salen en cada hora local (0–23). */
  byHour: z.array(
    z.object({
      hour: z.number().int(),
      domestic: z.number().int(),
      international: z.number().int(),
    }),
  ),
  /** Tickets emitidos y dinero cobrado (USD) de las reservas confirmadas de esos vuelos. */
  sales: z.object({ ticketsSold: z.number().int(), revenueUsd: z.number() }),
  /** Vuelos cancelados o retrasados. */
  disruptions: z.number().int(),
});
export type DashboardOverview = z.infer<typeof dashboardOverviewSchema>;
export const dashboardOverviewResponseSchema = z.object({ overview: dashboardOverviewSchema });
