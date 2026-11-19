import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.ts";
import type { OverviewRaw } from "../../domain/entities/dashboard-overview.ts";
import type { DashboardPassenger } from "../../domain/entities/dashboard-passenger.ts";
import type { FlightMetrics, SeatCounts } from "../../domain/entities/flight-metrics.ts";
import type {
  DashboardRepository,
  FlightListPage,
  FlightListQuery,
} from "../../domain/repositories/dashboard.repository.ts";

const emptyCounts = (): SeatCounts => ({ free: 0, blocked: 0, paymentPending: 0, reserved: 0 });

function add(counts: SeatCounts, status: string, amount: number): void {
  if (status === "FREE") counts.free += amount;
  else if (status === "BLOCKED") counts.blocked += amount;
  else if (status === "PAYMENT_PENDING") counts.paymentPending += amount;
  else if (status === "RESERVED") counts.reserved += amount;
}

const TICKET_INCLUDE = {
  seat: true,
  luggage: { include: { luggageType: true } },
  passenger: { include: { order: true } },
} as const;

type TicketRow = Prisma.TicketGetPayload<{ include: typeof TICKET_INCLUDE }>;

function toPassenger(ticket: TicketRow): DashboardPassenger {
  const { passenger } = ticket;
  return {
    ticketId: ticket.id,
    ticketCode: ticket.ticketCode,
    reservationNumber: passenger.order.reservationNumber,
    fullName: passenger.fullName,
    lastName: passenger.lastName,
    documentType: passenger.documentType,
    documentNumber: passenger.documentNumber,
    passengerType: passenger.passengerType,
    isHolder: passenger.position === 0,
    seatIdentifier: ticket.seat.seatIdentifier,
    seatClass: ticket.seat.seatClass,
    luggage: ticket.luggage[0]?.luggageType.nameEs ?? null,
    contactEmail: passenger.order.contactEmail,
    contactPhone: passenger.order.contactPhone,
    checkedIn: ticket.checkIn,
    checkedInAt: ticket.checkInDate,
  };
}

export class PrismaDashboardRepository implements DashboardRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async flightMetrics(flightId: string): Promise<FlightMetrics | null> {
    // Una sola transacción de lectura: el vuelo y el conteo salen del mismo instante.
    const [flight, groups] = await this.prisma.$transaction([
      this.prisma.scheduledFlight.findUnique({
        where: { id: flightId },
        include: {
          flightRoute: { include: { fromAirport: true, destinationAirport: true } },
        },
      }),
      this.prisma.flightSeat.groupBy({
        by: ["seatClass", "seatStatus"],
        where: { scheduledFlightId: flightId },
        _count: { _all: true },
      }),
    ]);
    if (!flight) return null;

