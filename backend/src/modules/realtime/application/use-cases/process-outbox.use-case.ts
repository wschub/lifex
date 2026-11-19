import type { OutboxEvent } from "../../domain/entities/outbox-event.ts";
import type { OutboxRepository } from "../../domain/repositories/outbox.repository.ts";

export interface OutboxContext {
  /** Número de este intento, empezando en 1. */
  attempt: number;
  /** true si, de fallar, el evento ya no se reintenta: el manejador puede dar el caso por perdido. */
  isLastAttempt: boolean;
}

export type OutboxHandler = (event: OutboxEvent, context: OutboxContext) => Promise<void>;

export interface ProcessOutboxDeps {
  outbox: OutboxRepository;
  /** Un manejador por tipo de evento. */
  handlers: Readonly<Record<string, OutboxHandler>>;
  maxAttempts: number;
  batchSize?: number;
  now?: () => Date;
  onError?: (error: unknown, event: OutboxEvent) => void;
}

const MAX_BACKOFF_SECONDS = 60;

/** Lo ejecuta el scheduler con frecuencia alta: lee el outbox y entrega cada evento a su manejador. */
export class ProcessOutbox {
  private readonly deps: ProcessOutboxDeps;
  private readonly now: () => Date;

  constructor(deps: ProcessOutboxDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => new Date());
  }

  async execute(): Promise<number> {
    const events = await this.deps.outbox.findDue(this.now(), this.deps.batchSize ?? 50);
    let processed = 0;
    for (const event of events) {
      if (await this.dispatch(event)) processed += 1;
    }
    return processed;
  }

  private async dispatch(event: OutboxEvent): Promise<boolean> {
    const handler = this.deps.handlers[event.eventType];
    if (!handler) {
      await this.deps.outbox.markFailed(event.id, `no handler for ${event.eventType}`);
      return false;
    }
    const attempt = event.attempts + 1;
    try {
      await handler(event, { attempt, isLastAttempt: attempt >= this.deps.maxAttempts });
      await this.deps.outbox.markProcessed(event.id, this.now());
      return true;
    } catch (error) {
      this.deps.onError?.(error, event);
      const message = error instanceof Error ? error.message : "unknown error";
      if (attempt >= this.deps.maxAttempts) {
        await this.deps.outbox.markFailed(event.id, message);
      } else {
        const delaySeconds = Math.min(2 ** attempt, MAX_BACKOFF_SECONDS);
        await this.deps.outbox.scheduleRetry(
          event.id,
          new Date(this.now().getTime() + delaySeconds * 1000),
          message,
        );
      }
      return false;
    }
  }
}
