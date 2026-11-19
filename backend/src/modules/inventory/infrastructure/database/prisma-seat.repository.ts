import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.ts";
import { enqueueFlightEvent, FLIGHT_EVENT } from "../../../../shared/outbox/flight-events.ts";
import type { FlightStatus } from "../../../flights/domain/entities/scheduled-flight.entity.ts";
import { Seat } from "../../domain/entities/seat.entity.ts";
import type {
  HoldRequest,
  SeatMap,
  SeatRepository,
} from "../../domain/repositories/seat.repository.ts";

type SeatRow = Prisma.FlightSeatGetPayload<object>;

function toSeat(row: SeatRow): Seat {
  return Seat.restore({
    id: row.id,
    flightId: row.scheduledFlightId,
    identifier: row.seatIdentifier,
    row: row.seatRow,
    column: row.seatColumn,
    seatClass: row.seatClass,
    price: Number(row.seatPrice),
    status: row.seatStatus,
    heldBySession: row.heldBySession,
    holdExpiresAt: row.holdExpiresAt,
  });
}

export class PrismaSeatRepository implements SeatRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async findSeat(
    flightId: string,
    seatId: string,
  ): Promise<{ seat: Seat; flightStatus: FlightStatus } | null> {
    const row = await this.prisma.flightSeat.findFirst({
      where: { id: seatId, scheduledFlightId: flightId },
      include: { scheduledFlight: { select: { status: true } } },
    });
    return row ? { seat: toSeat(row), flightStatus: row.scheduledFlight.status } : null;
  }

  async tryHold(request: HoldRequest): Promise<Seat | null> {
    return this.prisma.$transaction(async (tx) => {
      // Un solo UPDATE condicional: la base de datos es la única fuente de verdad del bloqueo.
      const { count } = await tx.flightSeat.updateMany({
        where: {
          id: request.seatId,
          scheduledFlightId: request.flightId,
          scheduledFlight: { status: { in: ["ACTIVE", "DELAYED"] } },
          OR: [
            { seatStatus: "FREE" },
            { seatStatus: "BLOCKED", holdExpiresAt: { lt: request.now } },
          ],
        },
        data: {
          seatStatus: "BLOCKED",
          heldBySession: request.sessionId,
          holdExpiresAt: request.expiresAt,
          version: { increment: 1 },
        },
      });
      if (count === 0) return null;

      const row = await tx.flightSeat.findUniqueOrThrow({ where: { id: request.seatId } });
      await enqueueFlightEvent(tx, {
        flightId: request.flightId,
        eventType: FLIGHT_EVENT.seatHeld,
        data: { seatId: row.id, seatIdentifier: row.seatIdentifier, status: "BLOCKED" },
      });
      return toSeat(row);
    });
  }

  async releaseHold(flightId: string, seatId: string, sessionId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.flightSeat.updateMany({
        where: {
          id: seatId,
          scheduledFlightId: flightId,
          seatStatus: "BLOCKED",
          heldBySession: sessionId,
        },
        data: {
          seatStatus: "FREE",
          heldBySession: null,
          holdExpiresAt: null,
          version: { increment: 1 },
        },
      });
      if (count === 0) return false;
      const row = await tx.flightSeat.findUniqueOrThrow({ where: { id: seatId } });
      await enqueueFlightEvent(tx, {
        flightId,
        eventType: FLIGHT_EVENT.seatReleased,
        data: { seatId, seatIdentifier: row.seatIdentifier, status: "FREE", reason: "released" },
      });
      return true;
    });
  }

  countHeldBySession(sessionId: string, now: Date): Promise<number> {
    return this.prisma.flightSeat.count({
      where: { heldBySession: sessionId, seatStatus: "BLOCKED", holdExpiresAt: { gte: now } },
    });
  }

  async releaseExpired(now: Date, batchSize: number): Promise<number> {
    const expired = await this.prisma.flightSeat.findMany({
      where: { seatStatus: "BLOCKED", holdExpiresAt: { lt: now } },
      select: { id: true, scheduledFlightId: true, seatIdentifier: true },
      orderBy: { holdExpiresAt: "asc" },
      take: batchSize,
    });
    let released = 0;
    for (const seat of expired) {
      await this.prisma.$transaction(async (tx) => {
        // Se vuelve a comprobar el estado: si en este instante pasó a PAYMENT_PENDING, no se toca.
        const { count } = await tx.flightSeat.updateMany({
          where: { id: seat.id, seatStatus: "BLOCKED", holdExpiresAt: { lt: now } },
          data: {
            seatStatus: "FREE",
            heldBySession: null,
            holdExpiresAt: null,
            version: { increment: 1 },
          },
        });
        if (count === 0) return;
        released += 1;
        await enqueueFlightEvent(tx, {
          flightId: seat.scheduledFlightId,
          eventType: FLIGHT_EVENT.seatReleased,
          data: {
            seatId: seat.id,
            seatIdentifier: seat.seatIdentifier,
            status: "FREE",
            reason: "expired",
          },
        });
      });
    }
    return released;
  }

  async seatMap(flightId: string): Promise<SeatMap | null> {
    const flight = await this.prisma.scheduledFlight.findUnique({
      where: { id: flightId },
      select: { eventVersion: true, status: true },
    });
    if (!flight) return null;
    const rows = await this.prisma.flightSeat.findMany({
      where: { scheduledFlightId: flightId },
      orderBy: [{ seatRow: "asc" }, { seatColumn: "asc" }],
    });
    return { version: flight.eventVersion, flightStatus: flight.status, seats: rows.map(toSeat) };
  }
}
