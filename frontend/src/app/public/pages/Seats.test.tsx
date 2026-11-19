import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FlightEvent } from "@lifex/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import { useWizard, type PassengerForm } from "@/stores/booking-wizard.ts";
import { mockApi, problem } from "@/test/api-mock.ts";
import { makeQueryClient, renderRoutes, TEST_CONFIG } from "@/test/render.tsx";
import { keys } from "@/api/keys.ts";
import type { WsClient } from "@/ws/client.ts";
import { Seats } from "./Seats.tsx";

let emit: (e: FlightEvent) => void = () => {};
const fakeClient = {
  subscribe: (_t: string, h?: { onEvent?: (e: FlightEvent) => void }) => {
    emit = (e) => h?.onEvent?.(e);
    return () => {};
  },
  close: () => {},
} as unknown as WsClient;
vi.mock("@/ws/shared-client.ts", () => ({ getWsClient: () => fakeClient }));

const FLIGHT_ID = "11111111-1111-4111-8111-111111111111";
const id = (n: number) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, "0")}`;
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
const seat = (
  n: number,
  row: number,
  column: string,
  seatClass: "ECONOMY" | "BUSINESS",
  status = "FREE",
) => ({
  id: id(n),
  identifier: `${String(row).padStart(2, "0")}${column}`,
  row,
  column,
  seatClass,
  priceUsd: seatClass === "BUSINESS" ? 300 : 100,
  status,
});
const SEAT_MAP = {
  flightId: FLIGHT_ID,
  flightStatus: "ACTIVE",
  version: 10,
  seats: [
    seat(1, 1, "A", "BUSINESS"),
    seat(2, 1, "C", "BUSINESS"),
    seat(3, 1, "D", "BUSINESS"),
    seat(4, 1, "F", "BUSINESS"),
    seat(5, 2, "A", "ECONOMY"),
    seat(6, 2, "B", "ECONOMY"),
    seat(7, 2, "C", "ECONOMY", "BLOCKED"),
    seat(8, 2, "D", "ECONOMY"),
    seat(9, 2, "E", "ECONOMY"),
    seat(10, 2, "F", "ECONOMY"),
  ],
};
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

function setup(over: Record<string, unknown> = {}, client = makeQueryClient()) {
  const spy = mockApi({
    "GET /flights/11111111-1111-4111-8111-111111111111": { flight: FLIGHT },
    "GET /flights/11111111-1111-4111-8111-111111111111/seats": SEAT_MAP,
    "GET /catalog/luggage-types": {
      luggageTypes: [
        { id: 1, name: "Light", nameEs: "Light", rank: 1, feePercentage: 10, businessOnly: false },
      ],
    },
    [`POST /flights/${FLIGHT_ID}/seats/${id(5)}/hold`]: {
      seat: { ...SEAT_MAP.seats[4], status: "BLOCKED" },
      holdExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    },
    ...over,
  });
  const utils = renderRoutes(
    [
      { path: "/seats", element: <Seats /> },
      { path: "/customize", element: <div>customize page</div> },
    ],
    ["/seats"],
    client,
  );
  return { spy, ...utils };
}

beforeEach(() => {
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
      id: "b1",
      token: "tok",
      expiresAt: "2026-11-21T13:00:00.000Z",
      contactEmail: "a@b.co",
      contactPhone: "+57300",
    },
  });
});

const seatBtn = (identifier: string) =>
  document.querySelector(`.seat[data-id="${identifier}"]`) as HTMLButtonElement;

describe("Seats", () => {
  it("elegir un asiento lo bloquea con el token de la reserva y lo marca con cuenta regresiva", async () => {
    const { spy } = setup();
    await screen.findByText("Seleccionado");
    await waitFor(() => expect(seatBtn("02A")).toBeTruthy());
    await userEvent.click(seatBtn("02A"));
    await waitFor(() => expect(seatBtn("02A")).toHaveAttribute("aria-pressed", "true"));
    const call = spy.mock.calls.find(([url]) => String(url).endsWith(`/seats/${id(5)}/hold`))!;
    expect((call[1]?.headers as Headers).get("Authorization")).toBe("Bearer tok");
    expect(useWizard.getState().seats[0]?.identifier).toBe("02A");
    expect(
      await screen.findByText(/queda reservado 15:0\d más|queda reservado 14:5\d más/),
    ).toBeInTheDocument();
  });

  it("409 SEAT_UNAVAILABLE avisa que lo tomó otra persona y no marca el asiento", async () => {
    setup({ [`POST /flights/${FLIGHT_ID}/seats/${id(5)}/hold`]: problem(409, "SEAT_UNAVAILABLE") });
    await waitFor(() => expect(seatBtn("02A")).toBeTruthy());
    await userEvent.click(seatBtn("02A"));
    expect(await screen.findByText(/acaba de ser tomado por otra persona/i)).toBeInTheDocument();
    expect(seatBtn("02A")).toHaveAttribute("aria-pressed", "false");
    expect(useWizard.getState().seats).toEqual([]);
  });

  it("un SeatHeld de otro cliente deja el asiento no disponible al instante", async () => {
    setup();
    await waitFor(() => expect(seatBtn("02B")).toBeTruthy());
    expect(seatBtn("02B")).toBeEnabled();
    act(() =>
      emit({
        type: "SeatHeld",
        topic: `flight:${FLIGHT_ID}`,
        flightId: FLIGHT_ID,
        version: 11,
        at: "2026-11-21T10:00:00.000Z",
        data: { seatId: id(6), seatIdentifier: "02B", status: "BLOCKED" },
      }),
    );
    await waitFor(() => expect(seatBtn("02B")).toBeDisabled());
  });

  it("un asiento ya bloqueado por otra persona llega deshabilitado", async () => {
    setup();
    await waitFor(() => expect(seatBtn("02C")).toBeTruthy());
    expect(seatBtn("02C")).toBeDisabled();
  });

  it("la cabina Economy solo dibuja asientos Economy y Business solo Business", async () => {
    setup();
    await waitFor(() => expect(seatBtn("02A")).toBeTruthy());
    expect(seatBtn("01A")).toBeNull();
    useWizard.setState({ cabin: "business" });
    await waitFor(() => expect(seatBtn("01A")).toBeTruthy());
    expect(seatBtn("02A")).toBeNull();
  });

  it("no deja pasar del máximo de asientos bloqueados por sesión", async () => {
    const client = makeQueryClient();
    client.setQueryData(keys.config, { ...TEST_CONFIG, maxHeldSeatsPerSession: 1 });
    useWizard.setState({
      search: { from: "BOG", to: "MDE", date: "2026-11-21", pax: 2 },
      passengers: [person, { ...person, first: "Luis" }],
      seats: [
        {
          seatId: id(5),
          identifier: "02A",
          seatClass: "ECONOMY",
          priceUsd: 100,
          holdExpiresAt: new Date(Date.now() + 600_000).toISOString(),
        },
        null,
      ],
    });
    const { spy } = setup({}, client);
    await waitFor(() => expect(seatBtn("02D")).toBeTruthy());
    await userEvent.click(screen.getByRole("button", { name: /Luis Gómez/ }));
    await userEvent.click(seatBtn("02D"));
    expect(await screen.findByText(/puedes bloquear hasta 1 asientos/i)).toBeInTheDocument();
    expect(spy.mock.calls.some(([u]) => String(u).includes(`/seats/${id(8)}/hold`))).toBe(false);
  });
});
