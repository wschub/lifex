import { type RequestHandler, Router } from "express";
import { FLIGHTS_PERMISSION } from "../../../flights/application/permissions.ts";
import {
  type BackofficeControllerDeps,
  createBackofficeController,
} from "../controllers/backoffice.controller.ts";

export interface BackofficeRouterDeps extends BackofficeControllerDeps {
  authenticate: RequestHandler;
  authorize: (permission: string) => RequestHandler;
}

/**
 * Flota, clientes y compras: solo para el administrador. Se exige `flights:manage`, que tiene `ADMIN`
 * (y el superadministrador) pero no `ADMIN_VIEWER`.
 */
export function createBackofficeRouter(deps: BackofficeRouterDeps): Router {
  const router = Router();
  const controller = createBackofficeController(deps);
  const admin = [deps.authenticate, deps.authorize(FLIGHTS_PERMISSION.manage)];

  router.get("/dashboard/aircraft", admin, controller.aircraft);
  router.get("/dashboard/customers", admin, controller.customers);
  router.get("/dashboard/purchases", admin, controller.purchases);

  return router;
}
