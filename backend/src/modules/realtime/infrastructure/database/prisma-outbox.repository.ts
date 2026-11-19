import type { PrismaClient } from "../../../../generated/prisma/client.ts";
import type { OutboxEvent } from "../../domain/entities/outbox-event.ts";
import type { OutboxRepository } from "../../domain/repositories/outbox.repository.ts";

export class PrismaOutboxRepository implements OutboxRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findDue(now: Date, limit: number): Promise<OutboxEvent[]> {
    const rows = await this.prisma.outboxEvent.findMany({
      where: { status: "PENDING", nextAttemptAt: { lte: now } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      eventType: row.eventType,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      attempts: row.attempts,
      createdAt: row.createdAt,
    }));
  }

  async markProcessed(id: string, now: Date): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: "PROCESSED", processedAt: now, attempts: { increment: 1 } },
    });
  }

  async scheduleRetry(id: string, nextAttemptAt: Date, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { attempts: { increment: 1 }, nextAttemptAt, lastError: error.slice(0, 500) },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id },
      data: { status: "FAILED", attempts: { increment: 1 }, lastError: error.slice(0, 500) },
    });
  }
}
