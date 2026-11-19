import type { OutboxContext } from "../../../realtime/application/use-cases/process-outbox.use-case.ts";
import type { IssueTickets } from "../../../tickets/application/use-cases/issue-tickets.use-case.ts";
import type { PaymentRepository } from "../../domain/repositories/payment.repository.ts";
import type { PaymentGatewayPort } from "../ports/payment-gateway.ts";

export interface PaymentRequestedPayload {
  paymentId: string;
  gatewayToken: string;
}

/**
 * Manejador del evento PaymentRequested (lo invoca el worker del outbox). Cobra en la pasarela y
 * ejecuta la transacción 2. Es idempotente: si el pago ya no está PENDING, no hace nada.
 */
export class ProcessPaymentRequest {
  private readonly deps: {
    payments: PaymentRepository;
    gateway: PaymentGatewayPort;
    issueTickets: IssueTickets;
  };

  constructor(deps: {
    payments: PaymentRepository;
    gateway: PaymentGatewayPort;
    issueTickets: IssueTickets;
  }) {
    this.deps = deps;
  }

  async execute(payload: PaymentRequestedPayload, context: OutboxContext): Promise<void> {
    const settlement = await this.deps.payments.loadSettlement(payload.paymentId);
    if (!settlement || settlement.status !== "PENDING") return;

    try {
      const result = await this.deps.gateway.charge({
        token: payload.gatewayToken,
        amountUsd: settlement.amountUsd,
        // El id del pago es la clave de idempotencia hacia la pasarela: reintentar nunca cobra dos veces.
        idempotencyKey: settlement.paymentId,
      });
      if (result.status === "REJECTED") {
        await this.deps.payments.settleRejected({
          paymentId: settlement.paymentId,
          reason: result.reason ?? "declined",
        });
        return;
      }
      await this.deps.payments.settleApproved({
        paymentId: settlement.paymentId,
        gatewayReference: result.reference,
        tickets: this.deps.issueTickets.execute(settlement.passengers),
      });
    } catch (error) {
      if (!context.isLastAttempt) throw error;
      // Sin más reintentos: el cliente no puede quedarse con los asientos en PAYMENT_PENDING para siempre.
      await this.deps.payments.settleRejected({
        paymentId: settlement.paymentId,
        reason: error instanceof Error ? error.name : "gateway_error",
      });
    }
  }
}
