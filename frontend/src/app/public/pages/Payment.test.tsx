import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import { useWizard, type PassengerForm } from "@/stores/booking-wizard.ts";
import { mockApi } from "@/test/api-mock.ts";
import { renderRoutes } from "@/test/render.tsx";
import type { WsClient } from "@/ws/client.ts";
import { Payment, validateCard } from "./Payment.tsx";

vi.mock("@/ws/shared-client.ts", () => ({
  getWsClient: () => ({ subscribe: () => () => {}, close: () => {} }) as unknown as WsClient,
}));

const FLIGHT_ID = "11111111-1111-4111-8111-111111111111";
const BOOKING_ID = "33333333-3333-4333-8333-333333333333";
const airport = (iataCode: string) => ({
  iataCode,
  city: iataCode,
  cityEs: iataCode,
  country: "X",
  countryEs: "X",
  cityImageUrl: null,
});
const FLIGHT = {
  id: FLIGHT_ID,
  routeType: "DOMESTIC",
  from: airport("BOG"),
  to: airport("MDE"),
  departureDate: "2026-11-21T12:30:00.000Z",
  arrivalDate: "2026-11-21T13:35:00.000Z",
  status: "ACTIVE",
  basePriceUsd: 100,
  averagePriceEconomyUsd: 100,
  averagePriceBusinessUsd: 300,
  numAvailableSeats: 8,
  availableByClass: { economy: 6, business: 2 },
  soldOut: false,
};
const order = (status: string, payment: { status: string } | null = null) => ({
  booking: {
    id: BOOKING_ID,
    orderNumber: "LX-1",
    reservationNumber: "ABC123",
    flightId: FLIGHT_ID,
    status,
    contactEmail: "a@b.co",
    contactPhone: null,
    expiresAt: "2026-11-21T13:00:00.000Z",
    flightPriceUsd: 110,
    taxesUsd: 20.9,
    totalPriceUsd: 130.9,
    passengers: [],
    payment: payment ? { id: "44444444-4444-4444-8444-444444444444", ...payment } : null,
  },
});
const person: PassengerForm = {
  ok: true,
  g: "f",
  first: "Ana",
  last: "Gómez",
  dd: 3,
  dm: 4,
  dy: 1990,
  nat: "7",
  docType: "CC",
  docNumber: "1234",
  hasLx: false,
  lx: "",
  assist: false,
};
const held = (ms = 600_000) => ({
  seatId: "aaaaaaaa-aaaa-4aaa-8aaa-000000000005",
  identifier: "02A",
  seatClass: "ECONOMY" as const,
  priceUsd: 100,
  holdExpiresAt: new Date(Date.now() + ms).toISOString(),
});

let bookingState = order("DRAFT");
const payKeys: (string | null)[] = [];
let failFirstPost = false;
let posts = 0;

function setup() {
  mockApi({
    [`GET /flights/${FLIGHT_ID}`]: { flight: FLIGHT },
    "GET /catalog/luggage-types": {
      luggageTypes: [
        { id: 1, name: "Light", nameEs: "Light", rank: 1, feePercentage: 10, businessOnly: false },
      ],
    },
    [`GET /bookings/${BOOKING_ID}`]: () => bookingState,
    [`POST /bookings/${BOOKING_ID}/payments`]: (_u: URL, init?: RequestInit) => {
      posts += 1;
      payKeys.push((init?.headers as Headers).get("Idempotency-Key"));
      if (failFirstPost && posts === 1) throw new TypeError("network down");
      bookingState = order("PAYMENT_PENDING", { status: "PENDING" });
      return {
        payment: { id: "44444444-4444-4444-8444-444444444444", status: "PENDING" },
        booking: { id: BOOKING_ID, status: "PAYMENT_PENDING" },
      };
    },
  });
  return renderRoutes(
    [
      { path: "/payment", element: <Payment /> },
      { path: "/confirmation", element: <div>confirmation page</div> },
      { path: "/seats", element: <div>seats page</div> },
      { path: "/passengers", element: <div>passengers page</div> },
      { path: "/customize", element: <div>customize page</div> },
    ],
    ["/payment"],
  );
}

const byId = (id: string) => document.getElementById(id) as HTMLInputElement;

async function fillCard(user: ReturnType<typeof userEvent.setup>, number = "4242424242424242") {
  await screen.findByText("Número de tarjeta");
  await user.type(byId("cn"), number);
  await user.type(byId("cname"), "Ana Gomez");
  await user.type(byId("cexp"), "1230");
  await user.type(byId("ccvv"), "123");
}

