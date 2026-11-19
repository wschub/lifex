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
  from: "BOG",
  to: "MDE",
  departureDate: "2026-11-24T12:30:00.000Z",
  numMaxSeats: 180,
  numAvailableSeats: 150,
  occupancyRate: 16.7,
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
