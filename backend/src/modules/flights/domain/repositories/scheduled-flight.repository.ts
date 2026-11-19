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
  /**
   * Vuelos ACTIVE que salen entre `from` y `to` (ambos incluidos): candidatos a oferta. Pueden ser miles,
   * así que `availableByClass` viene en cero; se completa con `withAvailability` solo para los elegidos.
   */
  findOfferCandidates(from: Date, to: Date): Promise<FlightListing[]>;
  /** Devuelve los mismos vuelos con los asientos libres por clase contados. */
  withAvailability(listings: FlightListing[]): Promise<FlightListing[]>;
  findById(id: string): Promise<ScheduledFlight | null>;
  /**
   * Cambia el estado y escribe el evento FlightStatusChanged en la misma transacción.
   * Devuelve el estado anterior.
   */
  updateStatus(id: string, status: FlightStatus): Promise<{ previous: FlightStatus }>;
}
