import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStaffSession } from "@/stores/staff-session.ts";
import {
  FLIGHT_A,
  flightMetrics,
  flightRow,
  jsonResponse,
  makeMe,
  passengerRow,
  stubMatchMedia,
} from "@/test/admin-fixtures.ts";
import type { WsClient } from "@/ws/client.ts";
import { FlightDetailDialog } from "./FlightDetailDialog.tsx";

const fetchMock = vi.fn<typeof fetch>();
let passengers = [
  passengerRow("11111111-0000-4000-8000-000000000001"),
  passengerRow("11111111-0000-4000-8000-000000000002", {
    fullName: "Luis",
    lastName: "Pérez",
    isHolder: false,
    documentNumber: "7654321",
    seatIdentifier: "01A",
    seatClass: "BUSINESS",
    luggage: null,
    contactEmail: "luis@example.com",
    contactPhone: null,
    reservationNumber: "ZZ99AA",
    checkedIn: true,
    checkedInAt: "2026-11-24T10:30:00.000Z",
    passengerType: "CHILD",
  }),
];

const fakeClient = (): WsClient => ({ subscribe: () => () => undefined, close: () => undefined });

beforeEach(() => {
  stubMatchMedia(false);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/check-in")) {
      const ticketId = url.pathname.split("/").at(-2)!;
      const body = JSON.parse(String(init?.body)) as { checkedIn: boolean };
      passengers = passengers.map((p) =>
        p.ticketId === ticketId ? { ...p, checkedIn: body.checkedIn } : p,
      );
      return Promise.resolve(
        jsonResponse({ passenger: passengers.find((p) => p.ticketId === ticketId) }),
      );
    }
    if (url.pathname.endsWith("/passengers")) return Promise.resolve(jsonResponse({ passengers }));
    if (url.pathname.includes("/dashboard/flights/"))
      return Promise.resolve(jsonResponse({ metrics: flightMetrics(5) }));
    return Promise.resolve(jsonResponse({}, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  useStaffSession.getState().setSession("jwt", makeMe(["dashboard:read"]), 900);
});

const renderDialog = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FlightDetailDialog
        flight={flightRow(FLIGHT_A) as never}
        onClose={vi.fn()}
        createClient={fakeClient}
      />
    </QueryClientProvider>,
  );

describe("ventana de detalle del vuelo", () => {
  it("muestra los conteos del vuelo (libres, bloqueados, pago pendiente y reservados, por clase)", async () => {
    renderDialog();
    expect(await screen.findByText("Por clase")).toBeInTheDocument();
    for (const label of ["Libres", "Bloqueados", "Pago pendiente", "Reservados"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/Bogotá \(BOG\) → Medellín \(MDE\)/);
  });

  it("lista a los pasajeros con su documento, asiento, clase, reserva, contacto, equipaje y check-in", async () => {
    renderDialog();
    const ana = (await screen.findByText("Ana Gómez")).closest("tr") as HTMLElement;
    expect(within(ana).getByText(/CC 1234567 · Adulto · Titular/)).toBeInTheDocument();
    expect(within(ana).getByText("12A")).toBeInTheDocument();
    expect(within(ana).getByText("Economy")).toBeInTheDocument();
    expect(within(ana).getByText("CRBRVR")).toBeInTheDocument();
    expect(within(ana).getByRole("link", { name: "ana@example.com" })).toHaveAttribute(
      "href",
      "mailto:ana@example.com",
    );
    expect(within(ana).getByText("+573001112233")).toBeInTheDocument();
    expect(within(ana).getByText("Light")).toBeInTheDocument();
    expect(within(ana).getByText("Pendiente")).toBeInTheDocument();

    const luis = screen.getByText("Luis Pérez").closest("tr") as HTMLElement;
    expect(within(luis).getByText("Business")).toBeInTheDocument();
    expect(within(luis).getByText("Sin teléfono")).toBeInTheDocument();
    expect(within(luis).getByText("Sin equipaje")).toBeInTheDocument();
    expect(within(luis).getByText("Hecho")).toBeInTheDocument();
    expect(within(luis).getByText(/Niño/)).toBeInTheDocument();
    expect(screen.getByText(/2 con ticket · 1 con check-in · 1 sin check-in/)).toBeInTheDocument();
  });

  it("filtra por texto (nombre, correo, reserva…), por clase y por check-in", async () => {
    renderDialog();
    await screen.findByText("Ana Gómez");

    await userEvent.type(screen.getByLabelText("Buscar pasajero"), "luis@");
    expect(screen.queryByText("Ana Gómez")).not.toBeInTheDocument();
    expect(screen.getByText("Luis Pérez")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Buscar pasajero"));
    await userEvent.type(screen.getByLabelText("Buscar pasajero"), "crbrvr");
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.queryByText("Luis Pérez")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await userEvent.selectOptions(screen.getByLabelText("Clase"), "BUSINESS");
    expect(screen.queryByText("Ana Gómez")).not.toBeInTheDocument();
    expect(screen.getByText("Luis Pérez")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Clase"), "ALL");
    await userEvent.selectOptions(screen.getByLabelText("Check-in"), "NO");
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.queryByText("Luis Pérez")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Buscar pasajero"), "zzz");
    expect(screen.getByText("Ningún pasajero coincide con los filtros.")).toBeInTheDocument();
  });

  it("el encargado (solo lectura) no ve los botones de check-in", async () => {
    renderDialog();
    await screen.findByText("Ana Gómez");
    expect(screen.queryByRole("button", { name: /check-in/i })).not.toBeInTheDocument();
  });

  it("quien gestiona vuelos registra y quita el check-in de un pasajero", async () => {
    useStaffSession
      .getState()
      .setSession("jwt", makeMe(["dashboard:read", "flights:manage"], ["ADMIN"]), 900);
    renderDialog();
    const ana = (await screen.findByText("Ana Gómez")).closest("tr") as HTMLElement;

    await userEvent.click(within(ana).getByRole("button", { name: "Registrar check-in" }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/check-in"));
      expect(call).toBeDefined();
      expect(call![1]?.method).toBe("PATCH");
      expect(JSON.parse(String(call![1]?.body))).toEqual({ checkedIn: true });
    });
    const updated = (await screen.findByText("Ana Gómez")).closest("tr") as HTMLElement;
    expect(await within(updated).findByText("Hecho")).toBeInTheDocument();
    expect(within(updated).getByRole("button", { name: "Quitar check-in" })).toBeInTheDocument();
  });

  it("si el vuelo no tiene reservas pagadas lo dice", async () => {
    passengers = [];
    renderDialog();
    expect(
      await screen.findByText("Este vuelo todavía no tiene reservas pagadas."),
    ).toBeInTheDocument();
  });
});
