import type { OverviewRaw } from "../entities/dashboard-overview.ts";
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
  /** Una página de vuelos (todas las rutas, nacionales e internacionales), ordenados por salida. */
  listFlights(query: FlightListQuery): Promise<FlightListPage>;
}
