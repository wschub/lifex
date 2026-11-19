import type { RequestHandler } from "express";
import { AppError } from "../../../../shared/errors/app-error.ts";
import type {
  GetDashboardOverview,
  GetFlightDashboard,
  ListDashboardFlights,
} from "../../application/use-cases/dashboard.use-cases.ts";

export interface DashboardControllerDeps {
  getFlightDashboard: GetFlightDashboard;
  listDashboardFlights: ListDashboardFlights;
  getDashboardOverview: GetDashboardOverview;
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

/** Código IATA opcional (3 letras): se normaliza a mayúsculas. */
function airportCode(value: unknown): string | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string" || !/^[A-Za-z]{3}$/.test(value)) {
    throw new AppError("validation", { code: "INVALID_AIRPORT" });
  }
  return value.toUpperCase();
}

function positiveInt(value: unknown, code: string): number | undefined {
  if (value === undefined || value === "") return undefined;
  const number = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(number) || number < 1) throw new AppError("validation", { code });
  return number;
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
    res.json(
      await deps.listDashboardFlights.execute({
        ...(range ?? {}),
        origin: airportCode(req.query.from),
        destination: airportCode(req.query.to),
        page: positiveInt(req.query.page, "INVALID_PAGE"),
        pageSize: positiveInt(req.query.pageSize, "INVALID_PAGE"),
      }),
    );
  };

  /** `date` (AAAA-MM-DD) opcional: se valida con dayRange y se pasa tal cual. */
  const overview: RequestHandler = async (req, res) => {
    dayRange(req.query.date);
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    res.json({ overview: await deps.getDashboardOverview.execute(date) });
  };

  return { flight, list, overview };
}
