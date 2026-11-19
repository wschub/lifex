import { AppError } from "../../../../shared/errors/app-error.ts";
import type { PaymentRepository } from "../../domain/repositories/payment.repository.ts";
import type { CardInput, PaymentGatewayPort } from "../ports/payment-gateway.ts";

export interface RequestPaymentInput {
  orderId: string;
  idempotencyKey: string;
  /** Huella (HMAC) del cuerpo original de la petición. */
  requestHash: string;
  card: CardInput;
}

export interface RequestPaymentResult {
  payment: { id: string; status: string };
  order: { id: string; status: string };
  replayed: boolean;
}

const KEY = /^[A-Za-z0-9._:-]{8,128}$/;

/** El cliente pide pagar: se valida la tarjeta, se reservan los asientos y se encola el cobro. */
export class RequestPayment {
  private readonly deps: {
    payments: PaymentRepository;
    gateway: PaymentGatewayPort;
    now?: () => Date;
  };
  private readonly now: () => Date;

  constructor(deps: {
    payments: PaymentRepository;
    gateway: PaymentGatewayPort;
    now?: () => Date;
  }) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  async execute(input: RequestPaymentInput): Promise<RequestPaymentResult> {
    if (!KEY.test(input.idempotencyKey)) {
      throw new AppError("validation", { code: "IDEMPOTENCY_KEY_REQUIRED" });
    }
    const now = this.now();
    const tokenized = await this.deps.gateway.tokenize(input.card, now);
    const result = await this.deps.payments.beginPayment({
      orderId: input.orderId,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      card: { brand: tokenized.brand, last4: tokenized.last4 },
      gatewayToken: tokenized.token,
      now,
    });
    return { payment: result.payment, order: result.order, replayed: result.replayed };
  }
}
