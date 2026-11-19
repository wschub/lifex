export interface SeatCounts {
  free: number;
  blocked: number;
  paymentPending: number;
  reserved: number;
}

export interface FlightMetrics {
  flightId: string;
  status: string;
  from: string;
  to: string;
  departureDate: Date;
  arrivalDate: Date;
  numMaxSeats: number;
  numAvailableSeats: number;
  occupancyRate: number;
  /** Versión del último evento del vuelo, para encadenar los eventos WebSocket. */
  version: number;
  seats: SeatCounts;
  byClass: { economy: SeatCounts; business: SeatCounts };
}

export interface DashboardFlightRow {
  flightId: string;
  status: string;
  routeType: "DOMESTIC" | "INTERNATIONAL";
  /** Códigos IATA de origen y destino. */
  from: string;
  to: string;
  /** Ciudades en español, para mostrarlas en la tabla. */
  fromCity: string;
  toCity: string;
  departureDate: Date;
  numMaxSeats: number;
  numAvailableSeats: number;
  occupancyRate: number;
  /** Reservas confirmadas (pagadas) del vuelo: a ellas llegan los avisos de cancelación o retraso. */
  reservations: number;
}
