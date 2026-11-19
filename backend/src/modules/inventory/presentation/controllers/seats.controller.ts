import type { RequestHandler } from "express";
import { AppError } from "../../../../shared/errors/app-error.ts";
import { guestSessionOf } from "../../../../shared/http/guest-session.ts";
import type { GetSeatMap } from "../../application/use-cases/get-seat-map.use-case.ts";
import type { HoldSeat } from "../../application/use-cases/hold-seat.use-case.ts";
import type { ReleaseSeat } from "../../application/use-cases/release-seat.use-case.ts";

export interface SeatsControllerDeps {
  holdSeat: HoldSeat;
  releaseSeat: ReleaseSeat;
  getSeatMap: GetSeatMap;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidParam(value: unknown, code: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new AppError("not_found", { code });
  return value;
}

export function createSeatsController(deps: SeatsControllerDeps) {
  const map: RequestHandler = async (req, res) => {
    res.json(await deps.getSeatMap.execute(uuidParam(req.params.flightId, "FLIGHT_NOT_FOUND")));
  };

  const hold: RequestHandler = async (req, res) => {
    const result = await deps.holdSeat.execute({
      flightId: uuidParam(req.params.flightId, "FLIGHT_NOT_FOUND"),
      seatId: uuidParam(req.params.seatId, "SEAT_NOT_FOUND"),
      sessionId: guestSessionOf(res),
    });
    res.json(result);
  };

  const release: RequestHandler = async (req, res) => {
    await deps.releaseSeat.execute({
      flightId: uuidParam(req.params.flightId, "FLIGHT_NOT_FOUND"),
      seatId: uuidParam(req.params.seatId, "SEAT_NOT_FOUND"),
      sessionId: guestSessionOf(res),
    });
    res.status(204).end();
  };

  return { map, hold, release };
}
