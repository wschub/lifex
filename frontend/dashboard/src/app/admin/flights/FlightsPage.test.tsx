import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStaffSession } from "@/stores/staff-session.ts";
import {
  CITIES,
  FLIGHT_A,
  FLIGHT_B,
  flightMetrics,
  flightRow,
  flightsPage,
  jsonResponse,
  makeMe,
  passengerRow,
  stubMatchMedia,
} from "@/test/admin-fixtures.ts";
import { FlightsPage } from "./FlightsPage.tsx";

const fetchMock = vi.fn<typeof fetch>();
let total = 2;

const DOMESTIC = flightRow(FLIGHT_A);
const INTERNATIONAL = flightRow(FLIGHT_B, {
  routeType: "INTERNATIONAL",
  from: "BOG",
  to: "MAD",
  fromCity: "Bogotá",
  toCity: "Madrid",
  departureDate: "2026-11-24T21:00:00.000Z",
});

/** Parámetros de la última petición a la lista de vuelos. */
const lastListParams = (): URLSearchParams => {
  const calls = fetchMock.mock.calls
    .map(([url]) => new URL(String(url)))
    .filter((url) => url.pathname.endsWith("/dashboard/flights"));
  return calls.at(-1)!.searchParams;
};

beforeEach(() => {
  total = 2;
  stubMatchMedia(false);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/catalog/cities")) return Promise.resolve(jsonResponse(CITIES));
    if (url.pathname.endsWith("/dashboard/flights")) {
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      return Promise.resolve(
        jsonResponse(flightsPage([DOMESTIC, INTERNATIONAL], { page, pageSize, total })),
      );
    }
    return Promise.resolve(jsonResponse({}, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  useStaffSession.getState().setSession("jwt", makeMe(["dashboard:read"]), 900);
});

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <FlightsPage />
    </QueryClientProvider>,
  );

describe("sección Vuelos", () => {
  it("lista todos los vuelos, también los internacionales, sin fecha (los que aún no salieron)", async () => {
    renderPage();

    expect(await screen.findByText("Bogotá (BOG) → Madrid (MAD)")).toBeInTheDocument();
    expect(screen.getByText("Bogotá (BOG) → Medellín (MDE)")).toBeInTheDocument();
    expect(screen.getByText("Internacional")).toBeInTheDocument();
    expect(screen.getByText("Nacional")).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1–2 de 2 vuelos/)).toBeInTheDocument();
    const params = lastListParams();
    expect(params.get("date")).toBeNull();
    expect(params.get("page")).toBe("1");
    expect(params.get("pageSize")).toBe("20");
  });

  it("pagina: el pie muestra el rango y las páginas, y Siguiente pide la página 2", async () => {
    total = 45;
    renderPage();
    await screen.findByText(/Mostrando 1–20 de 45 vuelos/);
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anterior/ })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /Siguiente/ }));

    await screen.findByText(/Mostrando 21–40 de 45 vuelos/);
    expect(lastListParams().get("page")).toBe("2");
    expect(screen.getByRole("button", { name: /Anterior/ })).toBeEnabled();
  });

  it("filtra por origen y destino con autocompletar (código o ciudad) y vuelve a la página 1", async () => {
    total = 45;
    renderPage();
    await screen.findByText(/Mostrando 1–20/);
    await userEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByText(/Mostrando 21–40/);

    const origin = screen.getByRole("combobox", { name: /origen/i });
    await userEvent.click(origin);
    await userEvent.type(origin, "lon{Enter}");
    await waitFor(() => expect(lastListParams().get("from")).toBe("LHR"));
    expect(lastListParams().get("page")).toBe("1");

    const destination = screen.getByRole("combobox", { name: /destino/i });
    await userEvent.click(destination);
    await userEvent.type(destination, "mde{Enter}");
    await waitFor(() => expect(lastListParams().get("to")).toBe("MDE"));
    expect(lastListParams().get("from")).toBe("LHR");
  });

  it("ofrece todos los aeropuertos, nacionales e internacionales, en origen y destino", async () => {
    renderPage();
    await screen.findByText(/Mostrando 1–2/);
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes("cities"))).toBe(true),
    );
    await userEvent.click(screen.getByRole("combobox", { name: /destino/i }));
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Bogotá (BOG)",
      "Cali (CLO)",
      "Medellín (MDE)",
      "Londres (LHR)",
      "Madrid (MAD)",
    ]);
  });

  it("filtra por fecha y «Limpiar filtros» los quita", async () => {
    renderPage();
    await screen.findByText(/Mostrando 1–2/);

    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-12-10" } });
    await waitFor(() => expect(lastListParams().get("date")).toBe("2026-12-10"));

    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await waitFor(() => expect(lastListParams().get("date")).toBeNull());
    expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
  });

  it("cambiar las filas por página vuelve a la página 1", async () => {
    total = 120;
    renderPage();
    await screen.findByText(/Mostrando 1–20 de 120/);
    await userEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByText(/Mostrando 21–40/);

    await userEvent.selectOptions(screen.getByLabelText("Filas por página"), "50");

    await screen.findByText(/Mostrando 1–50 de 120/);
    expect(lastListParams().get("pageSize")).toBe("50");
    expect(lastListParams().get("page")).toBe("1");
  });

  it("al dar clic en un vuelo se abre su ventana de detalle con ocupación y pasajeros", async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation((input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/passengers"))
        return Promise.resolve(
          jsonResponse({ passengers: [passengerRow("aaaaaaaa-0000-4000-8000-000000000001")] }),
        );
      if (url.pathname.includes(`/dashboard/flights/${FLIGHT_B}`))
        return Promise.resolve(jsonResponse({ metrics: flightMetrics(7, FLIGHT_B) }));
      return original(input, init);
    });
    renderPage();

    await userEvent.click(await screen.findByText("Bogotá (BOG) → Madrid (MAD)"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName(/Bogotá \(BOG\) → Madrid \(MAD\)/);
    expect(await within(dialog).findByText("Ana Gómez")).toBeInTheDocument();
    expect(within(dialog).getAllByText("Pago pendiente").length).toBeGreaterThan(0);
  });

  it("el encargado (solo lectura) ve los vuelos pero no el botón de cambiar estado", async () => {
    renderPage();
    await screen.findByText("Bogotá (BOG) → Madrid (MAD)");
    expect(screen.queryByRole("button", { name: /cambiar estado/i })).not.toBeInTheDocument();
  });

  it("el administrador (flights:manage) ve el botón de cambiar estado en cada vuelo", async () => {
    useStaffSession
      .getState()
      .setSession("jwt", makeMe(["dashboard:read", "flights:manage"], ["ADMIN"]), 900);
    renderPage();
    await screen.findByText("Bogotá (BOG) → Madrid (MAD)");
    expect(screen.getAllByRole("button", { name: /cambiar estado/i })).toHaveLength(2);
  });
});
