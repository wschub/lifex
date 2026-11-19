import type { OutboxEvent } from "../../domain/entities/outbox-event.ts";
import type { RealtimeBroadcaster } from "../ports/realtime-broadcaster.ts";
import { topicsFor } from "../topics.ts";

/** Publica un evento del outbox a los temas que corresponden. */
export class BroadcastFlightEvent {
  private readonly broadcaster: RealtimeBroadcaster;

  constructor(deps: { broadcaster: RealtimeBroadcaster }) {
    this.broadcaster = deps.broadcaster;
  }

  async handle(event: OutboxEvent): Promise<void> {
    const { flightId, version, ...data } = event.payload;
    if (typeof flightId !== "string" || typeof version !== "number") return;
    for (const topic of topicsFor(event.eventType, flightId)) {
      this.broadcaster.publish(topic, {
        type: event.eventType,
        topic,
        flightId,
        version,
        data,
        at: event.createdAt.toISOString(),
      });
    }
  }
}
