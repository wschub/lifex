import { type RequestHandler, Router } from "express";
import { FLIGHTS_PERMISSION } from "../../../flights/application/permissions.ts";
import { DASHBOARD_PERMISSION } from "../../application/permissions.ts";
import {
  createDashboardController,
  type DashboardControllerDeps,
} from "../controllers/dashboard.controller.ts";

export interface DashboardRouterDeps extends DashboardControllerDeps {
  authenticate: RequestHandler;
  authorize: (permission: string) => RequestHandler;
}

export function createDashboardRouter(deps: DashboardRouterDeps): Router {
  const router = Router();
  const controller = createDashboardController(deps);
  const read = [deps.authenticate, deps.authorize(DASHBOARD_PERMISSION.read)];
  // Registrar un check-in es una gestión del vuelo: exige el mismo permiso que cambiar su estado.
  const manage = [deps.authenticate, deps.authorize(FLIGHTS_PERMISSION.manage)];

  router.get("/dashboard/overview", read, controller.overview);
  router.get("/dashboard/flights", read, controller.list);
  router.get("/dashboard/flights/:id", read, controller.flight);
  router.get("/dashboard/flights/:id/passengers", read, controller.passengers);
  router.patch("/dashboard/flights/:id/passengers/:ticketId/check-in", manage, controller.checkIn);

  return router;
}
