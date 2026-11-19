/**
 * Datos de prueba de Lifex (ver docs/seed-plan.md).
 *
 *   npm run db:seed            catálogo, roles, usuarios y vuelos (si ya hay vuelos, no los duplica)
 *   npm run db:seed -- --reset borra los vuelos, asientos, reservas y pagos y los vuelve a crear
 *
 * Es un script de arranque, no código de la aplicación: puede leer el entorno y usar Prisma directo.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client.ts";
import { Argon2PasswordHasher } from "../src/modules/auth/infrastructure/security/argon2-password-hasher.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not defined");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

// ───────────────────────────── Catálogo ─────────────────────────────

interface CitySeed {
  name: string;
  nameEs: string;
  iata: string;
  /** Foto de la ciudad (ruta relativa que resuelve el frontend). */
  imageUrl?: string;
}
interface CountrySeed {
  iso: string;
  name: string;
  nameEs: string;
  /** Duración estimada de vuelo desde Colombia, en minutos (internacionales). */
  flightMinutes: number;
  cities: CitySeed[];
}

const COLOMBIA: CountrySeed = {
  iso: "CO",
  name: "Colombia",
  nameEs: "Colombia",
  flightMinutes: 75,
  cities: [
    {
      name: "Medellín",
      nameEs: "Medellín",
      iata: "MDE",
      imageUrl: "/img/destinations/medellin.jpg",
    },
    { name: "Bogotá", nameEs: "Bogotá", iata: "BOG", imageUrl: "/img/destinations/bogota.jpg" },
    {
      name: "Cartagena",
      nameEs: "Cartagena",
      iata: "CTG",
      imageUrl: "/img/destinations/cartagena.jpg",
    },
    { name: "Santa Marta", nameEs: "Santa Marta", iata: "SMR" },
    { name: "Barranquilla", nameEs: "Barranquilla", iata: "BAQ" },
    {
      name: "San Andrés",
      nameEs: "San Andrés",
      iata: "ADZ",
      imageUrl: "/img/destinations/sanandres.jpg",
    },
    { name: "Cali", nameEs: "Cali", iata: "CLO" },
    { name: "Bucaramanga", nameEs: "Bucaramanga", iata: "BGA" },
    { name: "Pereira", nameEs: "Pereira", iata: "PEI" },
    { name: "Armenia", nameEs: "Armenia", iata: "AXM" },
  ],
};

const INTERNATIONAL: CountrySeed[] = [
  {
    iso: "US",
    name: "United States",
    nameEs: "Estados Unidos",
    flightMinutes: 270,
    cities: [
      { name: "Washington D.C.", nameEs: "Washington D.C.", iata: "IAD" },
      { name: "Miami", nameEs: "Miami", iata: "MIA", imageUrl: "/img/destinations/miami.jpg" },
    ],
  },
  {
    iso: "PA",
    name: "Panama",
    nameEs: "Panamá",
    flightMinutes: 100,
    cities: [{ name: "Panama City", nameEs: "Ciudad de Panamá", iata: "PTY" }],
  },
  {
    iso: "GB",
    name: "United Kingdom",
    nameEs: "Reino Unido",
    flightMinutes: 600,
    cities: [
      { name: "London", nameEs: "Londres", iata: "LHR", imageUrl: "/img/destinations/london.jpg" },
      { name: "Manchester", nameEs: "Mánchester", iata: "MAN" },
    ],
  },
  {
    iso: "ES",
    name: "Spain",
    nameEs: "España",
    flightMinutes: 570,
    cities: [
      { name: "Madrid", nameEs: "Madrid", iata: "MAD", imageUrl: "/img/destinations/madrid.jpg" },
      { name: "Barcelona", nameEs: "Barcelona", iata: "BCN" },
    ],
  },
  {
    iso: "FR",
    name: "France",
    nameEs: "Francia",
    flightMinutes: 600,
    cities: [
      { name: "Paris", nameEs: "París", iata: "CDG" },
      { name: "Nice", nameEs: "Niza", iata: "NCE" },
    ],
  },
  {
    iso: "DE",
    name: "Germany",
    nameEs: "Alemania",
    flightMinutes: 630,
    cities: [
      { name: "Berlin", nameEs: "Berlín", iata: "BER" },
      { name: "Munich", nameEs: "Múnich", iata: "MUC" },
    ],
  },
  {
    iso: "PT",
    name: "Portugal",
    nameEs: "Portugal",
    flightMinutes: 540,
    cities: [
      { name: "Lisbon", nameEs: "Lisboa", iata: "LIS" },
      { name: "Porto", nameEs: "Oporto", iata: "OPO" },
    ],
  },
  {
    iso: "BE",
    name: "Belgium",
    nameEs: "Bélgica",
    flightMinutes: 600,
    cities: [{ name: "Brussels", nameEs: "Bruselas", iata: "BRU" }],
  },
  {
    iso: "IT",
    name: "Italy",
    nameEs: "Italia",
    flightMinutes: 630,
    cities: [
      { name: "Rome", nameEs: "Roma", iata: "FCO" },
      { name: "Milan", nameEs: "Milán", iata: "MXP" },
    ],
  },
  {
    iso: "CH",
    name: "Switzerland",
    nameEs: "Suiza",
    flightMinutes: 620,
    cities: [
      { name: "Zurich", nameEs: "Zúrich", iata: "ZRH" },
      { name: "Geneva", nameEs: "Ginebra", iata: "GVA" },
    ],
  },
  {
    iso: "NL",
    name: "Netherlands",
    nameEs: "Países Bajos",
    flightMinutes: 610,
    cities: [{ name: "Amsterdam", nameEs: "Ámsterdam", iata: "AMS" }],
  },
];

