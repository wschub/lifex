import type { CardSummary } from "../../domain/entities/payment.entity.ts";

export interface CardInput {
  number: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  cvv: string;
}

/** La tarjeta ya validada y convertida en un token: es lo único que viaja después, nunca el número. */
export interface TokenizedCard extends CardSummary {
  token: string;
}

export interface ChargeResult {
  status: "APPROVED" | "REJECTED";
  reference: string;
  reason?: string;
}

/** El gateway no respondió a tiempo: el cobro se reintenta con la misma clave de idempotencia. */
export class GatewayTimeoutError extends Error {
  constructor(message = "payment gateway timeout") {
    super(message);
    this.name = "GatewayTimeoutError";
  }
}

/** Puerto de la pasarela de pago: hoy un adaptador simulado, mañana una pasarela real. */
export interface PaymentGatewayPort {
  /** Valida la tarjeta (lanza AppError validation INVALID_CARD) y devuelve el token. */
  tokenize(card: CardInput, now: Date): Promise<TokenizedCard>;
  /** Idempotente por `idempotencyKey`: repetir la llamada devuelve el mismo resultado sin cobrar dos veces. */
  charge(input: {
    token: string;
    amountUsd: number;
    idempotencyKey: string;
  }): Promise<ChargeResult>;
}
