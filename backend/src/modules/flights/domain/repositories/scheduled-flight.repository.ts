import type {
  FlightListing,
  FlightStatus,
  ScheduledFlight,
} from "../entities/scheduled-flight.entity.ts";

export interface FlightSearchQuery {
  fromIata: string;
  toIata: string;
  /** Inicio (incluido) y fin (excluido) del día buscado, ya como instantes UTC. */
  dayStart: Date;
  dayEnd: Date;
}

export interface ScheduledFlightRepository {
  /** Vuelos ACTIVE, DELAYED o SOLD_OUT de la ruta y el día, ordenados por salida. */
  search(query: FlightSearchQuery): Promise<FlightListing[]>;
  findListing(id: string): Promise<FlightListing | null>;
  findById(id: string): Promise<ScheduledFlight | null>;
  /**
   * Cambia el estado y escribe el evento FlightStatusChanged en la misma transacción.
   * Devuelve el estado anterior.
   */
  updateStatus(id: string, status: FlightStatus): Promise<{ previous: FlightStatus }>;
}
