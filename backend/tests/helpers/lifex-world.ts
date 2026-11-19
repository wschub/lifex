import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { composeApp, type CompositionOverrides } from "../../src/composition.ts";
import { loadEnv } from "../../src/config/env.ts";
import { Prisma } from "../../src/generated/prisma/client.ts";
import { Argon2PasswordHasher } from "../../src/modules/auth/infrastructure/security/argon2-password-hasher.ts";
import type {
  FlightDisruption,
  NotificationPort,
} from "../../src/modules/tickets/application/ports/notification.port.ts";
import type {
  BookingConfirmation,
  TicketView,
} from "../../src/modules/tickets/domain/repositories/ticket.repository.ts";
import { startServer } from "../../src/shared/http/start-server.ts";
import { startTestDatabase, type TestDatabase } from "./postgres.ts";

export const STAFF_PASSWORD = "una-clave-bastante-larga";
export const GOOD_CARD = "4242 4242 4242 4242";
export const DECLINED_CARD = "4000 0000 0000 0002";
export const TIMEOUT_CARD = "4000 0000 0000 9995";

/** Doble del correo: registra lo enviado y puede fallar a demanda. */
export class RecordingNotifier implements NotificationPort {
  readonly tickets: { confirmation: BookingConfirmation; ticket: TicketView }[] = [];
  readonly disruptions: { confirmation: BookingConfirmation; disruption: FlightDisruption }[] = [];
  failing = false;

  async sendTicketConfirmation(
    confirmation: BookingConfirmation,
    ticket: TicketView,
  ): Promise<void> {
    if (this.failing) throw new Error("mail provider down");
    this.tickets.push({ confirmation, ticket });
  }

  async sendFlightDisruption(
    confirmation: BookingConfirmation,
    disruption: FlightDisruption,
  ): Promise<void> {
    if (this.failing) throw new Error("mail provider down");
    this.disruptions.push({ confirmation, disruption });
  }
}

/**
 * Reloj controlado: sigue al reloj real (la base de datos usa now() para los reintentos del outbox)
 * y las pruebas de expiración lo adelantan en vez de esperar.
 */
export class TestClock {
  private offsetMs = 0;

  get current(): Date {
    return this.now();
  }

  readonly now = (): Date => new Date(Date.now() + this.offsetMs);

  advanceMinutes(minutes: number): void {
    this.offsetMs += minutes * 60_000;
  }

  advanceSeconds(seconds: number): void {
    this.offsetMs += seconds * 1000;
  }
}

export interface WorldOptions {
  env?: Record<string, string>;
  overrides?: CompositionOverrides;
  /** Arranca un servidor HTTP real (necesario para WebSocket). */
  listen?: boolean;
}

