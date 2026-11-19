import { randomUUID } from "node:crypto";
import { AppError } from "../../../../shared/errors/app-error.ts";
import { passesLuhn, summarizeCard } from "../../domain/entities/payment.entity.ts";
import {
  type CardInput,
  type ChargeResult,
  GatewayTimeoutError,
  type PaymentGatewayPort,
  type TokenizedCard,
} from "../../application/ports/payment-gateway.ts";

/**
 * Pasarela simulada. Tarjetas de prueba (todas pasan Luhn):
 *   4242 4242 4242 4242  → aprobada      (cualquier otra tarjeta válida también se aprueba)
 *   4000 0000 0000 0002  → rechazada
 *   4000 0000 0000 9995  → timeout (la pasarela no responde; el cobro se reintenta y, agotados los reintentos, se rechaza)
 */
const DECLINED_CARD = "4000000000000002";
const TIMEOUT_CARD = "4000000000009995";

type Outcome = "approved" | "declined" | "timeout";

function invalidCard(field: string): AppError {
  return new AppError("validation", { code: "INVALID_CARD", details: { field } });
}

export class FakePaymentGateway implements PaymentGatewayPort {
  /** Resultados ya entregados por clave de idempotencia: repetir un cobro no vuelve a cobrar. */
  private readonly charges = new Map<string, ChargeResult>();

  async tokenize(card: CardInput, now: Date): Promise<TokenizedCard> {
    const digits = card.number.replaceAll(/[\s-]/g, "");
    if (!/^\d{13,19}$/.test(digits) || !passesLuhn(digits)) throw invalidCard("number");
    if (card.holderName.trim().length < 2) throw invalidCard("holderName");
    if (!Number.isInteger(card.expMonth) || card.expMonth < 1 || card.expMonth > 12) {
      throw invalidCard("expMonth");
    }
    const year = card.expYear < 100 ? 2000 + card.expYear : card.expYear;
    const expired =
      year < now.getUTCFullYear() ||
      (year === now.getUTCFullYear() && card.expMonth < now.getUTCMonth() + 1);
    if (expired) throw invalidCard("expYear");
    if (!/^\d{3,4}$/.test(card.cvv)) throw invalidCard("cvv");

    const outcome: Outcome =
      digits === DECLINED_CARD ? "declined" : digits === TIMEOUT_CARD ? "timeout" : "approved";
    const { brand, last4 } = summarizeCard(digits);
    return { token: `tok_${outcome}_${randomUUID()}`, brand, last4 };
  }

  async charge(input: {
    token: string;
    amountUsd: number;
    idempotencyKey: string;
  }): Promise<ChargeResult> {
    const previous = this.charges.get(input.idempotencyKey);
    if (previous) return previous;

    const outcome = /^tok_(approved|declined|timeout)_/.exec(input.token)?.[1];
    if (outcome === "timeout") throw new GatewayTimeoutError();

    const result: ChargeResult =
      outcome === "approved"
        ? { status: "APPROVED", reference: `fake_${randomUUID()}` }
        : { status: "REJECTED", reference: `fake_${randomUUID()}`, reason: "card_declined" };
    this.charges.set(input.idempotencyKey, result);
    return result;
  }
}
