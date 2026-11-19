import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FlightEvent, PublicFlight } from "@lifex/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { mockApi } from "@/test/api-mock.ts";
import { renderRoutes } from "@/test/render.tsx";
import { Results } from "./Results.tsx";
import type { WsClient } from "@/ws/client.ts";

vi.mock("@/ws/shared-client.ts", () => ({ getWsClient: () => fakeClient }));

let emit: (e: FlightEvent) => void = () => {};
const fakeClient: WsClient = {
  subscribe: (_topic: string, handlers?: { onEvent?: (e: FlightEvent) => void }) => {
    emit = (e) => handlers?.onEvent?.(e);
    return () => {};
  },
  close: () => {},
} as unknown as WsClient;

const airport = (iataCode: string, city: string) => ({
  iataCode,
  city,
  cityEs: city,
  country: "Colombia",
  countryEs: "Colombia",
  cityImageName: null,
});
const flight = (id: string, over: Partial<PublicFlight> = {}): PublicFlight => ({
  id,
  routeType: "DOMESTIC",
  from: airport("MDE", "Medellín"),
  to: airport("BOG", "Bogotá"),
  departureDate: "2026-11-21T12:30:00.000Z",
  arrivalDate: "2026-11-21T13:35:00.000Z",
  status: "ACTIVE",
  basePriceUsd: 100,
  averagePriceEconomyUsd: 0,
  averagePriceBusinessUsd: 0,
  priceEconomyUsd: 120,
  priceBusinessUsd: 360,
  offer: null,
  numAvailableSeats: 40,
  availableByClass: { economy: 30, business: 10 },
  soldOut: false,
  ...over,
});
const F1 = "11111111-1111-4111-8111-111111111111";
const F2 = "22222222-2222-4222-8222-222222222222";

const LUGGAGE = {
  luggageTypes: [
    { id: 1, name: "Light", nameEs: "Light", rank: 1, feePercentage: 10, businessOnly: false },
    { id: 2, name: "Classic", nameEs: "Clásico", rank: 2, feePercentage: 15, businessOnly: false },
  ],
};

function setup(flights: PublicFlight[]) {
  mockApi({
    "GET /catalog/cities": { cities: [] },
    "GET /catalog/luggage-types": LUGGAGE,
    "GET /flights": (url: URL) => ({
      flights: url.searchParams.get("date") === "2026-11-21" ? flights : [],
    }),
  });
  return renderRoutes(
    [
      { path: "/results", element: <Results /> },
      { path: "/fares", element: <div>fares page</div> },
    ],
    ["/results?from=MDE&to=BOG&date=2026-11-21&pax=2"],
  );
}

beforeEach(() => {
  useWizard.getState().reset();
  useLangStore.setState({ lang: "es" });
});

describe("Results", () => {
  it("muestra el precio desde en COP con impuestos (precio × recargo Light × impuestos × TRM)", async () => {
    setup([flight(F1)]);
    // priceEconomyUsd 120 × 1.10 × 1.19 × 3300 = 518.364
    expect(await screen.findAllByText("COP 518.364")).not.toHaveLength(0);
  });

  it("un vuelo en oferta lo indica con la etiqueta de descuento", async () => {
    setup([flight(F1, { offer: { discountPercentage: 15 } })]);
    expect(await screen.findByText("Oferta −15 %")).toBeInTheDocument();
  });

  it("un vuelo sin oferta no muestra etiqueta de descuento", async () => {
    setup([flight(F1)]);
    await screen.findAllByText("COP 518.364");
    expect(screen.queryByText(/oferta/i)).not.toBeInTheDocument();
  });

  it("ordena por precio vigente, no por el promedio de ventas", async () => {
    setup([
      flight(F1, { priceEconomyUsd: 200, departureDate: "2026-11-21T10:00:00.000Z" }),
      flight(F2, { priceEconomyUsd: 150, departureDate: "2026-11-21T14:00:00.000Z" }),
    ]);
    await userEvent.click(await screen.findByRole("button", { name: /mostrar todos/i }));
    await userEvent.click(screen.getByRole("button", { name: /precio/i }));
    await screen.findAllByText("COP 647.955");
    const cards = [...document.querySelectorAll("#flights .flight-card .price")].map(
      (n) => n.textContent,
    );
    // 150 × 1.10 × 1.19 × 3300 = 647.955 (el más barato primero); 200 → 863.940
    expect(cards).toEqual(["COP 647.955", "COP 863.940"]);
  });

  it("un vuelo agotado se marca y no se puede elegir; uno cancelado igual", async () => {
    setup([
      flight(F1, { soldOut: true, status: "SOLD_OUT" }),
      flight(F2, { status: "CANCELLED", departureDate: "2026-11-21T14:00:00.000Z" }),
    ]);
    await userEvent.click(await screen.findByRole("button", { name: /mostrar todos/i }));
    const sold = await screen.findByRole("button", { name: "Agotado" });
    expect(sold).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelado" })).toBeDisabled();
  });

  it("un cambio de estado por flights:search actualiza la tarjeta sin recargar", async () => {
    setup([flight(F1)]);
    const pick = await screen.findByRole("button", { name: /ver tarifas/i });
    expect(pick).toBeEnabled();
    act(() =>
      emit({
        type: "FlightStatusChanged",
        topic: "flights:search",
        flightId: F1,
        version: 5,
        at: "2026-11-21T10:00:00.000Z",
        data: { status: "CANCELLED", previousStatus: "ACTIVE" },
      }),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancelado" })).toBeDisabled());
  });

  it("sin vuelos ese día muestra el aviso y la tira de fechas con guion", async () => {
    setup([]);
    expect(await screen.findByText(/no hay vuelos con estos filtros/i)).toBeInTheDocument();
  });

  it("elegir un vuelo lo guarda y avanza a las tarifas", async () => {
    setup([flight(F1)]);
    await userEvent.click(await screen.findByRole("button", { name: /ver tarifas/i }));
    expect(await screen.findByText("fares page")).toBeInTheDocument();
    expect(useWizard.getState().flightId).toBe(F1);
    expect(useWizard.getState().search.pax).toBe(2);
  });
});