/** Vuelo de prueba: 4 asientos BUSINESS (fila 1) y 8 ECONOMY (filas 2–3). */
export async function createWorld(options: WorldOptions = {}) {
  const db: TestDatabase = await startTestDatabase();
  const clock = new TestClock();
  const notifier = new RecordingNotifier();
  const env = loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: db.url,
    JWT_ACCESS_SECRET: "0123456789abcdef0123456789abcdef-lifex",
    LOG_LEVEL: "silent",
    MAX_HELD_SEATS_PER_SESSION: "3",
    OUTBOX_MAX_ATTEMPTS: "3",
    ...options.env,
  });
  const composed = composeApp(env, {
    now: clock.now,
    notifier,
    ...options.overrides,
  });
  const { prisma } = db;

  // ── Catálogo y vuelo ──
  const country = await prisma.country.create({
    data: { isoCode: "CO", name: "Colombia", nameEs: "Colombia" },
  });
  const [medellin, bogota] = await Promise.all(
    [
      ["Medellín", "/img/destinations/medellin.jpg"],
      ["Bogotá", null],
    ].map(([name, imageUrl]) =>
      prisma.city.create({
        data: { countryId: country.id, name: name!, nameEs: name!, imageUrl },
      }),
    ),
  );
  const [mde, bog] = await Promise.all(
    [
      [medellin!.id, "MDE"],
      [bogota!.id, "BOG"],
    ].map(([cityId, iataCode]) =>
      prisma.airport.create({ data: { cityId: cityId as number, iataCode: iataCode as string } }),
    ),
  );
  await prisma.luggageType.createMany({
    data: [
      { name: "Light", nameEs: "Light", rank: 1, feePercentage: 10, businessOnly: false },
      {
        name: "Business Flex",
        nameEs: "Business Flex",
        rank: 5,
        feePercentage: 25,
        businessOnly: true,
      },
    ],
  });
  const aircraft = await prisma.aircraft.create({
    data: {
      internalIdentifier: "TST-001",
      reference: "Test jet",
      typeRange: "DOMESTIC",
      rangeMiles: 1000,
      maxNumberSeats: 12,
      businessSeats: 4,
      seatColumns: "ABCD",
    },
  });
  const route = await prisma.flightRoute.create({
    data: { routeType: "DOMESTIC", fromAirportId: mde!.id, destinationAirportId: bog!.id },
  });

  const createFlight = async (
    departure: Date,
    status: "ACTIVE" | "FINALIZED" = "ACTIVE",
    overrides: {
      averagePriceEconomy?: number;
      averagePriceBusiness?: number;
      numAvailableSeats?: number;
      occupancyRate?: number;
      basePriceDefault?: number;
    } = {},
  ) => {
    const flight = await prisma.scheduledFlight.create({
      data: {
        flightRouteId: route.id,
        aircraftId: aircraft.id,
        departureDate: departure,
        arrivalDate: new Date(departure.getTime() + 3_600_000),
        numMaxSeats: 12,
        numAvailableSeats: overrides.numAvailableSeats ?? 12,
        occupancyRate: new Prisma.Decimal(overrides.occupancyRate ?? 0),
        basePriceDefault: new Prisma.Decimal(overrides.basePriceDefault ?? 100),
        averagePriceEconomy: new Prisma.Decimal(overrides.averagePriceEconomy ?? 100),
        averagePriceBusiness: new Prisma.Decimal(overrides.averagePriceBusiness ?? 300),
        status,
      },
    });
    const seats: Prisma.FlightSeatCreateManyInput[] = [];
    for (const column of "ACDF") {
      seats.push({
        scheduledFlightId: flight.id,
        seatIdentifier: `01${column}`,
        seatRow: 1,
        seatColumn: column,
        seatClass: "BUSINESS",
        seatPrice: new Prisma.Decimal(300),
      });
    }
    for (const row of [2, 3]) {
      for (const column of "ABCD") {
        seats.push({
          scheduledFlightId: flight.id,
          seatIdentifier: `0${row}${column}`,
          seatRow: row,
          seatColumn: column,
          seatClass: "ECONOMY",
          seatPrice: new Prisma.Decimal(100),
        });
      }
    }
    await prisma.flightSeat.createMany({ data: seats });
    return flight;
  };
  // 90 días adelante a las 10:00 de Colombia: fuera de la ventana de ofertas (8-30 días) y de las
  // últimas 72 h, así el precio dinámico de las pruebas no depende de la fecha real de hoy.
  const today = new Date();
  const flightDeparture = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 90, 15),
  );
  const flightDate = flightDeparture.toISOString().slice(0, 10);
  const flight = await createFlight(flightDeparture);

  // ── Staff ──
  const hasher = new Argon2PasswordHasher();
  const passwordHash = await hasher.hash(STAFF_PASSWORD);
  const staff: Record<string, string> = {};
  for (const [name, permissions] of Object.entries({
    admin: ["flights:read", "flights:manage", "dashboard:read"],
    viewer: ["flights:read", "dashboard:read"],
    nobody: [],
  })) {
    const role = await prisma.role.create({
      data: {
        name: name.toUpperCase(),
        nameKey: name,
        permissions: { create: permissions.map((permission) => ({ permission })) },
      },
    });
    const user = await prisma.user.create({
      data: {
        email: `${name}@lifex.test`,
        passwordHash,
        firstName: name,
        lastName: "Test",
        roles: { create: { roleId: role.id } },
      },
    });
    const login = await request(composed.app)
      .post("/auth/login")
      .send({ email: user.email, password: STAFF_PASSWORD });
    staff[name] = `Bearer ${String(login.body.accessToken)}`;
  }

  let server: Server | undefined;
  let port = 0;
  if (options.listen) {
    server = await startServer(composed.app, 0);
    port = (server.address() as AddressInfo).port;
    composed.realtime.attach(server);
  }

  const seatId = async (identifier: string, flightId = flight.id): Promise<string> =>
    (
      await prisma.flightSeat.findFirstOrThrow({
        where: { scheduledFlightId: flightId, seatIdentifier: identifier },
      })
    ).id;

  /** Inicia una reserva de invitado y devuelve su cabecera de autenticación. */
  const startBooking = async (flightId = flight.id, email = "cliente@example.com") => {
    const res = await request(composed.app)
      .post("/bookings")
      .send({ flightId, contactEmail: email });
    if (res.status !== 201)
      throw new Error(`startBooking failed: ${res.status} ${JSON.stringify(res.body)}`);
    return { id: String(res.body.booking.id), auth: `Bearer ${String(res.body.token)}` };
  };

  const hold = (booking: { auth: string }, identifierSeatId: string, flightId = flight.id) =>
    request(composed.app)
      .post(`/flights/${flightId}/seats/${identifierSeatId}/hold`)
      .set("Authorization", booking.auth);

  const passenger = (seat: string, extra: Record<string, unknown> = {}) => ({
    fullName: "Ana",
    lastName: "Gómez",
    documentType: "CC",
    documentNumber: "1234567",
    gender: "FEMENINO",
    dateBirth: "1990-05-01",
    nationalityCountryId: country.id,
    seatId: seat,
    ...extra,
  });

  const setPassengers = (booking: { id: string; auth: string }, passengers: unknown[]) =>
    request(composed.app)
      .put(`/bookings/${booking.id}/passengers`)
      .set("Authorization", booking.auth)
      .send({ passengers });

  const pay = (
    booking: { id: string; auth: string },
    key: string | undefined,
    cardNumber = GOOD_CARD,
  ) => {
    const req = request(composed.app)
      .post(`/bookings/${booking.id}/payments`)
      .set("Authorization", booking.auth);
    if (key) req.set("Idempotency-Key", key);
    return req.send({
      card: {
        number: cardNumber,
        holderName: "ANA GOMEZ",
        expMonth: 12,
        expYear: 2035,
        cvv: "123",
      },
    });
  };

  /** Procesa el outbox hasta vaciarlo (con reintentos adelantando el reloj). */
  const drainOutbox = async (rounds = 6) => {
    for (let round = 0; round < rounds; round += 1) {
      await composed.processOutbox.execute();
      clock.advanceSeconds(90);
    }
  };

  return {
    db,
    prisma,
    app: composed.app,
    composed,
    clock,
    notifier,
    flight,
    /** AAAA-MM-DD del vuelo base en hora de Colombia (el mismo día en UTC: sale a las 15:00Z). */
    flightDate,
    country,
    staff,
    port,
    createFlight,
    seatId,
    startBooking,
    hold,
    passenger,
    setPassengers,
    pay,
    drainOutbox,
    async stop() {
      await composed.realtime.close();
      await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
      await composed.shutdown();
      await db.stop();
    },
  };
}

export type World = Awaited<ReturnType<typeof createWorld>>;
