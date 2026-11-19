import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStaffSession } from "@/stores/staff-session.ts";
import {
  CITIES,
  aircraftRow,
  customerRow,
  jsonResponse,
  makeMe,
  purchaseRow,
  stubMatchMedia,
} from "@/test/admin-fixtures.ts";
import { AppSidebar } from "../layout/AppSidebar.tsx";
import { SidebarProvider } from "@/components/ui/sidebar.tsx";
import { RequireAdmin } from "../RequireAdmin.tsx";
import { CategoriesPage } from "./CategoriesPage.tsx";
import { CustomersPage } from "./CustomersPage.tsx";
import { FleetPage } from "./FleetPage.tsx";
import { PurchasesPage } from "./PurchasesPage.tsx";

const fetchMock = vi.fn<typeof fetch>();
let customersTotal = 2;
let purchasesTotal = 2;

const LUGGAGE = {
  luggageTypes: [
    { id: 3, name: "Flex", nameEs: "Flex", rank: 3, feePercentage: 18, businessOnly: false },
    { id: 1, name: "Light", nameEs: "Light", rank: 1, feePercentage: 10, businessOnly: false },
    {
      id: 4,
      name: "Business Flex",
      nameEs: "Business Flex",
      rank: 5,
      feePercentage: 25,
      businessOnly: true,
    },
  ],
};

/** Parámetros de la última petición cuya ruta termina en `suffix`. */
const lastParams = (suffix: string): URLSearchParams => {
  const calls = fetchMock.mock.calls
    .map(([url]) => new URL(String(url)))
    .filter((url) => url.pathname.endsWith(suffix));
  return calls.at(-1)!.searchParams;
};

beforeEach(() => {
  customersTotal = 2;
  purchasesTotal = 2;
  stubMatchMedia(false);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const url = new URL(String(input));
    const page = Number(url.searchParams.get("page") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
    if (url.pathname.endsWith("/dashboard/aircraft"))
      return Promise.resolve(
        jsonResponse({
          aircraft: [
            aircraftRow(1),
            aircraftRow(2, {
              reference: "Airbus A320neo",
              typeRange: "DOMESTIC",
              totalSeats: 150,
              businessSeats: 24,
              economySeats: 126,
              rangeKm: 6297,
              rangeNauticalMiles: 3400,
              status: "UNAVAILABLE",
              upcomingFlights: 9,
            }),
          ],
        }),
      );
    if (url.pathname.endsWith("/catalog/luggage-types"))
      return Promise.resolve(jsonResponse(LUGGAGE));
    if (url.pathname.endsWith("/catalog/cities")) return Promise.resolve(jsonResponse(CITIES));
    if (url.pathname.endsWith("/dashboard/customers"))
      return Promise.resolve(
        jsonResponse({
          customers: [
            customerRow("ana@example.com"),
            customerRow("luis@example.com", {
              name: "Luis Pérez",
              phone: null,
              purchases: 1,
              totalUsd: 80,
            }),
          ],
          page,
          pageSize,
          total: customersTotal,
        }),
      );
    if (url.pathname.endsWith("/dashboard/purchases"))
      return Promise.resolve(
        jsonResponse({
          purchases: [
            purchaseRow("aaaaaaaa-0000-4000-8000-000000000001"),
            purchaseRow("aaaaaaaa-0000-4000-8000-000000000002", {
              reservationNumber: "ZZ99AA",
              customerName: "Luis Pérez",
              customerEmail: "luis@example.com",
              passengers: 1,
              payment: null,
              status: "PAYMENT_PENDING",
              flight: {
                id: "22222222-2222-4222-8222-222222222222",
                routeType: "INTERNATIONAL",
                from: "BOG",
                to: "MAD",
                fromCity: "Bogotá",
                toCity: "Madrid",
                departureDate: "2026-12-12T20:00:00.000Z",
              },
            }),
          ],
          page,
          pageSize,
          total: purchasesTotal,
        }),
      );
    return Promise.resolve(jsonResponse({}, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  useStaffSession
    .getState()
    .setSession("jwt", makeMe(["dashboard:read", "flights:manage"], ["ADMIN"]), 900);
});

const withClient = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {ui}
    </QueryClientProvider>,
  );

describe("Flota", () => {
  it("lista cada avión con su modelo, descripción, tipo, capacidad por clase, alcance, estado y vuelos", async () => {
    withClient(<FleetPage />);
    const row = (await screen.findByText("Boeing 787-9")).closest("tr") as HTMLElement;
    expect(within(row).getByText("INT-001")).toBeInTheDocument();
    expect(
      within(row).getByText("Avión de fuselaje ancho para largo alcance."),
    ).toBeInTheDocument();
    expect(within(row).getByText("Internacional")).toBeInTheDocument();
    expect(within(row).getByText("290 asientos")).toBeInTheDocument();
    expect(within(row).getByText("28 Business · 262 Economy")).toBeInTheDocument();
    expect(within(row).getByText("14.498 km")).toBeInTheDocument();
    expect(within(row).getByText("7.828 mn")).toBeInTheDocument();
    expect(within(row).getByText("Disponible")).toBeInTheDocument();
    const other = screen.getByText("Airbus A320neo").closest("tr") as HTMLElement;
    expect(within(other).getByText("No disponible")).toBeInTheDocument();
    expect(within(other).getByText("Nacional")).toBeInTheDocument();
    // resumen: 2 aviones, 440 asientos, 1 disponible
    expect(screen.getByText("440")).toBeInTheDocument();
  });
});

describe("Categorías y equipajes", () => {
  it("muestra las cabinas y las tarifas ordenadas, con su recargo y dónde se pueden elegir", async () => {
    withClient(<CategoriesPage />);
    await screen.findAllByText("Business Flex");
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[1]?.textContent)).toEqual([
      "Light",
      "Flex",
      "Business Flex",
    ]);
    const business = screen.getAllByText("Business Flex")[0]!.closest("tr") as HTMLElement;
    expect(within(business).getByText("Solo Business")).toBeInTheDocument();
    expect(within(business).getByText("25 %")).toBeInTheDocument();
    expect(screen.getAllByText("Economy y Business")).toHaveLength(2);
    expect(screen.getByText("Cabina principal", { exact: false })).toBeInTheDocument();
  });
});

