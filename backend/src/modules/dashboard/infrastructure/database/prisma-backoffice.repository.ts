import { Prisma, type PrismaClient } from "../../../../generated/prisma/client.ts";
import type { AircraftRow, CustomerRow, PurchaseRow } from "../../domain/entities/backoffice.ts";
import type {
  BackofficeRepository,
  CustomerQuery,
  Page,
  PurchaseQuery,
} from "../../domain/repositories/backoffice.repository.ts";

const KM_PER_NAUTICAL_MILE = 1.852;

/** Escapa `%`, `_` y `\` para usar el texto buscado dentro de un LIKE. */
const likePattern = (text: string): string => `%${text.replace(/[\\%_]/g, "\\$&")}%`;

interface CustomerSqlRow {
  email: string;
  name: string | null;
  phone: string | null;
  purchases: number;
  total: number;
  last: Date;
}

export class PrismaBackofficeRepository implements BackofficeRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async listAircraft(now: Date): Promise<AircraftRow[]> {
    const aircraft = await this.prisma.aircraft.findMany({
      orderBy: [{ typeRange: "asc" }, { reference: "asc" }, { internalIdentifier: "asc" }],
      include: { _count: { select: { flights: { where: { departureDate: { gte: now } } } } } },
    });
    return aircraft.map((item) => ({
      id: item.id,
      internalIdentifier: item.internalIdentifier,
      reference: item.reference,
      description: item.description,
      descriptionEs: item.descriptionEs,
      typeRange: item.typeRange,
      rangeNauticalMiles: item.rangeMiles,
      rangeKm: Math.round(item.rangeMiles * KM_PER_NAUTICAL_MILE),
      totalSeats: item.maxNumberSeats,
      businessSeats: item.businessSeats,
      economySeats: item.maxNumberSeats - item.businessSeats,
      seatColumns: item.seatColumns,
      status: item.status,
      upcomingFlights: item._count.flights,
    }));
  }

  async listCustomers(query: CustomerQuery): Promise<Page<CustomerRow>> {
    const pattern = query.search ? likePattern(query.search) : null;
    const offset = (query.page - 1) * query.pageSize;
    // Los clientes no tienen cuenta: son quienes compraron, agrupados por correo de contacto (sin distinguir
    // mayúsculas). El nombre es el del titular de su última compra.
    const customers = Prisma.sql`
      WITH customers AS (
        SELECT lower(o."contactEmail") AS email,
               (array_agg(trim(coalesce(p."fullName", '') || ' ' || coalesce(p."lastName", ''))
                          ORDER BY o."createdAt" DESC))[1] AS name,
               (array_agg(o."contactPhone" ORDER BY o."createdAt" DESC))[1] AS phone,
               count(*)::int AS purchases,
               coalesce(sum(o."totalPrice"), 0)::float8 AS total,
               max(o."createdAt") AS last
        FROM "orders" o
        LEFT JOIN "passengers" p ON p."orderId" = o."id" AND p."position" = 0
        WHERE o."status" = 'CONFIRMED'
        GROUP BY lower(o."contactEmail")
      )`;
    const where = pattern
      ? Prisma.sql`WHERE email ILIKE ${pattern} ESCAPE '\\' OR name ILIKE ${pattern} ESCAPE '\\'
                   OR phone ILIKE ${pattern} ESCAPE '\\'`
      : Prisma.empty;
    const [rows, totals] = await Promise.all([
      this.prisma.$queryRaw<CustomerSqlRow[]>`${customers}
        SELECT * FROM customers ${where}
        ORDER BY last DESC, email ASC
        LIMIT ${query.pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<{ total: number }[]>`${customers}
        SELECT count(*)::int AS total FROM customers ${where}`,
    ]);
    return {
      total: totals[0]?.total ?? 0,
      rows: rows.map((row) => ({
        email: row.email,
        name: row.name ?? "",
        phone: row.phone,
        purchases: row.purchases,
        totalUsd: row.total,
        lastPurchaseAt: row.last,
      })),
    };
  }

  async listPurchases(query: PurchaseQuery): Promise<Page<PurchaseRow>> {
    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : { status: { not: "DRAFT" } }),
      ...(query.email ? { contactEmail: { equals: query.email, mode: "insensitive" } } : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: query.createdFrom } : {}),
              ...(query.createdTo ? { lt: query.createdTo } : {}),
            },
          }
        : {}),
      ...(query.origin || query.destination
        ? {
            scheduledFlight: {
              flightRoute: {
                ...(query.origin ? { fromAirport: { iataCode: query.origin } } : {}),
                ...(query.destination
                  ? { destinationAirport: { iataCode: query.destination } }
                  : {}),
              },
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { reservationNumber: { contains: query.search, mode: "insensitive" } },
              { contactEmail: { contains: query.search, mode: "insensitive" } },
              { contactPhone: { contains: query.search, mode: "insensitive" } },
              {
                passengers: {
                  some: {
                    OR: [
                      { fullName: { contains: query.search, mode: "insensitive" } },
                      { lastName: { contains: query.search, mode: "insensitive" } },
                      { documentNumber: { contains: query.search, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [total, orders] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          _count: { select: { passengers: true } },
          passengers: { where: { position: 0 }, take: 1 },
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
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
        },
      }),
    ]);
    return {
      total,
      rows: orders.map((order) => {
        const holder = order.passengers[0];
        const route = order.scheduledFlight.flightRoute;
        const payment = order.payments[0];
        return {
          id: order.id,
          reservationNumber: order.reservationNumber,
          createdAt: order.createdAt,
          status: order.status,
          customerName: holder ? `${holder.fullName} ${holder.lastName}` : "",
          customerEmail: order.contactEmail,
          customerPhone: order.contactPhone,
          passengers: order._count.passengers,
          totalUsd: Number(order.totalPrice),
          flight: {
            id: order.scheduledFlight.id,
            routeType: route.routeType,
            from: route.fromAirport.iataCode,
            to: route.destinationAirport.iataCode,
            fromCity: route.fromAirport.city.nameEs,
            toCity: route.destinationAirport.city.nameEs,
            departureDate: order.scheduledFlight.departureDate,
          },
          payment: payment
            ? { status: payment.status, cardBrand: payment.cardBrand, cardLast4: payment.cardLast4 }
            : null,
        };
      }),
    };
  }
}
