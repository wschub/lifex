import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { mockApi } from "@/test/api-mock.ts";
import { renderRoutes } from "@/test/render.tsx";
import { Passengers } from "./Passengers.tsx";

const FLIGHT_ID = "11111111-1111-4111-8111-111111111111";
const BOOKING_ID = "33333333-3333-4333-8333-333333333333";
const airport = (iataCode: string) => ({
  iataCode,
  city: iataCode,
  cityEs: iataCode,
  country: "X",
  countryEs: "X",
  cityImageName: null,
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
  averagePriceEconomyUsd: 0,
  averagePriceBusinessUsd: 0,
  priceEconomyUsd: 120,
  priceBusinessUsd: 360,
  offer: null,
  numAvailableSeats: 40,
  availableByClass: { economy: 30, business: 10 },
  soldOut: false,
};
const booking = (email: string) => ({
  id: BOOKING_ID,
  orderNumber: "LX-1",
  reservationNumber: "ABC123",
  flightId: FLIGHT_ID,
  status: "DRAFT",
  contactEmail: email,
  contactPhone: null,
  expiresAt: "2026-11-21T13:00:00.000Z",
  flightPriceUsd: 0,
  taxesUsd: 0,
  totalPriceUsd: 0,
  passengers: [],
  payment: null,
});

function setup() {
  const calls: unknown[] = [];
  const spy = mockApi({
    "GET /flights/11111111-1111-4111-8111-111111111111": { flight: FLIGHT },
    "GET /catalog/luggage-types": {
      luggageTypes: [
        { id: 1, name: "Light", nameEs: "Light", rank: 1, feePercentage: 10, businessOnly: false },
      ],
    },
    "GET /catalog/countries": {
      countries: [{ id: 7, isoCode: "CO", name: "Colombia", nameEs: "Colombia" }],
    },
    "POST /bookings": (_url: URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { contactEmail: string };
      calls.push(body);
      return { booking: booking(body.contactEmail), token: "tok", expiresInSeconds: 2700 };
    },
  });
  const utils = renderRoutes(
    [
      { path: "/passengers", element: <Passengers /> },
      { path: "/customize", element: <div>customize page</div> },
    ],
    ["/passengers"],
  );
  return { ...utils, calls, spy };
}

async function fillPassenger(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/nombre\(s\)/i), "Ana");
  await user.type(screen.getByLabelText(/apellido\(s\)/i), "Gómez");
  await user.selectOptions(screen.getByLabelText("Día"), "3");
  await user.selectOptions(screen.getByLabelText("Mes"), "4");
  await user.selectOptions(screen.getByLabelText("Año"), "1990");
  await user.selectOptions(await screen.findByLabelText(/nacionalidad/i), "7");
  await user.type(screen.getByLabelText(/número de documento/i), "1020304050");
  await user.click(
    within(document.querySelector('.acc[data-i="0"]') as HTMLElement).getByRole("button", {
      name: /siguiente/i,
    }),
  );
}
async function fillHolder(user: ReturnType<typeof userEvent.setup>, email = "ana@correo.co") {
  await user.type(screen.getByLabelText(/teléfono móvil/i), "3001234567");
  await user.type(screen.getByLabelText(/^correo electrónico\*/i), email);
  await user.type(screen.getByLabelText(/confirma tu correo/i), email);
  await user.click(screen.getByLabelText(/acepto el tratamiento/i));
  await user.click(
    within(document.querySelector('.acc[data-i="h"]') as HTMLElement).getByRole("button", {
      name: /siguiente/i,
    }),
  );
}

beforeEach(() => {
  useLangStore.setState({ lang: "es" });
  useWizard.getState().reset();
  useWizard.setState({
    flightId: FLIGHT_ID,
    fareId: "light",
    luggageTypeId: 1,
    search: { from: "BOG", to: "MDE", date: "2026-11-21", pax: 1 },
  });
});

describe("Passengers", () => {
  it("muestra el error bajo cada campo inválido", async () => {
    setup();
    const user = userEvent.setup();
    await screen.findByLabelText(/nombre\(s\)/i);
    await user.click(screen.getAllByRole("button", { name: /siguiente/i })[0]!);
    const names = screen.getByLabelText(/nombre\(s\)/i).closest(".field") as HTMLElement;
    expect(names).toHaveClass("invalid");
    expect(within(names).getByText("Campo obligatorio.")).toBeInTheDocument();
    expect(screen.getByLabelText("Día").closest(".field")).toHaveClass("invalid");
  });

  it("con datos válidos abre UNA reserva aunque se haga doble clic y avanza a /customize", async () => {
    const { calls } = setup();
    const user = userEvent.setup();
    await fillPassenger(user);
    await fillHolder(user);
    const next = screen.getByRole("button", { name: /continuar/i });
    await user.dblClick(next);
    expect(await screen.findByText("customize page")).toBeInTheDocument();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      flightId: FLIGHT_ID,
      contactEmail: "ana@correo.co",
      contactPhone: "+573001234567",
    });
    expect(useWizard.getState().booking?.token).toBe("tok");
  });

  it("volver y continuar con el mismo contacto no crea otra reserva", async () => {
    const { calls } = setup();
    useWizard.getState().attachBooking({
      id: BOOKING_ID,
      token: "old",
      expiresAt: "x",
      contactEmail: "ana@correo.co",
      contactPhone: "+573001234567",
    });
    const user = userEvent.setup();
    await fillPassenger(user);
    await fillHolder(user);
    await user.click(screen.getByRole("button", { name: /continuar/i }));
    await waitFor(() => expect(screen.getByText("customize page")).toBeInTheDocument());
    expect(calls).toHaveLength(0);
    expect(useWizard.getState().booking?.token).toBe("old");
  });

  it("si el correo cambia se abre otra reserva y se sueltan los asientos", async () => {
    const { calls } = setup();
    useWizard.getState().attachBooking({
      id: "old",
      token: "old",
      expiresAt: "x",
      contactEmail: "otro@correo.co",
      contactPhone: "+573001234567",
    });
    useWizard
      .getState()
      .setSeats([
        { seatId: "s", identifier: "08A", seatClass: "ECONOMY", priceUsd: 10, holdExpiresAt: "x" },
      ]);
    const user = userEvent.setup();
    await fillPassenger(user);
    await fillHolder(user);
    await user.click(screen.getByRole("button", { name: /continuar/i }));
    await waitFor(() => expect(screen.getByText("customize page")).toBeInTheDocument());
    expect(calls).toHaveLength(1);
    expect(useWizard.getState().seats).toEqual([]);
  });

  it("continuar sin completar abre el primer formulario pendiente y lo valida", async () => {
    setup();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /continuar/i }));
    expect(screen.getByLabelText(/nombre\(s\)/i).closest(".field")).toHaveClass("invalid");
  });
});
