import { AppError } from "../../../../shared/errors/app-error.ts";
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

const DAY_MS = 24 * 60 * 60 * 1000;

export class ListDashboardFlights {
  private readonly dashboard: DashboardRepository;
  private readonly now: () => Date;

  constructor(deps: { dashboard: DashboardRepository; now?: () => Date }) {
    this.dashboard = deps.dashboard;
    this.now = deps.now ?? (() => new Date());
  }

  /** Por defecto, los vuelos de las próximas 24 horas. */
  execute(options: { from?: Date; to?: Date; limit?: number } = {}): Promise<DashboardFlightRow[]> {
    const from = options.from ?? this.now();
    const to = options.to ?? new Date(from.getTime() + DAY_MS);
    return this.dashboard.listFlights({ from, to, limit: Math.min(options.limit ?? 100, 500) });
  }
}
