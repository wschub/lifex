import { type RequestHandler, Router } from "express";
import {
  createSeatsController,
  type SeatsControllerDeps,
} from "../controllers/seats.controller.ts";

export interface SeatsRouterDeps extends SeatsControllerDeps {
  /** Valida el token de sesión de invitado (lo construye composition.ts). */
  authenticateGuest: RequestHandler;
}

export function createSeatsRouter(deps: SeatsRouterDeps): Router {
  const router = Router();
  const controller = createSeatsController(deps);

  router.get("/flights/:flightId/seats", controller.map);
  router.post("/flights/:flightId/seats/:seatId/hold", deps.authenticateGuest, controller.hold);
  router.delete(
    "/flights/:flightId/seats/:seatId/hold",
    deps.authenticateGuest,
    controller.release,
  );

  return router;
}
