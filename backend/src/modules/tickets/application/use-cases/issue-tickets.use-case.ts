import {
  type LuggageOption,
  type NewTicket,
  Ticket,
  type TicketSeatClass,
} from "../../domain/entities/ticket.entity.ts";

export interface TicketPassenger {
  passengerId: string;
  seatId: string;
  seatClass: TicketSeatClass;
  luggage?: LuggageOption | undefined;
}

/** Tras un pago aprobado: un ticket con código único por pasajero. No persiste nada, solo decide. */
export class IssueTickets {
  execute(passengers: readonly TicketPassenger[]): NewTicket[] {
    return passengers.map((passenger) => Ticket.issue(passenger));
  }
}