const LUGGAGE = [
  { name: "Light", nameEs: "Light", rank: 1, fee: 10, businessOnly: false },
  { name: "Classic", nameEs: "Clásico", rank: 2, fee: 15, businessOnly: false },
  { name: "Flex", nameEs: "Flex", rank: 3, fee: 18, businessOnly: false },
  { name: "Business Classic", nameEs: "Business Clásico", rank: 4, fee: 20, businessOnly: true },
  { name: "Business Flex", nameEs: "Business Flex", rank: 5, fee: 25, businessOnly: true },
];

/** Aeronaves: 150 asientos (24 business + 126 economy) y 280 (40 business + 240 economy). */
const AIRCRAFT = [
  {
    id: "DOM-001",
    ref: "Airbus A320",
    range: "DOMESTIC",
    miles: 3300,
    seats: 150,
    business: 24,
    columns: "ABCDEF",
  },
  {
    id: "DOM-002",
    ref: "Airbus A320",
    range: "DOMESTIC",
    miles: 3300,
    seats: 150,
    business: 24,
    columns: "ABCDEF",
  },
  {
    id: "DOM-003",
    ref: "Airbus A320",
    range: "DOMESTIC",
    miles: 3300,
    seats: 150,
    business: 24,
    columns: "ABCDEF",
  },
  {
    id: "INT-001",
    ref: "Airbus A330-200",
    range: "INTERNATIONAL",
    miles: 7250,
    seats: 280,
    business: 40,
    columns: "ABCDEFGH",
  },
  {
    id: "INT-002",
    ref: "Airbus A330-200",
    range: "INTERNATIONAL",
    miles: 7250,
    seats: 280,
    business: 40,
    columns: "ABCDEFGH",
  },
] as const;

const BUSINESS_COLUMNS = "ACDF";

async function seedCatalog(): Promise<void> {
  for (const country of [COLOMBIA, ...INTERNATIONAL]) {
    const row = await prisma.country.upsert({
      where: { isoCode: country.iso },
      update: { name: country.name, nameEs: country.nameEs },
      create: { isoCode: country.iso, name: country.name, nameEs: country.nameEs },
    });
    for (const city of country.cities) {
      const cityRow = await prisma.city.upsert({
        where: { countryId_name: { countryId: row.id, name: city.name } },
        update: { nameEs: city.nameEs, imageUrl: city.imageUrl ?? null },
        create: {
          countryId: row.id,
          name: city.name,
          nameEs: city.nameEs,
          imageUrl: city.imageUrl ?? null,
        },
      });
      await prisma.airport.upsert({
        where: { iataCode: city.iata },
        update: { cityId: cityRow.id },
        create: { cityId: cityRow.id, iataCode: city.iata },
      });
    }
  }

  for (const item of LUGGAGE) {
    await prisma.luggageType.upsert({
      where: { name: item.name },
      update: {
        nameEs: item.nameEs,
        rank: item.rank,
        feePercentage: item.fee,
        businessOnly: item.businessOnly,
      },
      create: {
        name: item.name,
        nameEs: item.nameEs,
        rank: item.rank,
        feePercentage: item.fee,
        businessOnly: item.businessOnly,
      },
    });
  }

  for (const aircraft of AIRCRAFT) {
    await prisma.aircraft.upsert({
      where: { internalIdentifier: aircraft.id },
      update: {},
      create: {
        internalIdentifier: aircraft.id,
        reference: aircraft.ref,
        typeRange: aircraft.range,
        rangeMiles: aircraft.miles,
        maxNumberSeats: aircraft.seats,
        businessSeats: aircraft.business,
        seatColumns: aircraft.columns,
      },
    });
  }
}

// ───────────────────────────── Roles y usuarios ─────────────────────────────

