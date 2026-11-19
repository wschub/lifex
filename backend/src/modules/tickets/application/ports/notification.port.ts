import type {
  BookingConfirmation,
  TicketView,
} from "../../domain/repositories/ticket.repository.ts";

export type FlightDisruption = "DELAYED" | "CANCELLED";

/**
 * Puerto de notificación al cliente. Hoy lo implementa Brevo (o un adaptador que solo registra en el
 * log si no hay API key); cambiar de proveedor no toca los casos de uso.
 */
export interface NotificationPort {
  /** Confirmación de reserva con el boleto de UN pasajero (un correo por ticket). */
  sendTicketConfirmation(confirmation: BookingConfirmation, ticket: TicketView): Promise<void>;
  /** Aviso de que el administrador canceló o retrasó el vuelo, un correo por orden. */
  sendFlightDisruption(
    confirmation: BookingConfirmation,
    disruption: FlightDisruption,
  ): Promise<void>;
}
