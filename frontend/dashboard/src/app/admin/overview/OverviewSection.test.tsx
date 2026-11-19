import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStaffSession } from "@/stores/staff-session.ts";
import { jsonResponse, makeMe, overviewFixture, problemBody } from "@/test/admin-fixtures.ts";
import { OverviewSection } from "./OverviewSection.tsx";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  useStaffSession.getState().setSession("jwt", makeMe(["dashboard:read"]), 900);
});

const renderSection = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <OverviewSection date="2026-11-24" />
    </QueryClientProvider>,
  );

// Los indicadores van antes que las gráficas: si el texto se repite en un título, el primero es el indicador.
const kpi = (label: string) =>
  screen.getAllByText(label)[0]!.closest("[data-slot=card]") as HTMLElement;

describe("OverviewSection (indicadores y gráficas)", () => {
  it("pide el resumen de la fecha elegida con el token del staff", async () => {
    fetchMock.mockResolvedValue(jsonResponse(overviewFixture));
    renderSection();
    await screen.findByText("Vuelos del día");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/dashboard/overview?date=2026-11-24");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer jwt");
  });

  it("muestra los indicadores: vuelos, ocupación, tickets, ingresos y novedades", async () => {
    fetchMock.mockResolvedValue(jsonResponse(overviewFixture));
    renderSection();
    await screen.findByText("Vuelos del día");

    const flights = kpi("Vuelos del día");
    expect(within(flights).getByText("346")).toBeInTheDocument();
    expect(within(flights).getByText("270 nacionales · 76 internacionales")).toBeInTheDocument();
    const occupancy = kpi("Ocupación");
    expect(within(occupancy).getByText("5,0 %")).toBeInTheDocument();
    expect(within(occupancy).getByText(/3\.000 de 60\.000 asientos/)).toBeInTheDocument();
    expect(within(kpi("Tickets vendidos")).getByText("410")).toBeInTheDocument();
    expect(within(kpi("Ingresos")).getByText(/USD 125\.43\d/)).toBeInTheDocument();
    expect(within(kpi("Con novedades")).getByText("6")).toBeInTheDocument();
  });

  it("incluye las tres gráficas con su etiqueta accesible", async () => {
    fetchMock.mockResolvedValue(jsonResponse(overviewFixture));
    renderSection();
    await screen.findByText("Vuelos por hora");
    expect(screen.getByRole("img", { name: /Vuelos por hora de salida/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Ocupación por tipo de ruta/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Vuelos por estado" })).toBeInTheDocument();
  });

  it("si el servidor falla muestra el error", async () => {
    fetchMock.mockResolvedValue(jsonResponse(problemBody(500, "INTERNAL_ERROR", "Falló"), 500));
    renderSection();
    expect(await screen.findByRole("alert")).toHaveTextContent(/No se pudo cargar el resumen/);
  });
});
