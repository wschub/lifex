import type { BookingDetail } from "../domain/repositories/order.repository.ts";

export interface PublicBooking {
  id: string;
  orderNumber: string;
  reservationNumber: string;
  flightId: string;
  status: BookingDetail["status"];
  contactEmail: string;
  contactPhone: string | null;
  expiresAt: string;
  /** USD. */
  flightPriceUsd: number;
  taxesUsd: number;
  totalPriceUsd: number;
  passengers: BookingDetail["passengers"];
  payment: BookingDetail["payment"];
}

export function toPublicBooking(detail: BookingDetail): PublicBooking {
  return {
    id: detail.id,
    orderNumber: detail.orderNumber,
    reservationNumber: detail.reservationNumber,
    flightId: detail.flightId,
    status: detail.status,
    contactEmail: detail.contactEmail,
    contactPhone: detail.contactPhone,
    expiresAt: detail.expiresAt.toISOString(),
    flightPriceUsd: detail.pricing.flightPrice,
    taxesUsd: detail.pricing.taxes,
    totalPriceUsd: detail.pricing.totalPrice,
    passengers: detail.passengers,
    payment: detail.payment,
  };
}