    const seats = emptyCounts();
    const economy = emptyCounts();
    const business = emptyCounts();
    for (const group of groups) {
      const amount = group._count._all;
      add(seats, group.seatStatus, amount);
      add(group.seatClass === "ECONOMY" ? economy : business, group.seatStatus, amount);
    }
    return {
      flightId: flight.id,
      status: flight.status,
      from: flight.flightRoute.fromAirport.iataCode,
      to: flight.flightRoute.destinationAirport.iataCode,
      departureDate: flight.departureDate,
      arrivalDate: flight.arrivalDate,
      numMaxSeats: flight.numMaxSeats,
      numAvailableSeats: flight.numAvailableSeats,
      occupancyRate: Number(flight.occupancyRate),
      version: flight.eventVersion,
      seats,
      byClass: { economy, business },
    };
  }

  async flightPassengers(flightId: string): Promise<DashboardPassenger[] | null> {
    const flight = await this.prisma.scheduledFlight.findUnique({
      where: { id: flightId },
      select: { id: true },
    });
    if (!flight) return null;
    const tickets = await this.prisma.ticket.findMany({
      where: { passenger: { order: { scheduledFlightId: flightId, status: "CONFIRMED" } } },
      include: TICKET_INCLUDE,
      orderBy: [{ seat: { seatRow: "asc" } }, { seat: { seatColumn: "asc" } }],
    });
    return tickets.map(toPassenger);
  }

  async setCheckIn(
    flightId: string,
    ticketId: string,
    checkedIn: boolean,
    at: Date,
  ): Promise<DashboardPassenger | null> {
    // Solo el ticket de una reserva confirmada de ese vuelo (un ticket de otro vuelo no se toca).
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        id: ticketId,
        passenger: { order: { scheduledFlightId: flightId, status: "CONFIRMED" } },
      },
      select: { id: true },
    });
    if (!ticket) return null;
    const updated = await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { checkIn: checkedIn, checkInDate: checkedIn ? at : null },
      include: TICKET_INCLUDE,
    });
    return toPassenger(updated);
  }

  async overview(range: { from: Date; to: Date }): Promise<OverviewRaw> {
    const departure = { gte: range.from, lt: range.to };
    const [flights, seatGroups, revenue, tickets] = await this.prisma.$transaction([
      this.prisma.scheduledFlight.findMany({
        where: { departureDate: departure },
        select: {
          status: true,
          departureDate: true,
          numMaxSeats: true,
          numAvailableSeats: true,
          flightRoute: { select: { routeType: true } },
        },
      }),
      this.prisma.flightSeat.groupBy({
        by: ["seatClass", "seatStatus"],
        where: { scheduledFlight: { departureDate: departure } },
        _count: { _all: true },
        orderBy: [{ seatClass: "asc" }, { seatStatus: "asc" }],
      }),
      this.prisma.order.aggregate({
        where: { status: "CONFIRMED", scheduledFlight: { departureDate: departure } },
        _sum: { totalPrice: true },
      }),
      this.prisma.ticket.count({
        where: {
          passenger: {
            order: { status: "CONFIRMED", scheduledFlight: { departureDate: departure } },
          },
        },
      }),
    ]);
    return {
      flights: flights.map((flight) => ({
        status: flight.status,
        routeType: flight.flightRoute.routeType,
        departureDate: flight.departureDate,
        numMaxSeats: flight.numMaxSeats,
        numAvailableSeats: flight.numAvailableSeats,
      })),
      classSeats: seatGroups.map((group) => ({
        seatClass: group.seatClass,
        status: group.seatStatus,
        count: group._count._all,
      })),
      sales: { tickets, revenueUsd: Number(revenue._sum.totalPrice ?? 0) },
    };
  }

  async listFlights(query: FlightListQuery): Promise<FlightListPage> {
    const where = {
      ...(query.from || query.to
        ? {
            departureDate: {
              ...(query.from ? { gte: query.from } : {}),
              ...(query.to ? { lt: query.to } : {}),
            },
          }
        : {}),
      ...(query.origin || query.destination
        ? {
            flightRoute: {
              ...(query.origin ? { fromAirport: { iataCode: query.origin } } : {}),
              ...(query.destination ? { destinationAirport: { iataCode: query.destination } } : {}),
            },
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.scheduledFlight.count({ where }),
      this.prisma.scheduledFlight.findMany({
        where,
        include: {
          flightRoute: {
            include: {
              fromAirport: { include: { city: true } },
              destinationAirport: { include: { city: true } },
            },
          },
          _count: { select: { orders: { where: { status: "CONFIRMED" } } } },
        },
        // El id desempata las salidas a la misma hora: la paginación no repite ni salta filas.
        orderBy: [{ departureDate: "asc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return {
      total,
      rows: rows.map((row) => ({
        flightId: row.id,
        status: row.status,
        routeType: row.flightRoute.routeType,
        from: row.flightRoute.fromAirport.iataCode,
        to: row.flightRoute.destinationAirport.iataCode,
        fromCity: row.flightRoute.fromAirport.city.nameEs,
        toCity: row.flightRoute.destinationAirport.city.nameEs,
        departureDate: row.departureDate,
        numMaxSeats: row.numMaxSeats,
        numAvailableSeats: row.numAvailableSeats,
        occupancyRate: Number(row.occupancyRate),
        reservations: row._count.orders,
      })),
    };
  }
}
