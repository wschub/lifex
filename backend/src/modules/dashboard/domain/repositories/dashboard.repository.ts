import type { DashboardFlightRow, FlightMetrics } from "../entities/flight-metrics.ts";

export interface DashboardRepository {
  /** Cuenta los asientos tal como están en la base en este instante. */
  flightMetrics(flightId: string): Promise<FlightMetrics | null>;
  /** Vuelos con salida entre `from` y `to`, para elegir cuál monitorear. */
  listFlights(query: { from: Date; to: Date; limit: number }): Promise<DashboardFlightRow[]>;
}
