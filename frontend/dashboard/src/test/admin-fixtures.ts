import type { MeResponse } from "@lifex/shared";

export const staffUser = {
  publicId: "u1",
  email: "viewer@lifex.test",
  firstName: "Vera",
  lastName: "Viewer",
  countryDefault: null,
  mobilePhone: null,
  locale: "es",
  status: "ACTIVE",
  createdAt: "2026-11-01T00:00:00.000Z",
};

export const makeMe = (permissions: string[], roles = ["ADMIN_VIEWER"]): MeResponse => ({
  user: staffUser,
  roles,
  permissions,
});

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

export const problemBody = (status: number, code: string, detail: string) => ({
  type: "about:blank",
  title: code,
  status,
  code,
  detail,
});

/** jsdom no trae `matchMedia`; el sidebar de shadcn lo usa para saber si es móvil. */
export function stubMatchMedia(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

export const FLIGHT_A = "11111111-1111-4111-8111-111111111111";
export const FLIGHT_B = "22222222-2222-4222-8222-222222222222";

export const flightRow = (id: string, over: Record<string, unknown> = {}) => ({
  flightId: id,
  status: "ACTIVE",
  routeType: "DOMESTIC" as "DOMESTIC" | "INTERNATIONAL",
  from: "BOG",
  to: "MDE",
  fromCity: "Bogotá",
  toCity: "Medellín",
  departureDate: "2026-11-24T12:30:00.000Z",
  numMaxSeats: 180,
  numAvailableSeats: 150,
  occupancyRate: 16.7,
  reservations: 3,
  ...over,
});

const counts = (free: number, blocked: number, paymentPending: number, reserved: number) => ({
  free,
  blocked,
  paymentPending,
  reserved,
});

export const flightMetrics = (reserved: number, id = FLIGHT_A) => ({
  flightId: id,
  status: "ACTIVE",
  from: "BOG",
  to: "MDE",
  departureDate: "2026-11-24T12:30:00.000Z",
  arrivalDate: "2026-11-24T13:25:00.000Z",
  numMaxSeats: 180,
  numAvailableSeats: 180 - reserved,
  occupancyRate: (reserved / 180) * 100,
  version: 5,
  seats: counts(170 - reserved, 5, 5, reserved),
  byClass: {
    economy: counts(150, 3, 2, reserved),
    business: counts(20, 2, 3, 0),
  },
});

/** Respuesta de `GET /dashboard/flights` con paginación. */
export const flightsPage = (
  flights: ReturnType<typeof flightRow>[],
  over: { page?: number; pageSize?: number; total?: number } = {},
) => ({ flights, page: 1, pageSize: 20, total: flights.length, ...over });

const city = (id: number, name: string, nameEs: string, iata: string, country: string) => ({
  id,
  name,
  nameEs,
  countryIsoCode: country,
  imageName: null,
  airports: [{ id, iataCode: iata }],
});

/** Respuesta de `GET /catalog/cities` con ciudades nacionales e internacionales. */
export const CITIES = {
  cities: [
    city(1, "Bogotá", "Bogotá", "BOG", "CO"),
    city(2, "Medellín", "Medellín", "MDE", "CO"),
    city(3, "Cali", "Cali", "CLO", "CO"),
    city(4, "London", "Londres", "LHR", "GB"),
    city(5, "Madrid", "Madrid", "MAD", "ES"),
  ],
};

/** Respuesta de `GET /dashboard/overview`. */
export const overviewFixture = {
  overview: {
    date: "2026-11-24",
    flights: {
      total: 346,
      domestic: 270,
      international: 76,
      byStatus: { ACTIVE: 340, DELAYED: 4, CANCELLED: 2 },
    },
    seats: {
      total: 60000,
      sold: 3000,
      available: 57000,
      occupancyRate: 5,
      byClass: {
        economy: { total: 52000, sold: 2500, occupancyRate: 4.8 },
        business: { total: 8000, sold: 500, occupancyRate: 6.3 },
      },
      byRouteType: {
        domestic: { total: 40000, sold: 1800, occupancyRate: 4.5 },
        international: { total: 20000, sold: 1200, occupancyRate: 6 },
      },
    },
    byHour: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      domestic: hour >= 5 ? 12 : 0,
      international: hour >= 12 ? 3 : 0,
    })),
    sales: { ticketsSold: 410, revenueUsd: 125_430.5 },
    disruptions: 6,
  },
};

/** Un pasajero de `GET /dashboard/flights/:id/passengers`. */
export const passengerRow = (id: string, over: Record<string, unknown> = {}) => ({
  ticketId: id,
  ticketCode: `LX${id.slice(0, 10).toUpperCase().replaceAll("-", "")}`,
  reservationNumber: "CRBRVR",
  fullName: "Ana",
  lastName: "Gómez",
  documentType: "CC",
  documentNumber: "1234567",
  passengerType: "ADULT",
  isHolder: true,
  seatIdentifier: "12A",
  seatClass: "ECONOMY",
  luggage: "Light",
  contactEmail: "ana@example.com",
  contactPhone: "+573001112233",
  checkedIn: false,
  checkedInAt: null,
  ...over,
});

export const aircraftRow = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  internalIdentifier: `INT-00${id}`,
  reference: "Boeing 787-9",
  description: "Long-haul widebody.",
  descriptionEs: "Avión de fuselaje ancho para largo alcance.",
  typeRange: "INTERNATIONAL",
  rangeNauticalMiles: 7828,
  rangeKm: 14498,
  totalSeats: 290,
  businessSeats: 28,
  economySeats: 262,
  seatColumns: "ABCDEFGHJ",
  status: "AVAILABLE",
  upcomingFlights: 412,
  ...over,
});

export const customerRow = (email: string, over: Record<string, unknown> = {}) => ({
  email,
  name: "Ana Gómez",
  phone: "+573001112233",
  purchases: 3,
  totalUsd: 1234.5,
  lastPurchaseAt: "2026-11-20T15:30:00.000Z",
  ...over,
});

export const purchaseRow = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  reservationNumber: "CRBRVR",
  createdAt: "2026-11-20T15:30:00.000Z",
  status: "CONFIRMED",
  customerName: "Ana Gómez",
  customerEmail: "ana@example.com",
  customerPhone: "+573001112233",
  passengers: 2,
  totalUsd: 250.75,
  flight: {
    id: "11111111-1111-4111-8111-111111111111",
    routeType: "DOMESTIC",
    from: "MDE",
    to: "BOG",
    fromCity: "Medellín",
    toCity: "Bogotá",
    departureDate: "2026-12-10T14:00:00.000Z",
  },
  payment: { status: "APPROVED", cardBrand: "VISA", cardLast4: "4242" },
  ...over,
});
