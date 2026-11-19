import { AppError } from "../../../../shared/errors/app-error.ts";
import type { ScheduledFlightRepository } from "../../../flights/domain/repositories/scheduled-flight.repository.ts";
import { Order, type StartOrderInput } from "../../domain/entities/order.entity.ts";
import type { OrderRepository } from "../../domain/repositories/order.repository.ts";
import { type PublicBooking, toPublicBooking } from "../booking-view.ts";
import type { GuestTokenService } from "../ports/guest-token-service.ts";

export interface StartBookingDeps {
  orders: OrderRepository;
  flights: ScheduledFlightRepository;
  guestTokens: GuestTokenService;
  /** Vigencia de la reserva y de su token de invitado (caducan juntas). */
  ttlSeconds: number;
  now?: () => Date;
}

/** Crea la orden en DRAFT y emite el token de sesión de invitado (`sub` = id de la orden). */
export class StartBooking {
  private readonly deps: StartBookingDeps;
  private readonly now: () => Date;

  constructor(deps: StartBookingDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  async execute(input: StartOrderInput): Promise<{
    booking: PublicBooking;
    token: string;
    expiresInSeconds: number;
  }> {
    const flight = await this.deps.flights.findById(input.flightId);
    if (!flight) throw new AppError("not_found", { code: "FLIGHT_NOT_FOUND" });
    if (!flight.isBookable()) throw new AppError("conflict", { code: "FLIGHT_NOT_BOOKABLE" });

    const order = Order.start(input, this.deps.ttlSeconds, this.now());
    await this.deps.orders.add(order);

    const { token, expiresInSeconds } = await this.deps.guestTokens.issue(order.id);
    const detail = await this.deps.orders.findDetail(order.id);
    if (!detail) throw new AppError("not_found", { code: "BOOKING_NOT_FOUND" });
    return { booking: toPublicBooking(detail), token, expiresInSeconds };
  }
}
