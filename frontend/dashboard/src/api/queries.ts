import {
  aircraftResponseSchema,
  bookingResponseSchema,
  citiesResponseSchema,
  customersResponseSchema,
  dashboardFlightsResponseSchema,
  dashboardOverviewResponseSchema,
  dashboardPassengersResponseSchema,
  flightDetailResponseSchema,
  flightMetricsResponseSchema,
  flightSearchResponseSchema,
  luggageTypesResponseSchema,
  meResponseSchema,
  purchasesResponseSchema,
  orderTicketsSchema,
  seatMapSchema,
  type FlightSearchQuery,
} from "@lifex/shared";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
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

/** Filtros y página de la lista de vuelos (todos opcionales salvo la página). */
export interface DashboardFlightsParams {
  date?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

/** Una página de vuelos (nacionales e internacionales) con filtros por fecha, origen y destino. */
export const dashboardFlightsQuery = (params: DashboardFlightsParams, staffToken: string) =>
  queryOptions({
    queryKey: keys.dashboardFlights(params),
    queryFn: () =>
      apiFetch("/dashboard/flights", dashboardFlightsResponseSchema, {
        staffToken,
        query: { ...params },
      }),
    // Al cambiar de página se sigue mostrando la anterior hasta que llega la nueva (sin parpadeo).
    placeholderData: keepPreviousData,
  });

/** Indicadores y series de los vuelos que salen en un día (AAAA-MM-DD, hora de Colombia). */
export const dashboardOverviewQuery = (date: string, staffToken: string) =>
  queryOptions({
    queryKey: keys.dashboardOverview(date),
    queryFn: () =>
      apiFetch("/dashboard/overview", dashboardOverviewResponseSchema, {
        staffToken,
        query: { date },
      }),
    refetchInterval: 60_000,
  });

export const citiesQuery = () =>
  queryOptions({
    queryKey: keys.cities,
    queryFn: () => apiFetch("/catalog/cities", citiesResponseSchema),
    staleTime: 60 * 60_000,
  });

export const dashboardFlightQuery = (id: string, staffToken: string) =>
  queryOptions({
    queryKey: keys.dashboardFlight(id),
    queryFn: () =>
      apiFetch(`/dashboard/flights/${id}`, flightMetricsResponseSchema, { staffToken }),
  });

/** Pasajeros con ticket (reservas pagadas) de un vuelo, con su contacto y el estado del check-in. */
export const dashboardPassengersQuery = (flightId: string, staffToken: string) =>
  queryOptions({
    queryKey: keys.dashboardPassengers(flightId),
    queryFn: () =>
      apiFetch(`/dashboard/flights/${flightId}/passengers`, dashboardPassengersResponseSchema, {
        staffToken,
      }),
    // Llegan compras nuevas mientras la ventana está abierta.
    refetchInterval: 30_000,
  });

/** La flota (solo administrador). */
export const aircraftQuery = (staffToken: string) =>
  queryOptions({
    queryKey: keys.aircraft,
    queryFn: () => apiFetch("/dashboard/aircraft", aircraftResponseSchema, { staffToken }),
  });

export interface CustomersParams {
  search?: string;
  page: number;
  pageSize: number;
}

/** Clientes (quienes compraron, por correo) con paginación y búsqueda (solo administrador). */
export const customersQuery = (params: CustomersParams, staffToken: string) =>
  queryOptions({
    queryKey: keys.customers(params),
    queryFn: () =>
      apiFetch("/dashboard/customers", customersResponseSchema, {
        staffToken,
        query: { ...params },
      }),
    placeholderData: keepPreviousData,
  });

export interface PurchasesParams {
  search?: string;
  /** `ALL` = todas menos los borradores; sin estado, las confirmadas. */
  status?: string;
  email?: string;
  dateFrom?: string;
  dateTo?: string;
  origin?: string;
  destination?: string;
  page: number;
  pageSize: number;
}

/** Compras con paginación y filtros (solo administrador). */
export const purchasesQuery = (params: PurchasesParams, staffToken: string) =>
  queryOptions({
    queryKey: keys.purchases(params),
    queryFn: () =>
      apiFetch("/dashboard/purchases", purchasesResponseSchema, {
        staffToken,
        query: { ...params },
      }),
    placeholderData: keepPreviousData,
  });

export const meQuery = (staffToken: string) =>
  queryOptions({
    queryKey: keys.me,
    queryFn: () => apiFetch("/auth/me", meResponseSchema, { staffToken }),
  });
