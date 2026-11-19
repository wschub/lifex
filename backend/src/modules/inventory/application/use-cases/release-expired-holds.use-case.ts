import type { SeatRepository } from "../../domain/repositories/seat.repository.ts";

const BATCH_SIZE = 200;

/** Lo llama el scheduler cada 30 segundos. Procesa por lotes hasta vaciar los vencidos. */
export class ReleaseExpiredHolds {
  private readonly seats: SeatRepository;
  private readonly now: () => Date;

  constructor(deps: { seats: SeatRepository; now?: () => Date }) {
    this.seats = deps.seats;
    this.now = deps.now ?? (() => new Date());
  }

  async execute(): Promise<number> {
    let total = 0;
    for (;;) {
      const released = await this.seats.releaseExpired(this.now(), BATCH_SIZE);
      total += released;
      if (released < BATCH_SIZE) return total;
    }
  }
}
