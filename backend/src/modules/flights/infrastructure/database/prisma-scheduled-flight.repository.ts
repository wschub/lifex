import type { Prisma, PrismaClient } from "../../../../generated/prisma/client.ts";
import {
  enqueueFlightEvent,
  enqueueInternalEvent,
  FLIGHT_EVENT,
  INTERNAL_EVENT,
} from "../../../../shared/outbox/flight-events.ts";
import {
  type AirportInfo,
  type FlightListing,
  type FlightStatus,
  ScheduledFlight,
  SEARCHABLE_STATUSES,
} from "../../domain/entities/scheduled-flight.entity.ts";
import type {
  FlightSearchQuery,
  ScheduledFlightRepository,
} from "../../domain/repositories/scheduled-flight.repository.ts";

const LISTING_INCLUDE = {
  aircraft: false,
  flightRoute: {
    include: {
      fromAirport: { include: { city: { include: { country: true } } } },
      destinationAirport: { include: { city: { include: { country: true } } } },
    },
  },
} satisfies Prisma.ScheduledFlightInclude;

type FlightRow = Prisma.ScheduledFlightGetPayload<{ include: typeof LISTING_INCLUDE }>;
type AirportRow = FlightRow["flightRoute"]["fromAirport"];

function toAirportInfo(airport: AirportRow): AirportInfo {
  return {
    iataCode: airport.iataCode,
    city: airport.city.name,
    cityEs: airport.city.nameEs,
    cityImageName: airport.city.imageName,
    country: airport.city.country.name,
    countryEs: airport.city.country.nameEs,
  };
}

function toListing(
  row: FlightRow,
  availableByClass: FlightListing["availableByClass"],
): FlightListing {
  return {
    id: row.id,
    flightRouteId: row.flightRouteId,
    routeType: row.flightRoute.routeType,
    from: toAirportInfo(row.flightRoute.fromAirport),
    to: toAirportInfo(row.flightRoute.destinationAirport),
    departureDate: row.departureDate,
    arrivalDate: row.arrivalDate,
    status: row.status,
    numMaxSeats: row.numMaxSeats,
    numAvailableSeats: row.numAvailableSeats,
    occupancyRate: Number(row.occupancyRate),
    basePriceDefault: Number(row.basePriceDefault),
    averagePriceEconomy: Number(row.averagePriceEconomy),
    averagePriceBusiness: Number(row.averagePriceBusiness),
    availableByClass,
  };
}

export class PrismaScheduledFlightRepository implements ScheduledFlightRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async search(query: FlightSearchQuery): Promise<FlightListing[]> {
    const rows = await this.prisma.scheduledFlight.findMany({
      where: {
        status: { in: [...SEARCHABLE_STATUSES] },
        departureDate: { gte: query.dayStart, lt: query.dayEnd },
        flightRoute: {
          fromAirport: { iataCode: query.fromIata },
          destinationAirport: { iataCode: query.toIata },
        },
      },
      include: LISTING_INCLUDE,
      orderBy: { departureDate: "asc" },
    });
    return this.attachAvailability(rows);
  }

  async findOfferCandidates(from: Date, to: Date): Promise<FlightListing[]> {
    const rows = await this.prisma.scheduledFlight.findMany({
      where: { status: "ACTIVE", departureDate: { gte: from, lte: to } },
      include: LISTING_INCLUDE,
      orderBy: { departureDate: "asc" },
    });
    // Son miles de vuelos: los asientos libres por clase solo se cuentan para los elegidos (withAvailability).
    return rows.map((row) => toListing(row, { economy: 0, business: 0 }));
  }

  async withAvailability(listings: FlightListing[]): Promise<FlightListing[]> {
    if (listings.length === 0) return [];
    const free = await this.freeSeatsByClass(listings.map((listing) => listing.id));
    return listings.map((listing) => ({
      ...listing,
      availableByClass: free(listing.id),
    }));
  }

  async findListing(id: string): Promise<FlightListing | null> {
    const row = await this.prisma.scheduledFlight.findUnique({
      where: { id },
      include: LISTING_INCLUDE,
    });
    if (!row) return null;
    const [listing] = await this.attachAvailability([row]);
    return listing ?? null;
  }

  async findById(id: string): Promise<ScheduledFlight | null> {
    const row = await this.prisma.scheduledFlight.findUnique({ where: { id } });
    if (!row) return null;
    return ScheduledFlight.restore({
      id: row.id,
      departureDate: row.departureDate,
      arrivalDate: row.arrivalDate,
      status: row.status,
    });
  }

  async updateStatus(id: string, status: FlightStatus): Promise<{ previous: FlightStatus }> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.scheduledFlight.findUniqueOrThrow({
        where: { id },
        select: { status: true },
      });
      await tx.scheduledFlight.update({ where: { id }, data: { status } });
      await enqueueFlightEvent(tx, {
        flightId: id,
        eventType: FLIGHT_EVENT.flightStatusChanged,
        data: { status, previousStatus: current.status },
      });
      // Cancelado o retrasado por el admin: se avisa por correo a cada orden ya pagada de este vuelo.
      // Los eventos se escriben en la misma transacción que el cambio de estado.
      if (status === "CANCELLED" || status === "DELAYED") {
        const orders = await tx.order.findMany({
          where: { scheduledFlightId: id, status: "CONFIRMED" },
          select: { id: true },
        });
        for (const order of orders) {
          await enqueueInternalEvent(tx, {
            aggregateType: "order",
            aggregateId: order.id,
            eventType: INTERNAL_EVENT.flightDisruptionEmailRequested,
            payload: { orderId: order.id, flightId: id, status },
          });
        }
      }
      return { previous: current.status };
    });
  }

  private async attachAvailability(rows: FlightRow[]): Promise<FlightListing[]> {
    if (rows.length === 0) return [];
    const free = await this.freeSeatsByClass(rows.map((row) => row.id));
    return rows.map((row) => toListing(row, free(row.id)));
  }

  /** Asientos libres por clase de cada vuelo (una sola consulta agrupada). */
  private async freeSeatsByClass(
    flightIds: string[],
  ): Promise<(flightId: string) => { economy: number; business: number }> {
    const free = await this.prisma.flightSeat.groupBy({
      by: ["scheduledFlightId", "seatClass"],
      where: { scheduledFlightId: { in: flightIds }, seatStatus: "FREE" },
      _count: { _all: true },
    });
    return (flightId) => {
      const count = (seatClass: "ECONOMY" | "BUSINESS"): number =>
        free.find((item) => item.scheduledFlightId === flightId && item.seatClass === seatClass)
          ?._count._all ?? 0;
      return { economy: count("ECONOMY"), business: count("BUSINESS") };
    };
  }
}
