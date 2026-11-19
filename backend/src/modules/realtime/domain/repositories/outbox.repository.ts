import type { OutboxEvent } from "../entities/outbox-event.ts";

export interface OutboxRepository {
  /** Eventos PENDING cuya hora de reintento ya llegó, del más antiguo al más reciente. */
  findDue(now: Date, limit: number): Promise<OutboxEvent[]>;
  markProcessed(id: string, now: Date): Promise<void>;
  /** Un intento fallido: sube el contador y fija cuándo se reintenta. */
  scheduleRetry(id: string, nextAttemptAt: Date, error: string): Promise<void>;
  /** Se agotaron los reintentos. */
  markFailed(id: string, error: string): Promise<void>;
}
