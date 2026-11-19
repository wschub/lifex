import { Prisma, type PrismaClient } from "../../../../generated/prisma/client.ts";
import { AppError } from "../../../../shared/errors/app-error.ts";
import {
  enqueueFlightEvent,
  enqueueInternalEvent,
  FLIGHT_EVENT,
  INTERNAL_EVENT,
} from "../../../../shared/outbox/flight-events.ts";
import type { NewTicket } from "../../../tickets/domain/entities/ticket.entity.ts";
import type {
  BeginPaymentInput,
  BeginPaymentResult,
  PaymentRepository,
  PaymentSettlement,
} from "../../domain/repositories/payment.repository.ts";

export class PrismaPaymentRepository implements PaymentRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async beginPayment(input: BeginPaymentInput): Promise<BeginPaymentResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
          where: { id: input.orderId },
          include: { passengers: true },
        });
        if (!order) throw new AppError("not_found", { code: "BOOKING_NOT_FOUND" });

        // Idempotencia: la misma clave con el mismo cuerpo devuelve lo ya guardado; con otro cuerpo, 422.
        if (order.idempotencyKey !== null) {
          if (
            order.idempotencyKey === input.idempotencyKey &&
            order.idempotencyHash === input.requestHash
          ) {
            const payment = await tx.payment.findFirstOrThrow({
              where: { orderId: order.id, idempotencyKey: input.idempotencyKey },
            });
            return {
              replayed: true,
              payment: { id: payment.id, status: payment.status },
              order: { id: order.id, status: order.status },
            };
          }
          if (order.idempotencyKey === input.idempotencyKey) {
            throw new AppError("unprocessable", { code: "IDEMPOTENCY_KEY_REUSED" });
          }
        }

        if (order.status !== "DRAFT")
          throw new AppError("conflict", { code: "BOOKING_NOT_PAYABLE" });
        if (order.expiresAt < input.now)
          throw new AppError("conflict", { code: "BOOKING_EXPIRED" });
        const seatIds = order.passengers.flatMap((p) => (p.seatId ? [p.seatId] : []));
        if (seatIds.length === 0 || seatIds.length !== order.passengers.length) {
          throw new AppError("conflict", { code: "BOOKING_NOT_PAYABLE" });
        }

        // Los asientos pasan a PAYMENT_PENDING solo si esta sesión todavía los tiene bloqueados.
        const { count } = await tx.flightSeat.updateMany({
          where: {
            id: { in: seatIds },
            scheduledFlightId: order.scheduledFlightId,
            seatStatus: "BLOCKED",
            heldBySession: order.id,
            holdExpiresAt: { gte: input.now },
          },
          data: { seatStatus: "PAYMENT_PENDING", version: { increment: 1 } },
        });
        if (count !== seatIds.length)
          throw new AppError("conflict", { code: "SEATS_NO_LONGER_HELD" });

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: "PAYMENT_PENDING",
            idempotencyKey: input.idempotencyKey,
            idempotencyHash: input.requestHash,
          },
        });
        const payment = await tx.payment.create({
          data: {
            orderId: order.id,
            amount: order.totalPrice,
            status: "PENDING",
            cardBrand: input.card.brand,
            cardLast4: input.card.last4,
            idempotencyKey: input.idempotencyKey,
          },
        });

        const seats = await tx.flightSeat.findMany({ where: { id: { in: seatIds } } });
        for (const seat of seats) {
          await enqueueFlightEvent(tx, {
            flightId: order.scheduledFlightId,
            eventType: FLIGHT_EVENT.seatPaymentPending,
            data: {
              seatId: seat.id,
              seatIdentifier: seat.seatIdentifier,
              status: "PAYMENT_PENDING",
            },
          });
        }
        await enqueueInternalEvent(tx, {
          aggregateType: "payment",
          aggregateId: payment.id,
          eventType: INTERNAL_EVENT.paymentRequested,
          payload: { paymentId: payment.id, orderId: order.id, gatewayToken: input.gatewayToken },
        });

        return {
          replayed: false,
          payment: { id: payment.id, status: payment.status },
          order: { id: order.id, status: "PAYMENT_PENDING" },
        };
      });
    } catch (error) {
      // La clave es única en toda la tabla: si otra orden ya la usó, es una reutilización indebida.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new AppError("unprocessable", { code: "IDEMPOTENCY_KEY_REUSED", cause: error });
      }
      throw error;
    }
  }

  async loadSettlement(paymentId: string): Promise<PaymentSettlement | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { order: { include: { passengers: true } } },
    });
    if (!payment) return null;
    const seatIds = payment.order.passengers.flatMap((p) => (p.seatId ? [p.seatId] : []));
    const [seats, luggageTypes] = await Promise.all([
      this.prisma.flightSeat.findMany({ where: { id: { in: seatIds } } }),
      this.prisma.luggageType.findMany(),
    ]);
    return {
      paymentId: payment.id,
      status: payment.status,
      orderId: payment.orderId,
      flightId: payment.order.scheduledFlightId,
      amountUsd: Number(payment.amount),
      passengers: payment.order.passengers.flatMap((passenger) => {
        const seat = seats.find((item) => item.id === passenger.seatId);
        if (!seat) return [];
        const luggage = luggageTypes.find((type) => type.id === passenger.luggageTypeId);
        return [
          {
            passengerId: passenger.id,
            seatId: seat.id,
            seatClass: seat.seatClass,
            luggage: luggage
              ? {
                  id: luggage.id,
                  feePercentage: Number(luggage.feePercentage),
                  businessOnly: luggage.businessOnly,
                }
              : undefined,
          },
        ];
      }),
    };
  }

  async settleApproved(input: {
    paymentId: string;
    gatewayReference: string;
    tickets: readonly NewTicket[];
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { id: input.paymentId, status: "PENDING" },
        data: { status: "APPROVED", gatewayReference: input.gatewayReference },
      });
      if (count === 0) return false;

      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: input.paymentId },
        include: { order: true },
      });
      const order = payment.order;
      const flightId = order.scheduledFlightId;
      await tx.order.update({ where: { id: order.id }, data: { status: "CONFIRMED" } });

      // Solo un asiento PAYMENT_PENDING puede pasar a RESERVED; si no coinciden todos, se revierte todo.
      const seatIds = input.tickets.map((ticket) => ticket.seatId);
      const reserved = await tx.flightSeat.updateMany({
        where: { id: { in: seatIds }, seatStatus: "PAYMENT_PENDING" },
        data: {
          seatStatus: "RESERVED",
          heldBySession: null,
          holdExpiresAt: null,
          version: { increment: 1 },
        },
      });
      if (reserved.count !== seatIds.length) {
        throw new Error("seats are no longer in PAYMENT_PENDING; settlement rolled back");
      }

      for (const ticket of input.tickets) {
        await tx.ticket.create({
          data: {
            passengerId: ticket.passengerId,
            seatId: ticket.seatId,
            ticketCode: ticket.ticketCode,
            luggage: {
              create: ticket.luggage.map((item) => ({
                luggageTypeId: item.luggageTypeId,
                feeAppliedPercentage: new Prisma.Decimal(item.feeAppliedPercentage),
              })),
            },
          },
        });
      }

      // Cifras del vuelo tras una compra exitosa, recalculadas desde los asientos RESERVED:
      // disponibles, ocupación y precio promedio pagado por clase (alimentan el precio dinámico).
      const sold = await tx.flightSeat.groupBy({
        by: ["seatClass"],
        where: { scheduledFlightId: flightId, seatStatus: "RESERVED" },
        _avg: { seatPrice: true },
        _count: { _all: true },
      });
      const current = await tx.scheduledFlight.findUniqueOrThrow({ where: { id: flightId } });
      const totalSold = sold.reduce((sum, group) => sum + group._count._all, 0);
      const averageOf = (seatClass: "ECONOMY" | "BUSINESS"): Prisma.Decimal =>
        (
          sold.find((group) => group.seatClass === seatClass)?._avg.seatPrice ??
          new Prisma.Decimal(0)
        ).toDecimalPlaces(2);
      const available = current.numMaxSeats - totalSold;
      const soldOut = available <= 0 && current.status !== "SOLD_OUT";
      const flight = await tx.scheduledFlight.update({
        where: { id: flightId },
        data: {
          numAvailableSeats: available,
          occupancyRate: new Prisma.Decimal(((totalSold / current.numMaxSeats) * 100).toFixed(2)),
          averagePriceEconomy: averageOf("ECONOMY"),
          averagePriceBusiness: averageOf("BUSINESS"),
          ...(soldOut ? { status: "SOLD_OUT" as const } : {}),
        },
      });

      const seats = await tx.flightSeat.findMany({ where: { id: { in: seatIds } } });
      for (const seat of seats) {
        await enqueueFlightEvent(tx, {
          flightId,
          eventType: FLIGHT_EVENT.seatSold,
          data: { seatId: seat.id, seatIdentifier: seat.seatIdentifier, status: "RESERVED" },
        });
      }
      await enqueueFlightEvent(tx, {
        flightId,
        eventType: FLIGHT_EVENT.bookingConfirmed,
        data: {
          orderId: order.id,
          reservationNumber: order.reservationNumber,
          seatIds,
          numAvailableSeats: flight.numAvailableSeats,
        },
      });
      if (soldOut) {
        await enqueueFlightEvent(tx, {
          flightId,
          eventType: FLIGHT_EVENT.flightStatusChanged,
          data: { status: "SOLD_OUT", previousStatus: current.status },
        });
      }
      // Un correo por ticket, cada uno en su propio evento: si el proveedor falla se reintenta solo,
      // sin revertir la reserva ya confirmada ni reenviar los correos que sí salieron.
      for (const ticket of input.tickets) {
        await enqueueInternalEvent(tx, {
          aggregateType: "order",
          aggregateId: order.id,
          eventType: INTERNAL_EVENT.ticketEmailRequested,
          payload: { orderId: order.id, ticketCode: ticket.ticketCode },
        });
      }
      return true;
    });
  }

  async settleRejected(input: { paymentId: string; reason: string }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.payment.updateMany({
        where: { id: input.paymentId, status: "PENDING" },
        data: { status: "REJECTED" },
      });
      if (count === 0) return false;

      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: input.paymentId },
        include: { order: { include: { passengers: true } } },
      });
      const order = payment.order;
      await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });

      const seatIds = order.passengers.flatMap((p) => (p.seatId ? [p.seatId] : []));
      await tx.flightSeat.updateMany({
        where: { id: { in: seatIds }, seatStatus: "PAYMENT_PENDING" },
        data: {
          seatStatus: "FREE",
          heldBySession: null,
          holdExpiresAt: null,
          version: { increment: 1 },
        },
      });
      const seats = await tx.flightSeat.findMany({ where: { id: { in: seatIds } } });
      for (const seat of seats) {
        await enqueueFlightEvent(tx, {
          flightId: order.scheduledFlightId,
          eventType: FLIGHT_EVENT.seatReleased,
          data: {
            seatId: seat.id,
            seatIdentifier: seat.seatIdentifier,
            status: "FREE",
            reason: "payment_rejected",
            detail: input.reason,
          },
        });
      }
      return true;
    });
  }
}
