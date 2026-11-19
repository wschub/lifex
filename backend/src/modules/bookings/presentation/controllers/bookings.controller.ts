import type { RequestHandler } from "express";
import { negotiateLocale } from "../../../../shared/i18n/locale.ts";
import { parseBody } from "../../../../shared/http/validate.ts";
import type { GetBooking } from "../../application/use-cases/get-booking.use-case.ts";
import type { SetPassengers } from "../../application/use-cases/set-passengers.use-case.ts";
import type { StartBooking } from "../../application/use-cases/start-booking.use-case.ts";
import { setPassengersSchema, startBookingSchema } from "../schemas/booking.schemas.ts";

export interface BookingsControllerDeps {
  startBooking: StartBooking;
  setPassengers: SetPassengers;
  getBooking: GetBooking;
}

export function createBookingsController(deps: BookingsControllerDeps) {
  const start: RequestHandler = async (req, res) => {
    const body = parseBody(startBookingSchema, req.body);
    const result = await deps.startBooking.execute({
      flightId: body.flightId,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      locale: negotiateLocale(req.get("accept-language")),
    });
    res.status(201).json(result);
  };

  const get: RequestHandler = async (_req, res) => {
    res.json({ booking: await deps.getBooking.execute(String(res.locals.bookingId)) });
  };

  const passengers: RequestHandler = async (req, res) => {
    const body = parseBody(setPassengersSchema, req.body);
    const booking = await deps.setPassengers.execute(
      String(res.locals.bookingId),
      body.passengers.map((passenger) => ({ ...passenger })),
    );
    res.json({ booking });
  };

  return { start, get, passengers };
}
