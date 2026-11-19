export interface OutboxEvent {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  /** Intentos ya realizados antes de este. */
  attempts: number;
  createdAt: Date;
}
