import type { RequestHandler } from "express";
import type { GetTicketQr } from "../../application/use-cases/get-ticket-qr.use-case.ts";
import type { ListOrderTickets } from "../../application/use-cases/list-order-tickets.use-case.ts";

export interface TicketsControllerDeps {
  listOrderTickets: ListOrderTickets;
  getTicketQr: GetTicketQr;
}

export function createTicketsController(deps: TicketsControllerDeps) {
  const list: RequestHandler = async (_req, res) => {
    const orderId = String(res.locals.bookingId);
    res.json(await deps.listOrderTickets.execute(orderId));
  };

  const qr: RequestHandler = async (req, res) => {
    const png = await deps.getTicketQr.execute(String(req.params.code));
    // El código del ticket nunca cambia: la imagen se puede cachear (los clientes de correo la piden una vez).
    res.set({ "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" });
    res.send(png);
  };

  return { list, qr };
}