beforeEach(() => {
  bookingState = order("DRAFT");
  payKeys.length = 0;
  failFirstPost = false;
  posts = 0;
  useLangStore.setState({ lang: "es" });
  useWizard.getState().reset();
  useWizard.setState({
    flightId: FLIGHT_ID,
    fareId: "light",
    luggageTypeId: 1,
    cabin: "economy",
    search: { from: "BOG", to: "MDE", date: "2026-11-21", pax: 1 },
    passengers: [person],
    holder: {
      ok: true,
      p: 0,
      pre: "+57",
      ph: "3001234567",
      em: "a@b.co",
      em2: "a@b.co",
      c1: true,
      c2: false,
    },
    booking: {
      id: BOOKING_ID,
      token: "tok",
      expiresAt: "2026-11-21T13:00:00.000Z",
      contactEmail: "a@b.co",
      contactPhone: "+57300",
    },
    seats: [held()],
  });
});

describe("validateCard", () => {
  it("valida número, nombre, vencimiento y código", () => {
    expect(
      validateCard({ number: "4242 4242 4242 4242", name: "A", exp: "12/30", cvv: "123" }),
    ).toEqual({});
    expect(validateCard({ number: "12", name: " ", exp: "13/30", cvv: "1" })).toEqual({
      cn: "card",
      cname: "req",
      cexp: "exp",
      ccvv: "cvv",
    });
  });
});

describe("Payment", () => {
  it("muestra el total de la reserva con los valores del backend", async () => {
    setup();
    // 130.9 USD × 3300 = 431.970 COP
    expect(await screen.findAllByText("COP 431.970")).not.toHaveLength(0);
    expect(screen.getByText("COP 363.000")).toBeInTheDocument(); // 110 × 3300 (precio de tiquetes)
  });

  it("doble clic en Pagar envía una sola petición y no guarda la tarjeta en el navegador", async () => {
    setup();
    const user = userEvent.setup();
    await fillCard(user);
    const pay = await screen.findByRole("button", { name: /pagar/i });
    await waitFor(() => expect(pay).toBeEnabled());
    await user.dblClick(pay);
    await waitFor(() => expect(posts).toBe(1));
    expect(JSON.stringify(sessionStorage) + JSON.stringify(localStorage)).not.toMatch(
      /4242|123"|cvv/,
    );
    expect(JSON.stringify(useWizard.getState())).not.toMatch(/4242424242424242/);
  });

  it("un reintento tras un corte de red reutiliza la misma Idempotency-Key", async () => {
    failFirstPost = true;
    setup();
    const user = userEvent.setup();
    await fillCard(user);
    const pay = await screen.findByRole("button", { name: /pagar/i });
    await waitFor(() => expect(pay).toBeEnabled());
    await user.click(pay);
    expect(await screen.findByText(/no hay conexión/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /pagar/i }));
    await waitFor(() => expect(posts).toBe(2));
    expect(payKeys[0]).toBeTruthy();
    expect(payKeys[1]).toBe(payKeys[0]);
  });

  it("pago aprobado: la reserva queda confirmada y pasa a /confirmation", async () => {
    setup();
    const user = userEvent.setup();
    await fillCard(user);
    const pay = await screen.findByRole("button", { name: /pagar/i });
    await waitFor(() => expect(pay).toBeEnabled());
    await user.click(pay);
    await waitFor(() => expect(posts).toBe(1));
    bookingState = order("CONFIRMED", { status: "APPROVED" });
    expect(
      await screen.findByText("confirmation page", undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(useWizard.getState().confirmedBookingId).toBe(BOOKING_ID);
  });

  it("pago rechazado: avisa, libera la reserva y permite elegir de nuevo", async () => {
    setup();
    const user = userEvent.setup();
    await fillCard(user, "4000000000000002");
    const pay = await screen.findByRole("button", { name: /pagar/i });
    await waitFor(() => expect(pay).toBeEnabled());
    await user.click(pay);
    await waitFor(() => expect(posts).toBe(1));
    bookingState = order("CANCELLED", { status: "REJECTED" });
    expect(
      await screen.findByText(/no pudimos aprobar el pago/i, undefined, { timeout: 4000 }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /elegir asientos de nuevo/i }));
    expect(await screen.findByText("passengers page")).toBeInTheDocument();
    expect(useWizard.getState().booking).toBeNull();
    expect(useWizard.getState().passengers).toHaveLength(1);
  });

  it("si vence el bloqueo del asiento mientras se llena el formulario, vuelve a /seats con el aviso", async () => {
    useWizard.setState({ seats: [held(1500)] });
    setup();
    expect(await screen.findByText("seats page", undefined, { timeout: 4500 })).toBeInTheDocument();
    expect(useWizard.getState().seats.filter(Boolean)).toHaveLength(0);
    expect(useWizard.getState().holdExpired).toBe(true);
  });

  it("entrar directo a /payment sin reserva vuelve al inicio", async () => {
    useWizard.getState().reset();
    renderRoutes(
      [
        { path: "/payment", element: <Payment /> },
        { path: "/", element: <div>home page</div> },
      ],
      ["/payment"],
    );
    expect(await screen.findByText("home page")).toBeInTheDocument();
  });
});
