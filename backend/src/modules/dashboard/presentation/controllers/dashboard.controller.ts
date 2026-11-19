import type { RequestHandler } from "express";
import { AppError } from "../../../../shared/errors/app-error.ts";
import type {
  GetFlightDashboard,
  ListDashboardFlights,
} from "../../application/use-cases/dashboard.use-cases.ts";

export interface DashboardControllerDeps {
  getFlightDashboard: GetFlightDashboard;
  listDashboardFlights: ListDashboardFlights;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function dayRange(date: unknown): { from: Date; to: Date } | undefined {
  if (date === undefined) return undefined;
  const from =
    typeof date === "string" && DATE.test(date) ? new Date(`${date}T00:00:00-05:00`) : null;
  if (!from || Number.isNaN(from.getTime())) {
    throw new AppError("validation", { code: "INVALID_SEARCH_DATE" });
  }
  return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
}

export function createDashboardController(deps: DashboardControllerDeps) {
  const flight: RequestHandler = async (req, res) => {
    const id = req.params.id;
    if (typeof id !== "string" || !UUID.test(id)) {
      throw new AppError("not_found", { code: "FLIGHT_NOT_FOUND" });
    }
    res.json({ metrics: await deps.getFlightDashboard.execute(id) });
  };

  const list: RequestHandler = async (req, res) => {
    const range = dayRange(req.query.date);
    res.json({ flights: await deps.listDashboardFlights.execute(range ?? {}) });
  };

  return { flight, list };
}
