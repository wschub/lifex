/** Un avión de la flota, con sus capacidades y cuántos vuelos tiene programados por delante. */
export interface AircraftRow {
  id: number;
  internalIdentifier: string;
  /** Modelo (por ejemplo "Boeing 787-9"). */
  reference: string;
  description: string;
  descriptionEs: string;
  typeRange: "DOMESTIC" | "INTERNATIONAL";
  /** Alcance en millas náuticas. */
  rangeNauticalMiles: number;
  rangeKm: number;
  totalSeats: number;
  businessSeats: number;
  economySeats: number;
  seatColumns: string;
  status: "AVAILABLE" | "UNAVAILABLE";
  /** Vuelos que salen de ahora en adelante con este avión. */
  upcomingFlights: number;
}

/** Un cliente: quien compró (reservas confirmadas) agrupado por correo de contacto. */
export interface CustomerRow {
  email: string;
  /** Nombre del titular de su última compra. */
  name: string;
  phone: string | null;
  purchases: number;
  totalUsd: number;
  lastPurchaseAt: Date;
}

export type PurchaseStatus = "DRAFT" | "PAYMENT_PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";

/** Una compra (reserva) con su cliente, su vuelo y su pago. */
export interface PurchaseRow {
  id: string;
  reservationNumber: string;
  createdAt: Date;
  status: PurchaseStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  passengers: number;
  totalUsd: number;
  flight: {
    id: string;
    routeType: "DOMESTIC" | "INTERNATIONAL";
    from: string;
    to: string;
    fromCity: string;
    toCity: string;
    departureDate: Date;
  };
  payment: {
    status: "PENDING" | "APPROVED" | "REJECTED";
    cardBrand: string;
    cardLast4: string;
  } | null;
}