const ADMIN_PERMISSIONS = ["flights:read", "flights:manage", "dashboard:read"];
const VIEWER_PERMISSIONS = ["flights:read", "dashboard:read"];
export const SEED_PASSWORD = "Lifex-Demo-2026!";

async function seedRolesAndUsers(): Promise<void> {
  const hasher = new Argon2PasswordHasher();
  const roles = [
    {
      name: "ADMIN",
      permissions: ADMIN_PERMISSIONS,
      email: "admin@lifex.test",
      firstName: "Admin",
      lastName: "Lifex",
    },
    {
      name: "ADMIN_VIEWER",
      permissions: VIEWER_PERMISSIONS,
      email: "viewer@lifex.test",
      firstName: "Viewer",
      lastName: "Lifex",
    },
  ];
  for (const item of roles) {
    // nameKey: minúsculas y separadores como "_" (igual que roleNameKey de la entidad Role).
    const nameKey = item.name
      .trim()
      .toLowerCase()
      .replaceAll(/[\s_-]+/g, "_");
    const role = await prisma.role.upsert({
      where: { nameKey },
      update: {},
      create: { name: item.name, nameKey, description: `Lifex ${item.name}` },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: item.permissions.map((permission) => ({ roleId: role.id, permission })),
    });

    const user =
      (await prisma.user.findUnique({ where: { email: item.email } })) ??
      (await prisma.user.create({
        data: {
          email: item.email,
          passwordHash: await hasher.hash(SEED_PASSWORD),
          firstName: item.firstName,
          lastName: item.lastName,
        },
      }));
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }
}

// ───────────────────────────── Vuelos ─────────────────────────────

const START = Date.UTC(2026, 10, 19); // 2026-11-19
const END = Date.UTC(2027, 0, 31); // 2027-01-31 (inclusive)
const DAY_MS = 24 * 60 * 60 * 1000;
const COLOMBIA_OFFSET_HOURS = 5;
const BATCH = 4000;

/** Hora local de Colombia → instante UTC. */
function localDeparture(dayMs: number, hour: number, minute: number): Date {
  return new Date(dayMs + (hour + COLOMBIA_OFFSET_HOURS) * 3_600_000 + minute * 60_000);
}

const money = (value: number): Prisma.Decimal => new Prisma.Decimal(value.toFixed(2));

interface FlightPlan {
  fromIata: string;
  toIata: string;
  type: "DOMESTIC" | "INTERNATIONAL";
  departure: Date;
  minutes: number;
  economy: number;
  business: number;
}

function planFlights(): FlightPlan[] {
  const domesticCities = COLOMBIA.cities.map((city) => city.iata);
  const pairs: [string, string][] = [];
  for (const from of domesticCities)
    for (const to of domesticCities) if (from !== to) pairs.push([from, to]);

  const destinations = INTERNATIONAL.flatMap((country) =>
    country.cities.map((city) => ({ iata: city.iata, minutes: country.flightMinutes })),
  );

  const plans: FlightPlan[] = [];
  const days = Math.round((END - START) / DAY_MS) + 1; // 74
  const domesticSlots = [
    [7, 30],
    [13, 30],
    [19, 30],
  ] as const;
  const internationalSlots = [
    [14, 30],
    [22, 30],
  ] as const;

  for (let day = 0; day < days; day += 1) {
    const dayMs = START + day * DAY_MS;
    domesticSlots.forEach(([hour, minute], slot) => {
      const pairIndex = (day * 3 + slot) % pairs.length;
      const [fromIata, toIata] = pairs[pairIndex] as [string, string];
      plans.push({
        fromIata,
        toIata,
        type: "DOMESTIC",
        departure: localDeparture(dayMs, hour, minute),
        minutes: 60 + (pairIndex % 4) * 10,
        economy: 80 + (pairIndex % 8) * 10,
        business: 200 + (pairIndex % 6) * 20,
      });
    });
    internationalSlots.forEach(([hour, minute], slot) => {
      const destination = destinations[
        (day * 2 + slot) % destinations.length
      ] as (typeof destinations)[number];
      const destinationIndex = (day * 2 + slot) % destinations.length;
      plans.push({
        fromIata: day % 2 === 0 ? "MDE" : "BOG",
        toIata: destination.iata,
        type: "INTERNATIONAL",
        departure: localDeparture(dayMs, hour, minute),
        minutes: destination.minutes,
        economy: 400 + (destinationIndex % 10) * 50,
        business: 1200 + (destinationIndex % 10) * 130,
      });
    });
  }
  return plans;
}

interface SeatLayout {
  row: number;
  column: string;
  seatClass: "ECONOMY" | "BUSINESS";
}

