import type { FlightStatus } from "../../../flights/domain/entities/scheduled-flight.entity.ts";
import type { Seat } from "../entities/seat.entity.ts";

export interface HoldRequest {
  flightId: string;
  seatId: string;
  sessionId: string;
  now: Date;
  expiresAt: Date;
}

export interface SeatMap {
  /** Versión del último evento del vuelo: el cliente la compara con la de los eventos que le llegan. */
  version: number;
  flightStatus: FlightStatus;
  seats: Seat[];
}

export interface SeatRepository {
  /** Vuelo y asiento, para distinguir 404 (no existe) de 409 (existe pero no está libre). */
  findSeat(
    flightId: string,
    seatId: string,
  ): Promise<{ seat: Seat; flightStatus: FlightStatus } | null>;
  /**
   * Bloqueo atómico: un solo UPDATE condicional (FREE, o BLOCKED ya vencido). Devuelve null, sin
   * lanzar, si no hubo fila afectada. Escribe el evento SeatHeld en la misma transacción.
   */
  tryHold(request: HoldRequest): Promise<Seat | null>;
  /** El dueño libera su propio bloqueo vigente. Devuelve false si no era suyo. Escribe SeatReleased. */
  releaseHold(flightId: string, seatId: string, sessionId: string): Promise<boolean>;
  countHeldBySession(sessionId: string, now: Date): Promise<number>;
  /** Libera los BLOCKED vencidos (nunca los PAYMENT_PENDING) y escribe SeatReleased. */
  releaseExpired(now: Date, batchSize: number): Promise<number>;
  seatMap(flightId: string): Promise<SeatMap | null>;
}
