import type {
  FlightDisruption,
  NotificationPort,
} from "../../application/ports/notification.port.ts";
import type {
  BookingConfirmation,
  TicketView,
} from "../../domain/repositories/ticket.repository.ts";

/** Sin BREVO_API_KEY: solo registra el intento, sin romper el flujo. */
export class LogNotificationAdapter implements NotificationPort {
  private readonly log: (message: string, fields: Record<string, unknown>) => void;

  constructor(log: (message: string, fields: Record<string, unknown>) => void) {
    this.log = log;
  }

  async sendTicketConfirmation(
    confirmation: BookingConfirmation,
    ticket: TicketView,
  ): Promise<void> {
    this.log("ticket email not sent (no BREVO_API_KEY); logging the attempt only", {
      reservationNumber: confirmation.reservationNumber,
      ticketCode: ticket.ticketCode,
    });
  }

  async sendFlightDisruption(
    confirmation: BookingConfirmation,
    disruption: FlightDisruption,
  ): Promise<void> {
    this.log("flight disruption email not sent (no BREVO_API_KEY); logging the attempt only", {
      reservationNumber: confirmation.reservationNumber,
      disruption,
    });
  }
}
