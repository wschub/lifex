import { AppError } from "../../../../shared/errors/app-error.ts";
import type { SeatRepository } from "../../domain/repositories/seat.repository.ts";

/** El cliente suelta un asiento que había bloqueado. */
export class ReleaseSeat {
  private readonly seats: SeatRepository;

  constructor(deps: { seats: SeatRepository }) {
    this.seats = deps.seats;
  }

  async execute(input: { flightId: string; seatId: string; sessionId: string }): Promise<void> {
    const released = await this.seats.releaseHold(input.flightId, input.seatId, input.sessionId);
    if (!released) throw new AppError("conflict", { code: "SEAT_UNAVAILABLE" });
  }
}
