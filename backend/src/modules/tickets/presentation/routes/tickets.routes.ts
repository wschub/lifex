import { type RequestHandler, Router } from "express";
import {
  createTicketsController,
  type TicketsControllerDeps,
} from "../controllers/tickets.controller.ts";

export interface TicketsRouterDeps extends TicketsControllerDeps {
  /** Valida el token de invitado y que coincida con la reserva de la URL; deja el id en res.locals.bookingId. */
  authenticateBooking: RequestHandler;
}

export function createTicketsRouter(deps: TicketsRouterDeps): Router {
  const router = Router();
  const controller = createTicketsController(deps);
  // Imagen QR enlazada desde los correos: pública, pero solo existe para tickets reales.
  router.get("/tickets/:code/qr.png", controller.qr);
  router.get("/bookings/:id/tickets", deps.authenticateBooking, controller.list);
  return router;
}
