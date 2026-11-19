import { AppError } from "../../../../shared/errors/app-error.ts";

export const SEAT_STATUSES = ["FREE", "BLOCKED", "PAYMENT_PENDING", "RESERVED"] as const;
export type SeatStatus = (typeof SEAT_STATUSES)[number];
export type SeatClass = "ECONOMY" | "BUSINESS";

/**
 * Máquina de estados del asiento. RESERVED es final.
 *   FREE → BLOCKED → PAYMENT_PENDING → RESERVED
 *   BLOCKED → FREE (expira o se libera)      PAYMENT_PENDING → FREE (pago rechazado)
 */
const TRANSITIONS: Record<SeatStatus, readonly SeatStatus[]> = {
  FREE: ["BLOCKED"],
  BLOCKED: ["FREE", "PAYMENT_PENDING"],
  PAYMENT_PENDING: ["RESERVED", "FREE"],
  RESERVED: [],
};

export interface SeatProps {
  id: string;
  flightId: string;
  identifier: string;
  row: number;
  column: string;
  seatClass: SeatClass;
  /** Precio en USD. */
  price: number;
  status: SeatStatus;
  heldBySession: string | null;
  holdExpiresAt: Date | null;
}

export class Seat {
  readonly id: string;
  readonly flightId: string;
  readonly identifier: string;
  readonly row: number;
  readonly column: string;
  readonly seatClass: SeatClass;
  readonly price: number;
  readonly status: SeatStatus;
  readonly heldBySession: string | null;
  readonly holdExpiresAt: Date | null;

  private constructor(props: SeatProps) {
    this.id = props.id;
    this.flightId = props.flightId;
    this.identifier = props.identifier;
    this.row = props.row;
    this.column = props.column;
    this.seatClass = props.seatClass;
    this.price = props.price;
    this.status = props.status;
    this.heldBySession = props.heldBySession;
    this.holdExpiresAt = props.holdExpiresAt;
    Object.freeze(this);
  }

  static restore(props: SeatProps): Seat {
    return new Seat(props);
  }

  canTransitionTo(target: SeatStatus): boolean {
    return TRANSITIONS[this.status].includes(target);
  }

  /** Devuelve el asiento en el nuevo estado, o lanza si la transición no existe. */
  transitionTo(target: SeatStatus, hold?: { sessionId: string; expiresAt: Date }): Seat {
    if (!this.canTransitionTo(target)) {
      throw new AppError("conflict", {
        code: "INVALID_SEAT_TRANSITION",
        details: { from: this.status, to: target },
      });
    }
    const held = target === "BLOCKED" && hold !== undefined;
    return new Seat({
      ...this,
      status: target,
      heldBySession: held ? hold.sessionId : target === "FREE" ? null : this.heldBySession,
      holdExpiresAt: held ? hold.expiresAt : target === "FREE" ? null : this.holdExpiresAt,
    });
  }

  /** Un BLOCKED vencido se trata como libre aunque el job periódico todavía no lo haya liberado. */
  isAvailable(now: Date): boolean {
    return (
      this.status === "FREE" ||
      (this.status === "BLOCKED" && this.holdExpiresAt !== null && this.holdExpiresAt < now)
    );
  }

  isHeldBy(sessionId: string, now: Date): boolean {
    return (
      this.status === "BLOCKED" &&
      this.heldBySession === sessionId &&
      this.holdExpiresAt !== null &&
      this.holdExpiresAt >= now
    );
  }
}