describe("Clientes", () => {
  it("lista a los clientes con sus compras y su total gastado, y pagina", async () => {
    customersTotal = 45;
    withClient(<CustomersPage />);
    const row = (await screen.findByText("ana@example.com")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Ana Gómez")).toBeInTheDocument();
    expect(within(row).getByText("+573001112233")).toBeInTheDocument();
    expect(within(row).getByText("3")).toBeInTheDocument();
    expect(within(row).getByText("USD 1.234,50")).toBeInTheDocument();
    expect(screen.getByText("Sin teléfono")).toBeInTheDocument();
    expect(screen.getByText(/Mostrando 1–20 de 45 clientes/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Siguiente/ }));

    await screen.findByText(/Mostrando 21–40 de 45 clientes/);
    expect(lastParams("/dashboard/customers").get("page")).toBe("2");
  });

  it("busca por nombre, correo o teléfono (con una pausa al escribir) y vuelve a la página 1", async () => {
    withClient(<CustomersPage />);
    await screen.findByText("ana@example.com");

    await userEvent.type(screen.getByLabelText("Buscar cliente"), "luis");

    await waitFor(() => expect(lastParams("/dashboard/customers").get("search")).toBe("luis"));
    expect(lastParams("/dashboard/customers").get("page")).toBe("1");
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await waitFor(() => expect(lastParams("/dashboard/customers").get("search")).toBeNull());
  });

  it("al dar clic en un cliente se abren sus compras confirmadas", async () => {
    withClient(<CustomersPage />);
    await userEvent.click(await screen.findByText("ana@example.com"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveAccessibleName("Ana Gómez");
    expect(await within(dialog).findByText("CRBRVR")).toBeInTheDocument();
    const params = lastParams("/dashboard/purchases");
    expect(params.get("email")).toBe("ana@example.com");
    expect(params.get("status")).toBe("CONFIRMED");
    expect(within(dialog).queryByText("Cliente")).not.toBeInTheDocument(); // sin la columna del cliente
    expect(within(dialog).getByText(/3 compras/)).toBeInTheDocument();
  });
});

describe("Compras", () => {
  it("por defecto pide las confirmadas y muestra reserva, cliente, vuelo, pasajeros, total y pago", async () => {
    withClient(<PurchasesPage />);
    const row = (await screen.findByText("CRBRVR")).closest("tr") as HTMLElement;
    expect(within(row).getByText("Confirmada")).toBeInTheDocument();
    expect(within(row).getByText("Ana Gómez")).toBeInTheDocument();
    expect(within(row).getByText("ana@example.com")).toBeInTheDocument();
    expect(within(row).getByText(/Medellín \(MDE\) → Bogotá \(BOG\)/)).toBeInTheDocument();
    expect(within(row).getByText("USD 250,75")).toBeInTheDocument();
    expect(within(row).getByText(/VISA •••• 4242/)).toBeInTheDocument();
    const pending = screen.getByText("ZZ99AA").closest("tr") as HTMLElement;
    expect(within(pending).getByText("Sin pago")).toBeInTheDocument();
    expect(within(pending).getByText(/Internacional/)).toBeInTheDocument();
    expect(lastParams("/dashboard/purchases").get("status")).toBe("CONFIRMED");
  });

  it("filtra por estado, fecha de compra, texto y ruta (autocompletar) y vuelve a la página 1", async () => {
    purchasesTotal = 45;
    withClient(<PurchasesPage />);
    await screen.findByText(/Mostrando 1–20 de 45 compras/);
    await userEvent.click(screen.getByRole("button", { name: /Siguiente/ }));
    await screen.findByText(/Mostrando 21–40/);
    expect(lastParams("/dashboard/purchases").get("page")).toBe("2");

    await userEvent.selectOptions(screen.getByLabelText("Estado"), "ALL");
    await waitFor(() => expect(lastParams("/dashboard/purchases").get("status")).toBe("ALL"));
    expect(lastParams("/dashboard/purchases").get("page")).toBe("1");

    fireEvent.change(screen.getByLabelText("Comprada desde"), { target: { value: "2026-11-01" } });
    await waitFor(() =>
      expect(lastParams("/dashboard/purchases").get("dateFrom")).toBe("2026-11-01"),
    );

    await userEvent.type(screen.getByLabelText("Buscar"), "crbr");
    await waitFor(() => expect(lastParams("/dashboard/purchases").get("search")).toBe("crbr"));

    const destination = screen.getByRole("combobox", { name: /destino del vuelo/i });
    await userEvent.click(destination);
    await userEvent.type(destination, "madrid{Enter}");
    await waitFor(() => expect(lastParams("/dashboard/purchases").get("destination")).toBe("MAD"));

    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await waitFor(() => {
      const params = lastParams("/dashboard/purchases");
      expect(params.get("status")).toBe("CONFIRMED");
      expect(params.get("destination")).toBeNull();
      expect(params.get("search")).toBeNull();
    });
  });
});

describe("acceso solo para el administrador", () => {
  const renderSidebar = () =>
    render(
      <MemoryRouter>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </MemoryRouter>,
    );

  it("el administrador ve el grupo Administración con las cuatro secciones", () => {
    renderSidebar();
    expect(screen.getByText("Administración")).toBeInTheDocument();
    for (const [name, href] of [
      ["Flota", "/flota"],
      ["Categorías y equipajes", "/categorias"],
      ["Clientes", "/clientes"],
      ["Compras", "/compras"],
    ] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("el encargado (solo lectura) no ve esas secciones, pero sí Vuelos", () => {
    useStaffSession.getState().setSession("jwt", makeMe(["dashboard:read"]), 900);
    renderSidebar();
    expect(screen.queryByText("Administración")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Clientes" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Vuelos" })).toBeInTheDocument();
  });

  it("entrar a una sección de administración sin ser admin devuelve al dashboard", () => {
    useStaffSession.getState().setSession("jwt", makeMe(["dashboard:read"]), 900);
    render(
      <MemoryRouter initialEntries={["/clientes"]}>
        <Routes>
          <Route path="/" element={<p>dashboard</p>} />
          <Route
            path="/clientes"
            element={
              <RequireAdmin>
                <p>clientes</p>
              </RequireAdmin>
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("dashboard")).toBeInTheDocument();
    expect(screen.queryByText("clientes")).not.toBeInTheDocument();
  });
});
