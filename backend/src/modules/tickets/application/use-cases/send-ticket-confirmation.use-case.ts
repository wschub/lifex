import { AppError } from "../../../../shared/errors/app-error.ts";
import type { TicketRepository } from "../../domain/repositories/ticket.repository.ts";
import type { NotificationPort } from "../ports/notification.port.ts";

/**
 * Manejador del evento TicketEmailRequested (uno por ticket). Va aparte de la confirmación del pago a
 * propósito: si el correo falla se reintenta solo y la reserva ya confirmada no se revierte.
 */
export class SendTicketConfirmation {
  private readonly deps: { tickets: TicketRepository; notifier: NotificationPort };

  constructor(deps: { tickets: TicketRepository; notifier: NotificationPort }) {
    this.deps = deps;
  }

  async execute(orderId: string, ticketCode: string): Promise<void> {
    const confirmation = await this.deps.tickets.findConfirmation(orderId);
    if (!confirmation) throw new AppError("not_found", { code: "BOOKING_NOT_FOUND" });
    const ticket = confirmation.tickets.find((item) => item.ticketCode === ticketCode);
    if (!ticket) return;
    await this.deps.notifier.sendTicketConfirmation(confirmation, ticket);
  }
}
