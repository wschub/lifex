import type { PrismaClient } from "../../../../generated/prisma/client.ts";
import type {
  BookingConfirmation,
  TicketRepository,
} from "../../domain/repositories/ticket.repository.ts";

export class PrismaTicketRepository implements TicketRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async ticketExists(ticketCode: string): Promise<boolean> {
    return (await this.prisma.ticket.count({ where: { ticketCode } })) > 0;
  }

  async findConfirmation(orderId: string): Promise<BookingConfirmation | null> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, status: "CONFIRMED" },
      include: {
        scheduledFlight: {
          include: {
            flightRoute: {
              include: {
                fromAirport: { include: { city: true } },
                destinationAirport: { include: { city: true } },
              },
            },
          },
        },
        passengers: {
          orderBy: { position: "asc" },
          include: {
            ticket: { include: { seat: true, luggage: { include: { luggageType: true } } } },
          },
        },
      },
    });
    if (!order) return null;
    const route = order.scheduledFlight.flightRoute;
    return {
      orderId: order.id,
      reservationNumber: order.reservationNumber,
      contactEmail: order.contactEmail,
      locale: order.locale === "en" ? "en" : "es",
      buyerFirstName: order.passengers[0]?.fullName ?? "",
      flight: {
        id: order.scheduledFlight.id,
        fromIata: route.fromAirport.iataCode,
        fromCity: route.fromAirport.city.name,
        toIata: route.destinationAirport.iataCode,
        toCity: route.destinationAirport.city.name,
        departureDate: order.scheduledFlight.departureDate,
        arrivalDate: order.scheduledFlight.arrivalDate,
      },
      totalPriceUsd: Number(order.totalPrice),
      tickets: order.passengers.flatMap((passenger) =>
        passenger.ticket
          ? [
              {
                ticketCode: passenger.ticket.ticketCode,
                passengerFirstName: passenger.fullName,
                passengerFullName: `${passenger.fullName} ${passenger.lastName}`,
                seatIdentifier: passenger.ticket.seat.seatIdentifier,
                seatClass: passenger.ticket.seat.seatClass,
                luggage: passenger.ticket.luggage.map((item) => item.luggageType.name),
              },
            ]
          : [],
      ),
    };
  }
}
