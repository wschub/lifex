import { AppError } from "../../../../shared/errors/app-error.ts";
import type { OrderRepository } from "../../domain/repositories/order.repository.ts";
import { type PublicBooking, toPublicBooking } from "../booking-view.ts";

export class GetBooking {
  private readonly orders: OrderRepository;

  constructor(deps: { orders: OrderRepository }) {
    this.orders = deps.orders;
  }

  async execute(orderId: string): Promise<PublicBooking> {
    const detail = await this.orders.findDetail(orderId);
    if (!detail) throw new AppError("not_found", { code: "BOOKING_NOT_FOUND" });
    return toPublicBooking(detail);
  }
}
