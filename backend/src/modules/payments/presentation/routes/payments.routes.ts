import { type RequestHandler, Router } from "express";
import { createRateLimiter } from "../../../../shared/http/rate-limit.ts";
import {
  createPaymentsController,
  type PaymentsControllerDeps,
} from "../controllers/payments.controller.ts";

export interface PaymentsRouterDeps extends PaymentsControllerDeps {
  authenticateBooking: RequestHandler;
}

export function createPaymentsRouter(deps: PaymentsRouterDeps): Router {
  const router = Router();
  const controller = createPaymentsController(deps);
  router.post(
    "/bookings/:id/payments",
    deps.authenticateBooking,
    createRateLimiter({ windowMs: 15 * 60_000, max: 30 }),
    controller.request,
  );
  return router;
}
