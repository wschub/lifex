import { describe, expect, it } from "vitest";
import { summarizeOverview } from "../../../../src/modules/dashboard/application/use-cases/dashboard.use-cases.ts";
import type { OverviewRaw } from "../../../../src/modules/dashboard/domain/entities/dashboard-overview.ts";

/** Hora local de Colombia (UTC-5) → instante UTC del 2026-12-10. */
const at = (hour: number, minute = 0) => new Date(Date.UTC(2026, 11, 10, hour + 5, minute));

const flight = (
  routeType: "DOMESTIC" | "INTERNATIONAL",
  hour: number,
  status: string,
  max: number,
  available: number,
) => ({
  status,
  routeType,
  departureDate: at(hour),
  numMaxSeats: max,
  numAvailableSeats: available,
});

const RAW: OverviewRaw = {
  flights: [
    flight("DOMESTIC", 6, "ACTIVE", 150, 100), // 50 vendidos
    flight("DOMESTIC", 6, "DELAYED", 150, 150),
    flight("DOMESTIC", 15, "ACTIVE", 150, 130), // 20 vendidos
    flight("INTERNATIONAL", 15, "ACTIVE", 242, 142), // 100 vendidos
    flight("INTERNATIONAL", 23, "CANCELLED", 290, 290),
  ],
  classSeats: [
    { seatClass: "ECONOMY", status: "RESERVED", count: 150 },
    { seatClass: "ECONOMY", status: "FREE", count: 700 },
    { seatClass: "BUSINESS", status: "RESERVED", count: 20 },
    { seatClass: "BUSINESS", status: "FREE", count: 82 },
    { seatClass: "BUSINESS", status: "BLOCKED", count: 5 },
  ],
  sales: { tickets: 170, revenueUsd: 24_500.5 },
};

describe("indicadores del panel (summarizeOverview)", () => {
  const overview = summarizeOverview("2026-12-10", RAW);

  it("cuenta los vuelos por tipo y por estado", () => {
    expect(overview.date).toBe("2026-12-10");
    expect(overview.flights).toEqual({
      total: 5,
      domestic: 3,
      international: 2,
      byStatus: { ACTIVE: 3, DELAYED: 1, CANCELLED: 1 },
    });
    expect(overview.disruptions).toBe(2); // retrasado + cancelado
  });

  it("calcula la ocupación total y por tipo de ruta con un decimal", () => {
    // 5 vuelos: 150+150+150+242+290 = 982 asientos; vendidos 50+0+20+100+0 = 170
    expect(overview.seats).toMatchObject({
      total: 982,
      sold: 170,
      available: 812,
      occupancyRate: 17.3,
    });
    expect(overview.seats.byRouteType.domestic).toEqual({
      total: 450,
      sold: 70,
      occupancyRate: 15.6,
    });
    expect(overview.seats.byRouteType.international).toEqual({
      total: 532,
      sold: 100,
      occupancyRate: 18.8,
    });
  });

  it("calcula la ocupación por clase contando solo los asientos RESERVED como vendidos", () => {
    expect(overview.seats.byClass.economy).toEqual({ total: 850, sold: 150, occupancyRate: 17.6 });
    expect(overview.seats.byClass.business).toEqual({ total: 107, sold: 20, occupancyRate: 18.7 });
  });

  it("agrupa las salidas por hora local de Colombia, separando nacionales e internacionales", () => {
    expect(overview.byHour).toHaveLength(24);
    expect(overview.byHour[6]).toEqual({ hour: 6, domestic: 2, international: 0 });
    expect(overview.byHour[15]).toEqual({ hour: 15, domestic: 1, international: 1 });
    expect(overview.byHour[23]).toEqual({ hour: 23, domestic: 0, international: 1 });
    expect(overview.byHour[0]).toEqual({ hour: 0, domestic: 0, international: 0 });
  });

  it("incluye las ventas y no divide por cero cuando no hay vuelos", () => {
    expect(overview.sales).toEqual({ ticketsSold: 170, revenueUsd: 24_500.5 });
    const empty = summarizeOverview("2026-12-11", {
      flights: [],
      classSeats: [],
      sales: { tickets: 0, revenueUsd: 0 },
    });
    expect(empty.seats).toMatchObject({ total: 0, sold: 0, occupancyRate: 0 });
    expect(empty.flights).toEqual({ total: 0, domestic: 0, international: 0, byStatus: {} });
  });
});
