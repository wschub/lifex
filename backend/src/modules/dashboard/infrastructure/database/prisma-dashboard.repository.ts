import type { PrismaClient } from "../../../../generated/prisma/client.ts";
import type {
  DashboardFlightRow,
  FlightMetrics,
  SeatCounts,
} from "../../domain/entities/flight-metrics.ts";
import type { DashboardRepository } from "../../domain/repositories/dashboard.repository.ts";

const emptyCounts = (): SeatCounts => ({ free: 0, blocked: 0, paymentPending: 0, reserved: 0 });

function add(counts: SeatCounts, status: string, amount: number): void {
  if (status === "FREE") counts.free += amount;
  else if (status === "BLOCKED") counts.blocked += amount;
  else if (status === "PAYMENT_PENDING") counts.paymentPending += amount;
  else if (status === "RESERVED") counts.reserved += amount;
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

  async listFlights(query: { from: Date; to: Date; limit: number }): Promise<DashboardFlightRow[]> {
    const rows = await this.prisma.scheduledFlight.findMany({
      where: { departureDate: { gte: query.from, lt: query.to } },
      include: { flightRoute: { include: { fromAirport: true, destinationAirport: true } } },
      orderBy: { departureDate: "asc" },
      take: query.limit,
    });
    return rows.map((row) => ({
      flightId: row.id,
      status: row.status,
      from: row.flightRoute.fromAirport.iataCode,
      to: row.flightRoute.destinationAirport.iataCode,
      departureDate: row.departureDate,
      numMaxSeats: row.numMaxSeats,
      numAvailableSeats: row.numAvailableSeats,
      occupancyRate: Number(row.occupancyRate),
    }));
  }
}
