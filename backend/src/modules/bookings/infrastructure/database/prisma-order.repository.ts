import { Prisma, type PrismaClient } from "../../../../generated/prisma/client.ts";
import { AppError } from "../../../../shared/errors/app-error.ts";
import { Order } from "../../domain/entities/order.entity.ts";
import type { Passenger } from "../../domain/entities/passenger.entity.ts";
import type { BookingDetail, OrderRepository } from "../../domain/repositories/order.repository.ts";
import type { Pricing } from "../../domain/services/pricing.ts";

export class PrismaOrderRepository implements OrderRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async add(order: Order): Promise<void> {
    await this.prisma.order.create({
      data: {
        id: order.id,
        orderNumber: order.orderNumber,
        reservationNumber: order.reservationNumber,
        scheduledFlightId: order.flightId,
        contactEmail: order.contactEmail,
        contactPhone: order.contactPhone,
        locale: order.locale,
        status: order.status,
        expiresAt: order.expiresAt,
        createdAt: order.createdAt,
      },
    });
  }

  async findById(id: string): Promise<Order | null> {
    const row = await this.prisma.order.findUnique({ where: { id } });
    if (!row) return null;
    return Order.restore({
      id: row.id,
      orderNumber: row.orderNumber,
      reservationNumber: row.reservationNumber,
      flightId: row.scheduledFlightId,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      locale: row.locale === "en" ? "en" : "es",
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    });
  }

  async replacePassengers(
    orderId: string,
    passengers: readonly Passenger[],
    pricing: Pricing,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // La condición status = DRAFT va en el propio UPDATE: nadie edita una orden que ya se está pagando.
      const { count } = await tx.order.updateMany({
        where: { id: orderId, status: "DRAFT" },
        data: {
          flightPrice: new Prisma.Decimal(pricing.flightPrice),
          taxes: new Prisma.Decimal(pricing.taxes),
          totalPrice: new Prisma.Decimal(pricing.totalPrice),
        },
      });
      if (count === 0) throw new AppError("conflict", { code: "BOOKING_NOT_EDITABLE" });
      await tx.passenger.deleteMany({ where: { orderId } });
      await tx.passenger.createMany({
        data: passengers.map((passenger, position) => ({
          position,
          orderId,
          seatId: passenger.seatId,
          fullName: passenger.fullName,
          lastName: passenger.lastName,
          documentType: passenger.documentType,
          documentNumber: passenger.documentNumber,
          gender: passenger.gender,
          dateBirth: passenger.dateBirth,
          nationalityCountryId: passenger.nationalityCountryId,
          passengerType: passenger.passengerType,
          luggageTypeId: passenger.luggageTypeId,
        })),
      });
    });
  }

  async findDetail(id: string): Promise<BookingDetail | null> {
    const row = await this.prisma.order.findUnique({
      where: { id },
      include: {
        passengers: { include: { ticket: true }, orderBy: { position: "asc" } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!row) return null;
    const seatIds = row.passengers.flatMap((p) => (p.seatId ? [p.seatId] : []));
    const seats = await this.prisma.flightSeat.findMany({
      where: { id: { in: seatIds } },
      select: { id: true, seatIdentifier: true },
    });
    const payment = row.payments[0];
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      reservationNumber: row.reservationNumber,
      flightId: row.scheduledFlightId,
      status: row.status,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      expiresAt: row.expiresAt,
      pricing: {
        flightPrice: Number(row.flightPrice),
        taxes: Number(row.taxes),
        totalPrice: Number(row.totalPrice),
      },
      passengers: row.passengers.map((passenger) => ({
        id: passenger.id,
        fullName: passenger.fullName,
        lastName: passenger.lastName,
        passengerType: passenger.passengerType,
        seatId: passenger.seatId,
        seatIdentifier: seats.find((seat) => seat.id === passenger.seatId)?.seatIdentifier ?? null,
        luggageTypeId: passenger.luggageTypeId,
        ticketCode: passenger.ticket?.ticketCode ?? null,
      })),
      payment: payment ? { id: payment.id, status: payment.status } : null,
    };
  }
}
