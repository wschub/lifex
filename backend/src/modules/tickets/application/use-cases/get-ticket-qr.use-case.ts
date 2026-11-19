import { AppError } from "../../../../shared/errors/app-error.ts";
import type { TicketRepository } from "../../domain/repositories/ticket.repository.ts";
import type { QrCodeGenerator } from "../ports/qr-code-generator.ts";

const TICKET_CODE = /^LX[A-HJ-NP-Z2-9]{10}$/;

/** Imagen QR de un ticket existente: es la que los correos enlazan. */
export class GetTicketQr {
  private readonly deps: { tickets: TicketRepository; qr: QrCodeGenerator };

  constructor(deps: { tickets: TicketRepository; qr: QrCodeGenerator }) {
    this.deps = deps;
  }

  async execute(ticketCode: string): Promise<Buffer> {
    if (!TICKET_CODE.test(ticketCode) || !(await this.deps.tickets.ticketExists(ticketCode))) {
      throw new AppError("not_found");
    }
    return this.deps.qr.png(ticketCode);
  }
}
