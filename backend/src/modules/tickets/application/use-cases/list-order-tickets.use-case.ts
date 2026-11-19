import { AppError } from "../../../../shared/errors/app-error.ts";
import type { TicketRepository, TicketView } from "../../domain/repositories/ticket.repository.ts";

export class ListOrderTickets {
  private readonly tickets: TicketRepository;

  constructor(deps: { tickets: TicketRepository }) {
    this.tickets = deps.tickets;
  }

  async execute(orderId: string): Promise<{ reservationNumber: string; tickets: TicketView[] }> {
    const confirmation = await this.tickets.findConfirmation(orderId);
    if (!confirmation) throw new AppError("not_found", { code: "BOOKING_NOT_FOUND" });
    return { reservationNumber: confirmation.reservationNumber, tickets: confirmation.tickets };
  }
}
