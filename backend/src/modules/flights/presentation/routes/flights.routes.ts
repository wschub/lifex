import { type RequestHandler, Router } from "express";
import { FLIGHTS_PERMISSION } from "../../application/permissions.ts";
import {
  createFlightsController,
  type FlightsControllerDeps,
} from "../controllers/flights.controller.ts";

export interface FlightsRouterDeps extends FlightsControllerDeps {
  authenticate: RequestHandler;
  authorize: (permission: string) => RequestHandler;
}

export function createFlightsRouter(deps: FlightsRouterDeps): Router {
  const router = Router();
  const controller = createFlightsController(deps);

  router.get("/flights", controller.search);
  // `/flights/offers` va antes de `/flights/:id`, que lo trataría como un id.
  router.get("/flights/offers", controller.offers);
  router.get("/flights/:id", controller.detail);
  router.patch(
    "/flights/:id/status",
    deps.authenticate,
    deps.authorize(FLIGHTS_PERMISSION.manage),
    controller.changeStatus,
  );

  return router;
}
