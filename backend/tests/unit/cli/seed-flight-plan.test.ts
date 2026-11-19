import { describe, expect, it } from "vitest";
import { DAY_MS, planFlights, type PlanInput } from "../../../src/cli/seed/flight-plan.ts";

const CITIES = ["MDE", "BOG", "CTG", "SMR", "BAQ", "ADZ", "CLO", "BGA", "PEI", "AXM"];
const DESTINATIONS = ["WAS", "MIA", "PTY", "LHR", "MAN", "MAD", "BCN", "CDG", "NCE", "BER", "MUC"]
  .concat(["LIS", "OPO", "BRU", "FCO", "MXP", "ZRH", "GVA", "AMS"])
  .map((iata) => ({ iata, minutes: 600 }));

const START = Date.UTC(2026, 10, 19); // 2026-11-19
const END = Date.UTC(2027, 0, 31); // 2027-01-31
const DAYS = (END - START) / DAY_MS + 1; // 74

function input(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    startDay: START,
    endDay: END,
    now: new Date(START - DAY_MS), // todo el rango es futuro
    domesticIatas: CITIES,
    internationalDestinations: DESTINATIONS,
    internationalOrigins: ["MDE", "BOG"],
    ...overrides,
  };
}

/** Hora local de Colombia (UTC-5) de un vuelo. */
const localHour = (date: Date): number => new Date(date.getTime() - 5 * 3_600_000).getUTCHours();

describe("plan de vuelos del seed", () => {
  const plans = planFlights(input());
  const domestic = plans.filter((plan) => plan.type === "DOMESTIC");
  const international = plans.filter((plan) => plan.type === "INTERNATIONAL");

  it("hay 90 rutas nacionales con 3 vuelos diarios y 38 internacionales con 2, todos los días", () => {
    expect(domestic).toHaveLength(90 * 3 * DAYS);
    expect(international).toHaveLength(38 * 2 * DAYS);
    const routes = new Set(domestic.map((plan) => `${plan.fromIata}-${plan.toIata}`));
    expect(routes.size).toBe(90);
    expect(new Set(international.map((plan) => `${plan.fromIata}-${plan.toIata}`)).size).toBe(38);
  });

  it("cada ruta nacional sale una vez en la mañana, la tarde y la noche cada día", () => {
    const route = domestic.filter((plan) => plan.fromIata === "MDE" && plan.toIata === "BOG");
    expect(route).toHaveLength(3 * DAYS);
    const firstDay = route.slice(0, 3).map((plan) => localHour(plan.departure));
    expect(firstDay.sort((a, b) => a - b)).toEqual([
      expect.toSatisfy((h: number) => h >= 5 && h <= 11),
      expect.toSatisfy((h: number) => h >= 12 && h <= 17),
      expect.toSatisfy((h: number) => h >= 18 && h <= 23),
    ]);
  });

  it("las rutas internacionales salen solo de Medellín o Bogotá, una vez en la tarde y otra en la noche", () => {
    expect(new Set(international.map((plan) => plan.fromIata))).toEqual(new Set(["MDE", "BOG"]));
    const route = international.filter((plan) => plan.fromIata === "BOG" && plan.toIata === "MAD");
    const hours = route.slice(0, 2).map((plan) => localHour(plan.departure));
    expect(hours[0]).toBeGreaterThanOrEqual(12);
    expect(hours[0]).toBeLessThanOrEqual(17);
    expect(hours[1]).toBeGreaterThanOrEqual(18);
  });

  it("ninguna ruta repite su salida y el plan es determinista (volver a ejecutarlo da lo mismo)", () => {
    const keys = plans.map(
      (plan) => `${plan.fromIata}-${plan.toIata}|${plan.departure.toISOString()}`,
    );
    expect(new Set(keys).size).toBe(plans.length);
    expect(planFlights(input()).map((plan) => plan.departure.getTime())).toEqual(
      plans.map((plan) => plan.departure.getTime()),
    );
  });

  it("no hay vuelos fuera del rango ni vuelos de hoy que ya salieron", () => {
    const last = plans.map((plan) => plan.departure.getTime()).sort((a, b) => b - a)[0]!;
    expect(last).toBeLessThan(END + DAY_MS + 5 * 3_600_000);
    const afternoon = new Date(START + 14 * 3_600_000 + 5 * 3_600_000); // hoy, 14:00 hora Colombia
    const today = planFlights(input({ now: afternoon, endDay: START }));
    expect(today.every((plan) => plan.departure.getTime() > afternoon.getTime())).toBe(true);
    expect(today.length).toBeGreaterThan(0);
    expect(today.length).toBeLessThan(90 * 3 + 38 * 2);
  });
});
