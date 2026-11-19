import { AppError } from "../../../../shared/errors/app-error.ts";
import {
  type PricingConfig,
  priceForClass,
} from "../../../flights/domain/services/dynamic-price.ts";
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
  private readonly pricing: PricingConfig;
  private readonly now: () => Date;

  constructor(deps: { seats: SeatRepository; pricing: PricingConfig; now?: () => Date }) {
    this.seats = deps.seats;
    this.pricing = deps.pricing;
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
      // Un asiento libre muestra el precio vigente de su clase; el resto conserva el congelado.
      seats: map.seats.map((seat) => {
        const free = seat.isAvailable(now);
        const price = free
          ? priceForClass(map.pricing, seat.seatClass, now, this.pricing).priceUsd
          : seat.price;
        return { ...toPublicSeat(seat, price), status: free ? "FREE" : seat.status };
      }),
    };
  }
}
