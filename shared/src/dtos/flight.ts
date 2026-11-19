import { z } from "zod";
import { flightStatusSchema, isoDateTime, routeTypeSchema, uuid } from "../common.ts";

export const airportInfoSchema = z.object({
  iataCode: z.string().length(3),
  city: z.string(),
  cityEs: z.string(),
  cityImageUrl: z.string().nullable(),
  country: z.string(),
  countryEs: z.string(),
});
export type AirportInfo = z.infer<typeof airportInfoSchema>;

/** Un vuelo en los resultados de búsqueda y en el detalle. Precios en USD. */
export const publicFlightSchema = z.object({
  id: uuid,
  routeType: routeTypeSchema,
  from: airportInfoSchema,
  to: airportInfoSchema,
  departureDate: isoDateTime,
  arrivalDate: isoDateTime,
  status: flightStatusSchema,
  basePriceUsd: z.number(),
  averagePriceEconomyUsd: z.number(),
  averagePriceBusinessUsd: z.number(),
  /** Precio vigente por clase (USD), calculado al consultar: precio dinámico u oferta. */
  priceEconomyUsd: z.number(),
  priceBusinessUsd: z.number(),
  /** Presente si el vuelo es una oferta: el descuento reemplaza al precio dinámico. */
  offer: z.object({ discountPercentage: z.number() }).nullable(),
  numAvailableSeats: z.number().int(),
  availableByClass: z.object({ economy: z.number().int(), business: z.number().int() }),
  /** Un vuelo sin asientos se marca como agotado en vez de ocultarse. */
  soldOut: z.boolean(),
});
export type PublicFlight = z.infer<typeof publicFlightSchema>;

/** `GET /flights?from=MDE&to=BOG&date=2026-12-01` (códigos IATA; la fecha se interpreta en hora de Colombia). */
export const flightSearchQuerySchema = z.object({
  from: z.string().length(3),
  to: z.string().length(3),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type FlightSearchQuery = z.infer<typeof flightSearchQuerySchema>;

export const flightSearchResponseSchema = z.object({ flights: z.array(publicFlightSchema) });
export const flightDetailResponseSchema = z.object({ flight: publicFlightSchema });

/** `PATCH /flights/:id/status` (permiso `flights:manage`). Los administradores no pueden fijar SOLD_OUT: lo decide el sistema. */
export const changeFlightStatusRequestSchema = z.object({ status: flightStatusSchema }).strict();
export type ChangeFlightStatusRequest = z.infer<typeof changeFlightStatusRequestSchema>;

export const changeFlightStatusResponseSchema = z.object({
  flight: z.object({ id: uuid, status: flightStatusSchema, previous: flightStatusSchema }),
});
