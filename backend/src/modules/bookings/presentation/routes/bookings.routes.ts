import { type RequestHandler, Router } from "express";
import { createRateLimiter } from "../../../../shared/http/rate-limit.ts";
import {
  type BookingsControllerDeps,
  createBookingsController,
} from "../controllers/bookings.controller.ts";

export interface BookingsRouterDeps extends BookingsControllerDeps {
  /** Valida el token de invitado y que su `sub` sea la reserva de la URL. */
  authenticateBooking: RequestHandler;
}

export function createBookingsRouter(deps: BookingsRouterDeps): Router {
  const router = Router();
  const controller = createBookingsController(deps);

  // Crear una reserva es público: un límite por IP evita llenar la base de órdenes vacías.
  router.post("/bookings", createRateLimiter({ windowMs: 15 * 60_000, max: 60 }), controller.start);
  router.get("/bookings/:id", deps.authenticateBooking, controller.get);
  router.put("/bookings/:id/passengers", deps.authenticateBooking, controller.passengers);

  return router;
}
