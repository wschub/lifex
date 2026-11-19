import type { FlightSearchQuery } from "@lifex/shared";

/** Claves de TanStack Query. Una por recurso; las de eventos WS escriben sobre `seatMap`. */
export const keys = {
  flights: (params: FlightSearchQuery) => ["flights", params] as const,
  offers: ["offers"] as const,
  flight: (id: string) => ["flight", id] as const,
  seatMap: (flightId: string) => ["seatMap", flightId] as const,
  booking: (id: string) => ["booking", id] as const,
  tickets: (bookingId: string) => ["tickets", bookingId] as const,
  config: ["config"] as const,
  cities: ["cities"] as const,
  luggageTypes: ["luggageTypes"] as const,
  dashboardFlights: (date: string) => ["dashboardFlights", date] as const,
  dashboardFlight: (id: string) => ["dashboardFlight", id] as const,
  me: ["me"] as const,
};
