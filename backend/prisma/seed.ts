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
  /**
   * Nombre del archivo de la foto en `frontend/public/img/destinations/`. Si se omite, se usa
   * `<nombre en inglés en minúsculas, sin tildes y con guiones>.jpg` (ver `imageNameFor`).
   */
  imageName?: string;
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
      imageName: "medellin.jpg",
    },
    { name: "Bogotá", nameEs: "Bogotá", iata: "BOG", imageName: "bogota.jpg" },
    {
      name: "Cartagena",
      nameEs: "Cartagena",
      iata: "CTG",
      imageName: "cartagena.jpg",
    },
    { name: "Santa Marta", nameEs: "Santa Marta", iata: "SMR" },
    { name: "Barranquilla", nameEs: "Barranquilla", iata: "BAQ" },
    {
      name: "San Andrés",
      nameEs: "San Andrés",
      iata: "ADZ",
      imageName: "sanandres.jpg",
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
      { name: "Miami", nameEs: "Miami", iata: "MIA", imageName: "miami.jpg" },
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
      { name: "London", nameEs: "Londres", iata: "LHR", imageName: "london.jpg" },
      { name: "Manchester", nameEs: "Mánchester", iata: "MAN" },
    ],
  },
  {
    iso: "ES",
    name: "Spain",
    nameEs: "España",
    flightMinutes: 570,
    cities: [
      { name: "Madrid", nameEs: "Madrid", iata: "MAD", imageName: "madrid.jpg" },
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

/**
 * Flota. `miles` son millas náuticas. Business siempre en filas de 4 asientos (A C D F); Economy con
 * 6 columnas (3-3) o 8 (2-4-2) y, si la capacidad no cierra en filas completas, la última fila queda
 * parcial (787-8 y 787-9) para respetar la capacidad exacta.
 *   787-8:  242 = 24 business + 218 economy (27 filas de 8 + 2)
 *   787-9:  290 = 28 business + 262 economy (32 filas de 8 + 6)
 *   737 MAX 8: 162 = 12 business + 150 economy (25 filas de 6)
 *   A320neo: 150 = 24 business + 126 economy (21 filas de 6)
 */
const AIRCRAFT = [
  ...[1, 2].map((n) => ({
    id: `INT-00${n}`,
    ref: "Boeing 787-8 Dreamliner",
    range: "INTERNATIONAL" as const,
    miles: 7850,
    seats: 242,
    business: 24,
    columns: "ABCDEFGH",
    description:
      "Long-haul widebody with a range of 14,500 km (7,850 nmi), 242 seats in two cabins.",
    descriptionEs:
      "Fuselaje ancho de largo alcance: 14.500 km (7.850 millas náuticas), 242 asientos en dos cabinas.",
  })),
  ...[3, 4].map((n) => ({
    id: `INT-00${n}`,
    ref: "Boeing 787-9",
    range: "INTERNATIONAL" as const,
    miles: 7828,
    seats: 290,
    business: 28,
    columns: "ABCDEFGH",
    description:
      "Stretched long-haul widebody, 14,498 km (7,828 nmi) range at full payload, about 290 seats in two classes.",
    descriptionEs:
      "Versión alargada de largo alcance: 14.498 km (7.828 millas náuticas) con carga completa, unos 290 asientos en dos clases.",
  })),
  ...[5, 6].map((n) => ({
    id: `INT-00${n}`,
    ref: "Boeing 737 MAX 8",
    range: "INTERNATIONAL" as const,
    miles: 3547,
    seats: 162,
    business: 12,
    columns: "ABCDEF",
    description:
      "Regional narrowbody for medium-haul international routes, 6,570 km (3,547 nmi) range, 162 seats in two classes.",
    descriptionEs:
      "Pasillo único para rutas internacionales regionales: 6.570 km (3.547 millas náuticas), 162 asientos en dos clases.",
  })),
  ...[1, 2, 3].map((n) => ({
    id: `DOM-00${n}`,
    ref: "Airbus A320neo",
    range: "DOMESTIC" as const,
    miles: 3400,
    seats: 150,
    business: 24,
    columns: "ABCDEF",
    description:
      "Domestic-only narrowbody, 3,400 nmi (about 6,300 km) range, 150 seats in two classes.",
    descriptionEs:
      "Pasillo único solo para vuelos nacionales: 3.400 millas náuticas (unos 6.300 km), 150 asientos en dos clases.",
  })),
];

const BUSINESS_COLUMNS = "ACDF";
/** Mismo valor que la variable de entorno BUSINESS_BASE_MULTIPLIER del backend. */
const BUSINESS_BASE_MULTIPLIER = Number(process.env.BUSINESS_BASE_MULTIPLIER ?? 3);
/** Velocidad de crucero para comprobar que una aeronave llega (nudos = millas náuticas por hora). */
const CRUISE_KNOTS = 450;
/** Por debajo de este alcance una aeronave se considera regional. */
const REGIONAL_MAX_RANGE_NMI = 5000;

const aircraftData = (aircraft: (typeof AIRCRAFT)[number]) => ({
  reference: aircraft.ref,
  description: aircraft.description,
  descriptionEs: aircraft.descriptionEs,
  typeRange: aircraft.range,
  rangeMiles: aircraft.miles,
  maxNumberSeats: aircraft.seats,
  businessSeats: aircraft.business,
  seatColumns: aircraft.columns,
});

/** `Panama City` → `panama-city.jpg`, `Washington D.C.` → `washington-dc.jpg`. */
function imageNameFor(city: CitySeed): string {
  if (city.imageName) return city.imageName;
  const slug = city.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug}.jpg`;
}

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
        // El upsert deja el nombre de imagen también en bases ya existentes (sin --reset).
        update: { nameEs: city.nameEs, imageName: imageNameFor(city) },
        create: {
          countryId: row.id,
          name: city.name,
          nameEs: city.nameEs,
          imageName: imageNameFor(city),
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
      update: aircraftData(aircraft),
      create: { internalIdentifier: aircraft.id, ...aircraftData(aircraft) },
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
  /** basePriceDefault del vuelo (USD): precio mínimo de partida; Business se deriva con el multiplicador. */
  economy: number;
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
  // Economy llena filas completas y, si sobran asientos, deja la última fila parcial.
  let remaining = total - business;
  for (let row = businessRows + 1; remaining > 0; row += 1) {
    for (const column of economyColumns.slice(0, remaining)) {
      seats.push({ row, column, seatClass: "ECONOMY" });
    }
    remaining -= economyColumns.length;
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
  const rotation = new Map<string, number>();

  for (const plan of plans) {
    if (plan.type === "DOMESTIC") domesticCount += 1;
    else internationalCount += 1;
    // Solo aeronaves con alcance suficiente (≈ 450 nudos de crucero); entre ellas, las regionales
    // (737 MAX 8) toman las rutas cortas y los 787 las de largo alcance.
    const base = plan.type === "DOMESTIC" ? domestic : international;
    const needed = (plan.minutes / 60) * CRUISE_KNOTS;
    const capable = base.filter((item) => item.rangeMiles >= needed);
    const regional = capable.filter((item) => item.rangeMiles < REGIONAL_MAX_RANGE_NMI);
    const pool = regional.length > 0 ? regional : capable;
    if (pool.length === 0) throw new Error(`No aircraft can fly ${plan.fromIata}-${plan.toIata}`);
    const key = pool.map((item) => item.id).join(",");
    const counter = rotation.get(key) ?? 0;
    rotation.set(key, counter + 1);
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
      // Sin ventas: ocupación y promedios en 0; basePriceDefault es el único precio de partida.
      occupancyRate: money(0),
      basePriceDefault: money(plan.economy),
      averagePriceEconomy: money(0),
      averagePriceBusiness: money(0),
    });
    for (const seat of seatLayout(plane.businessSeats, plane.seatColumns, plane.maxNumberSeats)) {
      seatRows.push({
        scheduledFlightId: id,
        seatIdentifier: `${String(seat.row).padStart(2, "0")}${seat.column}`,
        seatRow: seat.row,
        seatColumn: seat.column,
        seatClass: seat.seatClass,
        // Precio base de la clase; al bloquear, el asiento guarda el precio dinámico vigente.
        seatPrice: money(
          seat.seatClass === "BUSINESS" ? plan.economy * BUSINESS_BASE_MULTIPLIER : plan.economy,
        ),
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
