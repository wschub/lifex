import { AppError } from "../../../../shared/errors/app-error.ts";
import type { DashboardPassenger } from "../../domain/entities/dashboard-passenger.ts";
import type {
  DashboardOverview,
  OccupancyFigures,
  OverviewRaw,
} from "../../domain/entities/dashboard-overview.ts";
import type { DashboardFlightRow, FlightMetrics } from "../../domain/entities/flight-metrics.ts";
import type { DashboardRepository } from "../../domain/repositories/dashboard.repository.ts";

export class GetFlightDashboard {
  private readonly dashboard: DashboardRepository;

  constructor(deps: { dashboard: DashboardRepository }) {
    this.dashboard = deps.dashboard;
  }

  async execute(flightId: string): Promise<FlightMetrics> {
    const metrics = await this.dashboard.flightMetrics(flightId);
    if (!metrics) throw new AppError("not_found", { code: "FLIGHT_NOT_FOUND" });
    return metrics;
  }
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface ListFlightsOptions {
  from?: Date;
  to?: Date;
  origin?: string;
  destination?: string;
  page?: number;
  pageSize?: number;
}

export interface ListFlightsResult {
  flights: DashboardFlightRow[];
  page: number;
  pageSize: number;
  total: number;
}

export class ListDashboardFlights {
  private readonly dashboard: DashboardRepository;
  private readonly now: () => Date;

  constructor(deps: { dashboard: DashboardRepository; now?: () => Date }) {
    this.dashboard = deps.dashboard;
    this.now = deps.now ?? (() => new Date());
  }

  /** Sin rango de fechas: los vuelos que aún no salieron (desde ahora). Con filtros opcionales por ruta. */
  async execute(options: ListFlightsOptions = {}): Promise<ListFlightsResult> {
    const page = Math.max(1, Math.floor(options.page ?? 1));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Math.floor(options.pageSize ?? DEFAULT_PAGE_SIZE)),
    );
    const hasRange = options.from !== undefined || options.to !== undefined;
    const { rows, total } = await this.dashboard.listFlights({
      ...(hasRange ? { from: options.from, to: options.to } : { from: this.now() }),
      ...(options.origin ? { origin: options.origin } : {}),
      ...(options.destination ? { destination: options.destination } : {}),
      page,
      pageSize,
    });
    return { flights: rows, page, pageSize, total };
  }
}

const COLOMBIA_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const rounded = (value: number): number => Math.round(value * 10) / 10;
const figures = (total: number, sold: number): OccupancyFigures => ({
  total,
  sold,
  occupancyRate: total > 0 ? rounded((sold / total) * 100) : 0,
});

/** Resume los datos del día en los indicadores y series del panel (función pura). */
export function summarizeOverview(date: string, raw: OverviewRaw): DashboardOverview {
  const byStatus: Record<string, number> = {};
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, domestic: 0, international: 0 }));
  const typeTotals = {
    domestic: { total: 0, sold: 0 },
    international: { total: 0, sold: 0 },
  };
  let domestic = 0;
  let international = 0;
  for (const flight of raw.flights) {
    byStatus[flight.status] = (byStatus[flight.status] ?? 0) + 1;
    const key = flight.routeType === "DOMESTIC" ? "domestic" : "international";
    if (key === "domestic") domestic += 1;
    else international += 1;
    typeTotals[key].total += flight.numMaxSeats;
    typeTotals[key].sold += flight.numMaxSeats - flight.numAvailableSeats;
    const hour = new Date(flight.departureDate.getTime() - COLOMBIA_OFFSET_MS).getUTCHours();
    (byHour[hour] as { domestic: number; international: number })[key] += 1;
  }
  const classTotals = { ECONOMY: { total: 0, sold: 0 }, BUSINESS: { total: 0, sold: 0 } };
  for (const seat of raw.classSeats) {
    classTotals[seat.seatClass].total += seat.count;
    if (seat.status === "RESERVED") classTotals[seat.seatClass].sold += seat.count;
  }
  const total = typeTotals.domestic.total + typeTotals.international.total;
  const sold = typeTotals.domestic.sold + typeTotals.international.sold;
  return {
    date,
    flights: { total: raw.flights.length, domestic, international, byStatus },
    seats: {
      ...figures(total, sold),
      available: total - sold,
      byClass: {
        economy: figures(classTotals.ECONOMY.total, classTotals.ECONOMY.sold),
        business: figures(classTotals.BUSINESS.total, classTotals.BUSINESS.sold),
      },
      byRouteType: {
        domestic: figures(typeTotals.domestic.total, typeTotals.domestic.sold),
        international: figures(typeTotals.international.total, typeTotals.international.sold),
      },
    },
    byHour,
    sales: { ticketsSold: raw.sales.tickets, revenueUsd: raw.sales.revenueUsd },
    disruptions: (byStatus.CANCELLED ?? 0) + (byStatus.DELAYED ?? 0),
  };
}

export class GetDashboardOverview {
  private readonly dashboard: DashboardRepository;
  private readonly now: () => Date;

  constructor(deps: { dashboard: DashboardRepository; now?: () => Date }) {
    this.dashboard = deps.dashboard;
    this.now = deps.now ?? (() => new Date());
  }

  /** `date` (AAAA-MM-DD, hora de Colombia); por defecto, hoy. */
  async execute(date?: string): Promise<DashboardOverview> {
    const day =
      date ?? new Date(this.now().getTime() - COLOMBIA_OFFSET_MS).toISOString().slice(0, 10);
    const from = new Date(`${day}T00:00:00-05:00`);
    const raw = await this.dashboard.overview({ from, to: new Date(from.getTime() + DAY_MS) });
    return summarizeOverview(day, raw);
  }
}

export class ListFlightPassengers {
  private readonly dashboard: DashboardRepository;

  constructor(deps: { dashboard: DashboardRepository }) {
    this.dashboard = deps.dashboard;
  }

  async execute(flightId: string): Promise<DashboardPassenger[]> {
    const passengers = await this.dashboard.flightPassengers(flightId);
    if (!passengers) throw new AppError("not_found", { code: "FLIGHT_NOT_FOUND" });
    return passengers;
  }
}

export class SetPassengerCheckIn {
  private readonly dashboard: DashboardRepository;
  private readonly now: () => Date;

  constructor(deps: { dashboard: DashboardRepository; now?: () => Date }) {
    this.dashboard = deps.dashboard;
    this.now = deps.now ?? (() => new Date());
  }

  async execute(
    flightId: string,
    ticketId: string,
    checkedIn: boolean,
  ): Promise<DashboardPassenger> {
    const passenger = await this.dashboard.setCheckIn(flightId, ticketId, checkedIn, this.now());
    if (!passenger) throw new AppError("not_found", { code: "TICKET_NOT_FOUND" });
    return passenger;
  }
}
