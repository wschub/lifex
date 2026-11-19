export interface RealtimeMessage {
  /** Nombre del evento: SeatHeld, SeatReleased, SeatSold, BookingConfirmed, FlightStatusChanged... */
  type: string;
  topic: string;
  flightId: string;
  /** Versión secuencial del vuelo; un salto en la secuencia obliga al cliente a pedir el snapshot. */
  version: number;
  data: Record<string, unknown>;
  at: string;
}

/** Puerto de difusión en tiempo real. El dominio y los casos de uso nunca importan `ws` directamente. */
export interface RealtimeBroadcaster {
  publish(topic: string, message: RealtimeMessage): void;
}
