import { AppError } from "../../../../shared/errors/app-error.ts";
import type { CatalogRepository } from "../../../catalog/domain/repositories/catalog.repository.ts";
import type { SeatRepository } from "../../../inventory/domain/repositories/seat.repository.ts";
import { assertLuggageAllowed } from "../../../tickets/domain/entities/ticket.entity.ts";
import { Passenger, type PassengerInput } from "../../domain/entities/passenger.entity.ts";
import type { OrderRepository } from "../../domain/repositories/order.repository.ts";
import { computePricing, type PricingLine } from "../../domain/services/pricing.ts";
import { type PublicBooking, toPublicBooking } from "../booking-view.ts";

export interface SetPassengersDeps {
  orders: OrderRepository;
  seats: SeatRepository;
  catalog: CatalogRepository;
  taxPercentage: number;
  maxPassengers: number;
  now?: () => Date;
}

/**
 * Define los pasajeros de la orden, cada uno con el asiento que la sesión tiene bloqueado y su
 * equipaje (opcional). Calcula el precio: asientos + recargo de equipaje + impuestos.
 */
export class SetPassengers {
  private readonly deps: SetPassengersDeps;
  private readonly now: () => Date;

  constructor(deps: SetPassengersDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  async execute(orderId: string, inputs: readonly PassengerInput[]): Promise<PublicBooking> {
    const now = this.now();
    const order = await this.deps.orders.findById(orderId);
    if (!order) throw new AppError("not_found", { code: "BOOKING_NOT_FOUND" });
    order.assertEditable(now);

    if (inputs.length === 0 || inputs.length > this.deps.maxPassengers) {
      throw new AppError("validation", { code: "INVALID_PASSENGER" });
    }
    const seatIds = new Set(inputs.map((input) => input.seatId));
    if (seatIds.size !== inputs.length) {
      throw new AppError("conflict", { code: "PASSENGERS_SEATS_MISMATCH" });
    }

    const [countries, luggageTypes] = await Promise.all([
      this.deps.catalog.listCountries(),
      this.deps.catalog.listLuggageTypes(),
    ]);
    const passengers = inputs.map((input) => Passenger.create(input, now));
    const lines: PricingLine[] = [];

    for (const passenger of passengers) {
      if (!countries.some((country) => country.id === passenger.nationalityCountryId)) {
        throw new AppError("validation", {
          code: "INVALID_PASSENGER",
          details: { field: "nationalityCountryId" },
        });
      }
      const found = await this.deps.seats.findSeat(order.flightId, passenger.seatId);
      if (!found || !found.seat.isHeldBy(order.id, now)) {
        throw new AppError("conflict", {
          code: "PASSENGERS_SEATS_MISMATCH",
          details: { seatId: passenger.seatId },
        });
      }
      let luggageFee: number | null = null;
      if (passenger.luggageTypeId !== null) {
        const luggage = luggageTypes.find((type) => type.id === passenger.luggageTypeId);
        if (!luggage) throw new AppError("validation", { code: "LUGGAGE_TYPE_NOT_FOUND" });
        assertLuggageAllowed(
          {
            id: luggage.id,
            feePercentage: luggage.feePercentage,
            businessOnly: luggage.businessOnly,
          },
          found.seat.seatClass,
        );
        luggageFee = luggage.feePercentage;
      }
      lines.push({ seatPriceUsd: found.seat.price, luggageFeePercentage: luggageFee });
    }

    await this.deps.orders.replacePassengers(
      order.id,
      passengers,
      computePricing(lines, this.deps.taxPercentage),
    );
    const detail = await this.deps.orders.findDetail(order.id);
    if (!detail) throw new AppError("not_found", { code: "BOOKING_NOT_FOUND" });
    return toPublicBooking(detail);
  }
}
