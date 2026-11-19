import type { RequestHandler } from "express";
import { AppError } from "../../../../shared/errors/app-error.ts";
import { parseBody } from "../../../../shared/http/validate.ts";
import type { ChangeFlightStatus } from "../../application/use-cases/change-flight-status.use-case.ts";
import type { ListOfferFlights } from "../../application/use-cases/list-offer-flights.use-case.ts";
import type { GetFlight } from "../../application/use-cases/get-flight.use-case.ts";
import type { SearchFlights } from "../../application/use-cases/search-flights.use-case.ts";
import { changeFlightStatusSchema } from "../schemas/flight.schemas.ts";

export interface FlightsControllerDeps {
  searchFlights: SearchFlights;
  getFlight: GetFlight;
  listOfferFlights: ListOfferFlights;
  changeFlightStatus: ChangeFlightStatus;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function queryString(value: unknown, field: string): string {
  if (typeof value !== "string" || value === "") {
    throw new AppError("validation", { details: { issues: [{ field, code: "invalid_type" }] } });
  }
  return value;
}

export function flightIdParam(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new AppError("not_found", { code: "FLIGHT_NOT_FOUND" });
  }
  return value;
}

export function createFlightsController(deps: FlightsControllerDeps) {
  const search: RequestHandler = async (req, res) => {
    const flights = await deps.searchFlights.execute({
      from: queryString(req.query.from, "from"),
      to: queryString(req.query.to, "to"),
      date: queryString(req.query.date, "date"),
    });
    res.json({ flights });
  };

  const offers: RequestHandler = async (_req, res) => {
    res.json({ offers: await deps.listOfferFlights.execute() });
  };

  const detail: RequestHandler = async (req, res) => {
    res.json({ flight: await deps.getFlight.execute(flightIdParam(req.params.id)) });
  };

  const changeStatus: RequestHandler = async (req, res) => {
    const { status } = parseBody(changeFlightStatusSchema, req.body);
    res.json({
      flight: await deps.changeFlightStatus.execute(flightIdParam(req.params.id), status),
    });
  };

  return { search, offers, detail, changeStatus };
}