function seatLayout(business: number, economyColumns: string, total: number): SeatLayout[] {
  const seats: SeatLayout[] = [];
  const businessRows = business / BUSINESS_COLUMNS.length;
  for (let row = 1; row <= businessRows; row += 1) {
    for (const column of BUSINESS_COLUMNS) seats.push({ row, column, seatClass: "BUSINESS" });
  }
  const economyRows = (total - business) / economyColumns.length;
  for (let row = businessRows + 1; row <= businessRows + economyRows; row += 1) {
    for (const column of economyColumns) seats.push({ row, column, seatClass: "ECONOMY" });
  }
  return seats;
}

async function resetFlights(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "outbox_events", "ticket_luggage", "tickets", "payments", "passengers", "orders", "flights_seat_availability", "scheduled_flights" CASCADE',
  );
}

async function seedFlights(): Promise<void> {
  const airports = await prisma.airport.findMany();
  const airportId = new Map(airports.map((airport) => [airport.iataCode.trim(), airport.id]));
  const aircraft = await prisma.aircraft.findMany({ orderBy: { id: "asc" } });
  const domestic = aircraft.filter((item) => item.typeRange === "DOMESTIC");
  const international = aircraft.filter((item) => item.typeRange === "INTERNATIONAL");

  const plans = planFlights();
  const routeKeys = new Map<
    string,
    { type: "DOMESTIC" | "INTERNATIONAL"; from: number; to: number }
  >();
  for (const plan of plans) {
    routeKeys.set(`${plan.fromIata}-${plan.toIata}`, {
      type: plan.type,
      from: airportId.get(plan.fromIata) as number,
      to: airportId.get(plan.toIata) as number,
    });
  }
  await prisma.flightRoute.createMany({
    data: [...routeKeys.values()].map((route) => ({
      routeType: route.type,
      fromAirportId: route.from,
      destinationAirportId: route.to,
    })),
    skipDuplicates: true,
  });
  const routes = await prisma.flightRoute.findMany();
  const routeId = (fromIata: string, toIata: string): number =>
    routes.find(
      (route) =>
        route.fromAirportId === airportId.get(fromIata) &&
        route.destinationAirportId === airportId.get(toIata),
    )?.id as number;

  const flightRows: Prisma.ScheduledFlightCreateManyInput[] = [];
  const seatRows: Prisma.FlightSeatCreateManyInput[] = [];
  let domesticCount = 0;
  let internationalCount = 0;

  for (const plan of plans) {
    const pool = plan.type === "DOMESTIC" ? domestic : international;
    const counter = plan.type === "DOMESTIC" ? domesticCount++ : internationalCount++;
    const plane = pool[counter % pool.length] as (typeof pool)[number];
    const id = crypto.randomUUID();
    flightRows.push({
      id,
      flightRouteId: routeId(plan.fromIata, plan.toIata),
      aircraftId: plane.id,
      departureDate: plan.departure,
      arrivalDate: new Date(plan.departure.getTime() + plan.minutes * 60_000),
      numMaxSeats: plane.maxNumberSeats,
      numAvailableSeats: plane.maxNumberSeats,
      basePriceDefault: money(plan.economy),
      averagePriceEconomy: money(plan.economy),
      averagePriceBusiness: money(plan.business),
    });
    for (const seat of seatLayout(plane.businessSeats, plane.seatColumns, plane.maxNumberSeats)) {
      seatRows.push({
        scheduledFlightId: id,
        seatIdentifier: `${String(seat.row).padStart(2, "0")}${seat.column}`,
        seatRow: seat.row,
        seatColumn: seat.column,
        seatClass: seat.seatClass,
        seatPrice: money(seat.seatClass === "BUSINESS" ? plan.business : plan.economy),
      });
    }
  }

  for (let index = 0; index < flightRows.length; index += BATCH) {
    await prisma.scheduledFlight.createMany({ data: flightRows.slice(index, index + BATCH) });
  }
  for (let index = 0; index < seatRows.length; index += BATCH) {
    await prisma.flightSeat.createMany({ data: seatRows.slice(index, index + BATCH) });
  }
  console.log(
    `Flights: ${flightRows.length} (${domesticCount} domestic, ${internationalCount} international)`,
  );
  console.log(`Seats:   ${seatRows.length}`);
}

try {
  const reset = process.argv.includes("--reset");
  await seedCatalog();
  await seedRolesAndUsers();
  if (reset) await resetFlights();
  if ((await prisma.scheduledFlight.count()) === 0) {
    await seedFlights();
  } else {
    console.log("Flights already seeded (use --reset to recreate them).");
  }
  console.log(`Users: admin@lifex.test / viewer@lifex.test  (password: ${SEED_PASSWORD})`);
} finally {
  await prisma.$disconnect();
}
