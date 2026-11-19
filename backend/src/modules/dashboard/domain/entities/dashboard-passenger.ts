/** Un pasajero con ticket emitido (reserva confirmada) de un vuelo, tal como lo ve el personal del panel. */
export interface DashboardPassenger {
  ticketId: string;
  ticketCode: string;
  /** Código de reserva (PNR) de 6 caracteres. */
  reservationNumber: string;
  fullName: string;
  lastName: string;
  documentType: string;
  documentNumber: string;
  passengerType: "ADULT" | "CHILD";
  /** Es el comprador (primer pasajero de la reserva). */
  isHolder: boolean;
  seatIdentifier: string;
  seatClass: "ECONOMY" | "BUSINESS";
  /** Tarifa de equipaje elegida (nombre en español), si eligió alguna. */
  luggage: string | null;
  /** Datos de contacto de la reserva (los del comprador). */
  contactEmail: string;
  contactPhone: string | null;
  checkedIn: boolean;
  checkedInAt: Date | null;
}
