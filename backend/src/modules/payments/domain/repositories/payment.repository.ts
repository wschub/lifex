import type {
  LuggageOption,
  NewTicket,
  TicketSeatClass,
} from "../../../tickets/domain/entities/ticket.entity.ts";
import type { CardSummary, PaymentSnapshot } from "../entities/payment.entity.ts";

export interface BeginPaymentInput {
  orderId: string;
  idempotencyKey: string;
  /** Huella del cuerpo de la petición, para detectar la misma clave con otro cuerpo. */
  requestHash: string;
  card: CardSummary;
  gatewayToken: string;
  now: Date;
}

export interface BeginPaymentResult {
  /** true si la clave ya se había usado con el mismo cuerpo: no se creó nada nuevo. */
  replayed: boolean;
  payment: PaymentSnapshot;
  order: { id: string; status: string };
}

export interface PaymentSettlement {
  paymentId: string;
  status: PaymentSnapshot["status"];
  orderId: string;
  flightId: string;
  amountUsd: number;
  passengers: {
    passengerId: string;
    seatId: string;
    seatClass: TicketSeatClass;
    luggage?: LuggageOption | undefined;
  }[];
}

export interface PaymentRepository {
  /**
   * Transacción 1: asientos → PAYMENT_PENDING, orden → PAYMENT_PENDING, pago PENDING y evento
   * PaymentRequested en el outbox: se guardan todos o ninguno.
   */
  beginPayment(input: BeginPaymentInput): Promise<BeginPaymentResult>;
  loadSettlement(paymentId: string): Promise<PaymentSettlement | null>;
  /**
   * Transacción 2 (aprobado): pago APPROVED, orden CONFIRMED, asientos RESERVED, tickets y eventos.
   * Devuelve false si el pago ya no estaba PENDING (otro intento lo resolvió).
   */
  settleApproved(input: {
    paymentId: string;
    gatewayReference: string;
    tickets: readonly NewTicket[];
  }): Promise<boolean>;
  /** Transacción 2 (rechazado): pago REJECTED, orden CANCELLED, asientos de vuelta a FREE. */
  settleRejected(input: { paymentId: string; reason: string }): Promise<boolean>;
}
