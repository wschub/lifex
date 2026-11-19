import type { OverviewRaw } from "../entities/dashboard-overview.ts";
import type { DashboardPassenger } from "../entities/dashboard-passenger.ts";
import type { DashboardFlightRow, FlightMetrics } from "../entities/flight-metrics.ts";

/** Filtros y página de la lista de vuelos del panel. */
export interface FlightListQuery {
  /** Salida desde (incluida) y hasta (excluida). */
  from?: Date;
  to?: Date;
  /** Código IATA del aeropuerto de origen / de destino. */
  origin?: string;
  destination?: string;
  page: number;
  pageSize: number;
}

export interface FlightListPage {
  rows: DashboardFlightRow[];
  /** Total de vuelos que cumplen los filtros (todas las páginas). */
  total: number;
}

export interface DashboardRepository {
  /** Cuenta los asientos tal como están en la base en este instante. */
  flightMetrics(flightId: string): Promise<FlightMetrics | null>;
  /** Vuelos, asientos y ventas de los vuelos que salen entre `from` (incluida) y `to` (excluida). */
  overview(range: { from: Date; to: Date }): Promise<OverviewRaw>;
  /** Pasajeros con ticket de las reservas confirmadas del vuelo; `null` si el vuelo no existe. */
  flightPassengers(flightId: string): Promise<DashboardPassenger[] | null>;
  /** Registra o quita el check-in de un ticket del vuelo; `null` si ese ticket no es de ese vuelo. */
  setCheckIn(
    flightId: string,
    ticketId: string,
    checkedIn: boolean,
    at: Date,
  ): Promise<DashboardPassenger | null>;
  /** Una página de vuelos (todas las rutas, nacionales e internacionales), ordenados por salida. */
  listFlights(query: FlightListQuery): Promise<FlightListPage>;
}
