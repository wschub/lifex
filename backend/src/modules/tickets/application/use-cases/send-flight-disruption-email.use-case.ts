import type { TicketRepository } from "../../domain/repositories/ticket.repository.ts";
import type { FlightDisruption, NotificationPort } from "../ports/notification.port.ts";

/**
 * Manejador del evento FlightDisruptionEmailRequested: cuando el administrador cancela o retrasa un
 * vuelo, el repositorio de vuelos encola un evento por cada orden CONFIRMED y este caso de uso envía
 * el aviso al correo de contacto de esa orden. Un fallo del proveedor se reintenta solo.
 */
export class SendFlightDisruptionEmail {
  private readonly deps: { tickets: TicketRepository; notifier: NotificationPort };

  constructor(deps: { tickets: TicketRepository; notifier: NotificationPort }) {
    this.deps = deps;
  }

  async execute(orderId: string, disruption: FlightDisruption): Promise<void> {
    const confirmation = await this.deps.tickets.findConfirmation(orderId);
    if (!confirmation) return;
    await this.deps.notifier.sendFlightDisruption(confirmation, disruption);
  }
}
