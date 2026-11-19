import { AppError } from "../../../../shared/errors/app-error.ts";
import type { SeatRepository } from "../../domain/repositories/seat.repository.ts";
import { type PublicSeat, toPublicSeat } from "../seat-view.ts";

export interface PublicSeatMap {
  flightId: string;
  flightStatus: string;
  version: number;
  seats: PublicSeat[];
}

/** Snapshot del mapa de asientos: el cliente aplica encima los eventos con `version` mayor. */
export class GetSeatMap {
  private readonly seats: SeatRepository;
  private readonly now: () => Date;

  constructor(deps: { seats: SeatRepository; now?: () => Date }) {
    this.seats = deps.seats;
    this.now = deps.now ?? (() => new Date());
  }

  async execute(flightId: string): Promise<PublicSeatMap> {
    const map = await this.seats.seatMap(flightId);
    if (!map) throw new AppError("not_found", { code: "FLIGHT_NOT_FOUND" });
    const now = this.now();
    return {
      flightId,
      flightStatus: map.flightStatus,
      version: map.version,
      // Un bloqueo vencido se muestra libre, igual que lo trata el bloqueo perezoso.
      seats: map.seats.map((seat) => ({
        ...toPublicSeat(seat),
        status: seat.isAvailable(now) ? "FREE" : seat.status,
      })),
    };
  }
}
