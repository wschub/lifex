/**
 * Eventos de dominio de un vuelo. Se escriben en `outbox_events` dentro de la misma transacción que
 * el cambio de estado y un worker los publica después (por WebSocket, por correo, etc.).
 */
export const FLIGHT_EVENT = {
  seatHeld: "SeatHeld",
  seatReleased: "SeatReleased",
  seatPaymentPending: "SeatPaymentPending",
  seatSold: "SeatSold",
  bookingConfirmed: "BookingConfirmed",
  flightStatusChanged: "FlightStatusChanged",
} as const;

export const INTERNAL_EVENT = {
  paymentRequested: "PaymentRequested",
  /** Un evento por ticket: correo de confirmación con su boleto y QR. */
  ticketEmailRequested: "TicketEmailRequested",
  /** Un evento por orden confirmada cuando el admin cancela o retrasa el vuelo. */
  flightDisruptionEmailRequested: "FlightDisruptionEmailRequested",
} as const;

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface NewFlightEvent {
  flightId: string;
  eventType: string;
  data: { [key: string]: JsonValue };
}

/**
 * Lo mínimo que se necesita de un cliente Prisma (o de su transacción) para escribir un evento.
 * Se declara de forma estructural para que `shared/` no dependa del cliente generado.
 */
export interface OutboxTransaction {
  scheduledFlight: {
    update(args: {
      where: { id: string };
      data: { eventVersion: { increment: number } };
      select: { eventVersion: true };
    }): Promise<{ eventVersion: number }>;
  };
  outboxEvent: {
    create(args: {
      data: {
        aggregateType: string;
        aggregateId: string;
        eventType: string;
        payload: { [key: string]: JsonValue };
      };
    }): Promise<unknown>;
  };
}

/** Escribe un evento del vuelo con su número de versión secuencial. Debe llamarse dentro de la transacción del cambio. */
export async function enqueueFlightEvent(
  tx: OutboxTransaction,
  event: NewFlightEvent,
): Promise<void> {
  const { eventVersion } = await tx.scheduledFlight.update({
    where: { id: event.flightId },
    data: { eventVersion: { increment: 1 } },
    select: { eventVersion: true },
  });
  await tx.outboxEvent.create({
    data: {
      aggregateType: "flight",
      aggregateId: event.flightId,
      eventType: event.eventType,
      payload: { flightId: event.flightId, version: eventVersion, ...event.data },
    },
  });
}

/** Evento interno (no se difunde a clientes): lo consume un manejador del propio backend. */
export async function enqueueInternalEvent(
  tx: Pick<OutboxTransaction, "outboxEvent">,
  event: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: { [key: string]: JsonValue };
  },
): Promise<void> {
  await tx.outboxEvent.create({ data: event });
}
