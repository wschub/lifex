/** Datos sin procesar de los vuelos de un día; el caso de uso los resume en indicadores y series. */
export interface OverviewRaw {
  flights: {
    status: string;
    routeType: "DOMESTIC" | "INTERNATIONAL";
    departureDate: Date;
    numMaxSeats: number;
    numAvailableSeats: number;
  }[];
  /** Asientos de esos vuelos por clase y estado. */
  classSeats: { seatClass: "ECONOMY" | "BUSINESS"; status: string; count: number }[];
  /** Tickets emitidos y dinero cobrado (USD) de las reservas CONFIRMED de esos vuelos. */
  sales: { tickets: number; revenueUsd: number };
}

export interface OccupancyFigures {
  total: number;
  sold: number;
  /** Porcentaje 0–100 con un decimal. */
  occupancyRate: number;
}

export interface DashboardOverview {
  /** Día (AAAA-MM-DD, hora de Colombia). */
  date: string;
  flights: {
    total: number;
    domestic: number;
    international: number;
    byStatus: Record<string, number>;
  };
  seats: OccupancyFigures & {
    available: number;
    byClass: { economy: OccupancyFigures; business: OccupancyFigures };
    byRouteType: { domestic: OccupancyFigures; international: OccupancyFigures };
  };
  /** Vuelos que salen en cada hora local (0–23), separados por tipo de ruta. */
  byHour: { hour: number; domestic: number; international: number }[];
  sales: { ticketsSold: number; revenueUsd: number };
  /** Vuelos cancelados o retrasados del día. */
  disruptions: number;
}
