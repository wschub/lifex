import { type RequestHandler, Router } from "express";
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

  router.get("/dashboard/flights", read, controller.list);
  router.get("/dashboard/flights/:id", read, controller.flight);

  return router;
}
