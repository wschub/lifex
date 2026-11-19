import { createHmac } from "node:crypto";
import type { RequestHandler } from "express";
import { AppError } from "../../../../shared/errors/app-error.ts";
import { parseBody } from "../../../../shared/http/validate.ts";
import type { RequestPayment } from "../../application/use-cases/request-payment.use-case.ts";
import { requestPaymentSchema } from "../schemas/payment.schemas.ts";

export interface PaymentsControllerDeps {
  requestPayment: RequestPayment;
  /** Secreto del servidor para la huella (HMAC) del cuerpo: el número de tarjeta nunca se hashea a pelo. */
  fingerprintSecret: string;
}

export function createPaymentsController(deps: PaymentsControllerDeps) {
  const request: RequestHandler = async (req, res) => {
    const key = req.get("idempotency-key")?.trim();
    if (!key) throw new AppError("validation", { code: "IDEMPOTENCY_KEY_REQUIRED" });

    const { card } = parseBody(requestPaymentSchema, req.body);
    const requestHash = createHmac("sha256", deps.fingerprintSecret)
      .update(
        JSON.stringify([
          card.number.replaceAll(/[\s-]/g, ""),
          card.holderName,
          card.expMonth,
          card.expYear,
          card.cvv,
        ]),
      )
      .digest("hex");

    const result = await deps.requestPayment.execute({
      orderId: String(res.locals.bookingId),
      idempotencyKey: key,
      requestHash,
      card,
    });
    // 202: el pago se procesa de forma asíncrona; el cliente espera el resultado por WebSocket.
    res.status(202).json({ payment: result.payment, booking: result.order });
  };

  return { request };
}
