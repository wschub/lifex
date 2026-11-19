export interface TicketView {
  ticketCode: string;
  /** Primer nombre del pasajero. */
  passengerFirstName: string;
  passengerFullName: string;
  seatIdentifier: string;
  seatClass: "ECONOMY" | "BUSINESS";
  luggage: string[];
}

export interface BookingConfirmation {
  orderId: string;
  reservationNumber: string;
  contactEmail: string;
  locale: "es" | "en";
  /** Primer nombre del comprador (el primer pasajero de la reserva). */
  buyerFirstName: string;
  flight: {
    id: string;
    fromIata: string;
    fromCity: string;
    toIata: string;
    toCity: string;
    departureDate: Date;
    arrivalDate: Date;
  };
  totalPriceUsd: number;
  tickets: TicketView[];
}

export interface TicketRepository {
  /** Datos de una orden CONFIRMED para los correos; null si no existe o no está confirmada. */
  findConfirmation(orderId: string): Promise<BookingConfirmation | null>;
  ticketExists(ticketCode: string): Promise<boolean>;
}
