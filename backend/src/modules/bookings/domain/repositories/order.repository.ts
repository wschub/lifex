import type { Order, OrderStatus } from "../entities/order.entity.ts";
import type { Passenger } from "../entities/passenger.entity.ts";
import type { Pricing } from "../services/pricing.ts";

export interface BookingDetail {
  id: string;
  orderNumber: string;
  reservationNumber: string;
  flightId: string;
  status: OrderStatus;
  contactEmail: string;
  contactPhone: string | null;
  expiresAt: Date;
  pricing: Pricing;
  passengers: {
    id: string;
    fullName: string;
    lastName: string;
    passengerType: "ADULT" | "CHILD";
    seatId: string | null;
    seatIdentifier: string | null;
    luggageTypeId: number | null;
    ticketCode: string | null;
  }[];
  payment: { id: string; status: "PENDING" | "APPROVED" | "REJECTED" } | null;
}

export interface OrderRepository {
  add(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  /** Reemplaza los pasajeros y los precios de una orden DRAFT (lanza conflict si ya no lo es). */
  replacePassengers(
    orderId: string,
    passengers: readonly Passenger[],
    pricing: Pricing,
  ): Promise<void>;
  findDetail(id: string): Promise<BookingDetail | null>;
}
