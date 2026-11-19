import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useLangStore } from "@/i18n/i18n.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { mockApi } from "@/test/api-mock.ts";
import { renderRoutes } from "@/test/render.tsx";
import { Confirmation } from "./Confirmation.tsx";

const FLIGHT_ID = "11111111-1111-4111-8111-111111111111";
const BOOKING_ID = "33333333-3333-4333-8333-333333333333";
const airport = (iataCode: string, city: string) => ({
  iataCode,
  city,
  cityEs: city,
  country: "X",
  countryEs: "X",
  cityImageName: null,
});
const FLIGHT = {
  id: FLIGHT_ID,
  routeType: "DOMESTIC",
  from: airport("BOG", "Bogotá"),
  to: airport("MDE", "Medellín"),
  departureDate: "2026-11-21T12:30:00.000Z",
  arrivalDate: "2026-11-21T13:35:00.000Z",
  status: "ACTIVE",
  basePriceUsd: 100,
  averagePriceEconomyUsd: 0,
  averagePriceBusinessUsd: 0,
  priceEconomyUsd: 120,
  priceBusinessUsd: 360,
  offer: null,
  numAvailableSeats: 8,
  availableByClass: { economy: 6, business: 2 },
  soldOut: false,
};
const ORDER = {
  booking: {
    id: BOOKING_ID,
    orderNumber: "LX-1",
    reservationNumber: "ABC123",
    flightId: FLIGHT_ID,
    status: "CONFIRMED",
    contactEmail: "a@b.co",
    contactPhone: null,
    expiresAt: "2026-11-21T13:00:00.000Z",
    flightPriceUsd: 110,
    taxesUsd: 20.9,
    totalPriceUsd: 130.9,
    passengers: [],
    payment: { id: "44444444-4444-4444-8444-444444444444", status: "APPROVED" },
  },
};
const TICKETS = {
  reservationNumber: "ABC123",
  tickets: [
    {
      ticketCode: "LXABCDEFGH23",
      passengerFirstName: "Ana",
      passengerFullName: "Ana Gómez",
      seatIdentifier: "02A",
      seatClass: "ECONOMY",
      luggage: ["Light"],
    },
    {
      ticketCode: "LXJKLMNPQR45",
      passengerFirstName: "Luis",
      passengerFullName: "Luis Pérez",
      seatIdentifier: "02B",
      seatClass: "ECONOMY",
      luggage: ["Light"],
    },
  ],
};

beforeEach(() => {
  useLangStore.setState({ lang: "es" });
  useWizard.getState().reset();
});

describe("Confirmation", () => {
  it("muestra el código de reserva y un pase por boleto con su QR", async () => {
    useWizard.setState({
      confirmedBookingId: BOOKING_ID,
      fareId: "classic",
      flightId: FLIGHT_ID,
      booking: {
        id: BOOKING_ID,
        token: "tok",
        expiresAt: "x",
        contactEmail: "a@b.co",
        contactPhone: "+57",
      },
    });
    mockApi({
      "GET /catalog/cities": { cities: [] },
      [`GET /bookings/${BOOKING_ID}`]: ORDER,
      [`GET /bookings/${BOOKING_ID}/tickets`]: TICKETS,
      [`GET /flights/${FLIGHT_ID}`]: { flight: FLIGHT },
    });
    renderRoutes([{ path: "/confirmation", element: <Confirmation /> }], ["/confirmation"]);
    expect(await screen.findByText("ABC123")).toBeInTheDocument();
    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText("Luis Pérez")).toBeInTheDocument();
    expect(screen.getByText("02A")).toBeInTheDocument();
    const qr = screen.getByAltText("QR LXABCDEFGH23") as HTMLImageElement;
    expect(qr.src).toContain("/tickets/LXABCDEFGH23/qr.png");
    expect(screen.getAllByText("COP 431.970")).toHaveLength(2);
  });

  it("mientras los boletos no existen muestra un aviso en vez de una página vacía", async () => {
    useWizard.setState({
      confirmedBookingId: BOOKING_ID,
      flightId: FLIGHT_ID,
      booking: {
        id: BOOKING_ID,
        token: "tok",
        expiresAt: "x",
        contactEmail: "a@b.co",
        contactPhone: "+57",
      },
    });
    mockApi({
      "GET /catalog/cities": { cities: [] },
      [`GET /bookings/${BOOKING_ID}`]: ORDER,
      [`GET /bookings/${BOOKING_ID}/tickets`]: { reservationNumber: "ABC123", tickets: [] },
      [`GET /flights/${FLIGHT_ID}`]: { flight: FLIGHT },
    });
    renderRoutes([{ path: "/confirmation", element: <Confirmation /> }], ["/confirmation"]);
    expect(await screen.findByText(/estamos generando tus boletos/i)).toBeInTheDocument();
  });

  it("sin reserva pagada vuelve al inicio (el enlace «Mi reserva» no rompe)", async () => {
    mockApi({ "GET /catalog/cities": { cities: [] } });
    renderRoutes(
      [
        { path: "/confirmation", element: <Confirmation /> },
        { path: "/", element: <div>home page</div> },
      ],
      ["/confirmation"],
    );
    expect(await screen.findByText("home page")).toBeInTheDocument();
  });
});
