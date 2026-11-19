import { screen } from "@testing-library/react";
import type { PublicFlight } from "@lifex/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { mockApi } from "@/test/api-mock.ts";
import { renderPage } from "@/test/render.tsx";
import { Fares } from "./Fares.tsx";

const airport = (iataCode: string, city: string) => ({
  iataCode,
  city,
  cityEs: city,
  country: "Colombia",
  countryEs: "Colombia",
  cityImageName: null,
});
const F1 = "11111111-1111-4111-8111-111111111111";
const flight = (over: Partial<PublicFlight> = {}): PublicFlight => ({
  id: F1,
  routeType: "DOMESTIC",
  from: airport("MDE", "Medellín"),
  to: airport("BOG", "Bogotá"),
  departureDate: "2026-11-21T12:30:00.000Z",
  arrivalDate: "2026-11-21T13:35:00.000Z",
  status: "ACTIVE",
  basePriceUsd: 100,
  averagePriceEconomyUsd: 0,
  averagePriceBusinessUsd: 0,
  priceEconomyUsd: 85,
  priceBusinessUsd: 255,
  offer: null,
  numAvailableSeats: 40,
  availableByClass: { economy: 30, business: 10 },
  soldOut: false,
  ...over,
});
const LUGGAGE = {
  luggageTypes: [
    { id: 1, name: "Light", nameEs: "Light", rank: 1, feePercentage: 0, businessOnly: false },
  ],
};

function setup(f: PublicFlight) {
  mockApi({
    "GET /catalog/cities": { cities: [] },
    "GET /catalog/luggage-types": LUGGAGE,
    [`GET /flights/${F1}`]: { flight: f },
  });
  useWizard.getState().chooseFlight(F1);
  renderPage(<Fares />, "/fares");
}

beforeEach(() => {
  useWizard.getState().reset();
  useLangStore.setState({ lang: "es" });
});

describe("Fares", () => {
  it("muestra el precio vigente del vuelo con impuestos, sin promedios locales", async () => {
    setup(flight());
    // priceEconomyUsd 85 × 1.00 × 1.19 × 3300 = 333.795
    expect((await screen.findAllByText("COP 333.795")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/oferta/i)).not.toBeInTheDocument();
  });

  it("un vuelo en oferta muestra la etiqueta con su descuento", async () => {
    setup(flight({ offer: { discountPercentage: 15 } }));
    expect(await screen.findByText("Oferta −15 %")).toBeInTheDocument();
  });
});
