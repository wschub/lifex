import { AppError } from "../../../../shared/errors/app-error.ts";
import { BOOKABLE_STATUSES } from "../../../flights/domain/entities/scheduled-flight.entity.ts";
import {
  type PricingConfig,
  priceForClass,
} from "../../../flights/domain/services/dynamic-price.ts";
import type { SeatRepository } from "../../domain/repositories/seat.repository.ts";
import { type PublicSeat, toPublicSeat } from "../seat-view.ts";

export interface HoldSeatDeps {
  seats: SeatRepository;
  /** Minutos que dura el bloqueo (MAX_SEAT_LOCK_TIME). */
  lockMinutes: number;
  /** Máximo de asientos bloqueados a la vez por sesión (anti-acaparamiento). */
  maxHeldPerSession: number;
  /** Reglas del precio dinámico: el precio vigente se congela al bloquear. */
  pricing: PricingConfig;
  now?: () => Date;
}

export class HoldSeat {
  private readonly deps: HoldSeatDeps;
  private readonly now: () => Date;

  constructor(deps: HoldSeatDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  async execute(input: { flightId: string; seatId: string; sessionId: string }): Promise<{
    seat: PublicSeat;
    holdExpiresAt: string;
  }> {
    const now = this.now();
    const found = await this.deps.seats.findSeat(input.flightId, input.seatId);
    if (!found) throw new AppError("not_found", { code: "SEAT_NOT_FOUND" });
    if (!BOOKABLE_STATUSES.includes(found.flightStatus)) {
      throw new AppError("conflict", { code: "FLIGHT_NOT_BOOKABLE" });
    }

    const held = await this.deps.seats.countHeldBySession(input.sessionId, now);
    if (held >= this.deps.maxHeldPerSession) {
      throw new AppError("conflict", { code: "TOO_MANY_HELD_SEATS" });
    }

    const expiresAt = new Date(now.getTime() + this.deps.lockMinutes * 60_000);
    const { priceUsd } = priceForClass(found.pricing, found.seat.seatClass, now, this.deps.pricing);
    const seat = await this.deps.seats.tryHold({ ...input, now, expiresAt, priceUsd });
    if (!seat) throw new AppError("conflict", { code: "SEAT_UNAVAILABLE" });
    return { seat: toPublicSeat(seat), holdExpiresAt: expiresAt.toISOString() };
  }
}
