import {
  bookingResponseSchema,
  dashboardFlightsResponseSchema,
  flightDetailResponseSchema,
  flightMetricsResponseSchema,
  flightSearchResponseSchema,
  luggageTypesResponseSchema,
  meResponseSchema,
  orderTicketsSchema,
  seatMapSchema,
  type FlightSearchQuery,
} from "@lifex/shared";
import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "./http.ts";
import { keys } from "./keys.ts";

// Las consultas de configuración (`GET /config`) y de ciudades (`GET /catalog/cities`) se añaden cuando
// existan sus esquemas en `shared/` (las claves ya están en `keys.ts`).

export const flightsQuery = (params: FlightSearchQuery) =>
  queryOptions({
    queryKey: keys.flights(params),
    queryFn: () => apiFetch("/flights", flightSearchResponseSchema, { query: params }),
  });

export const flightQuery = (id: string) =>
  queryOptions({
    queryKey: keys.flight(id),
    queryFn: () => apiFetch(`/flights/${id}`, flightDetailResponseSchema),
  });

/** Snapshot del mapa; los eventos WS se aplican encima (ver `ws/useFlightSeats.ts`). */
export const seatMapQuery = (flightId: string) =>
  queryOptions({
    queryKey: keys.seatMap(flightId),
    queryFn: () => apiFetch(`/flights/${flightId}/seats`, seatMapSchema),
    // El socket mantiene el mapa al día; sin esto un refetch por foco pisaría eventos recién aplicados.
    staleTime: Infinity,
  });

export const luggageTypesQuery = () =>
  queryOptions({
    queryKey: keys.luggageTypes,
    queryFn: () => apiFetch("/catalog/luggage-types", luggageTypesResponseSchema),
    staleTime: 60 * 60_000,
  });

export const bookingQuery = (id: string, token: string) =>
  queryOptions({
    queryKey: keys.booking(id),
    queryFn: () => apiFetch(`/bookings/${id}`, bookingResponseSchema, { bookingToken: token }),
  });

export const ticketsQuery = (bookingId: string, token: string) =>
  queryOptions({
    queryKey: keys.tickets(bookingId),
    queryFn: () =>
      apiFetch(`/bookings/${bookingId}/tickets`, orderTicketsSchema, { bookingToken: token }),
  });

export const dashboardFlightsQuery = (date: string, staffToken: string) =>
  queryOptions({
    queryKey: keys.dashboardFlights(date),
    queryFn: () =>
      apiFetch("/dashboard/flights", dashboardFlightsResponseSchema, {
        staffToken,
        query: { date },
      }),
  });

export const dashboardFlightQuery = (id: string, staffToken: string) =>
  queryOptions({
    queryKey: keys.dashboardFlight(id),
    queryFn: () =>
      apiFetch(`/dashboard/flights/${id}`, flightMetricsResponseSchema, { staffToken }),
  });

export const meQuery = (staffToken: string) =>
  queryOptions({
    queryKey: keys.me,
    queryFn: () => apiFetch("/auth/me", meResponseSchema, { staffToken }),
  });
