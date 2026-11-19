import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorld, type World } from "../../helpers/lifex-world.ts";

const DAY = 86_400_000;

interface Offer {
  id: string;
  routeType: string;
  from: { iataCode: string };
  to: { iataCode: string };
  priceEconomyUsd: number;
  priceBusinessUsd: number;
  offer: { discountPercentage: number } | null;
}

describe("ofertas de la portada (Postgres real)", () => {
  let world: World;

  beforeAll(async () => {
    world = await createWorld();
  });
  afterAll(async () => {
    await world?.stop();
  });

  const inDays = (days: number) => new Date(world.clock.now().getTime() + days * DAY);
  const offers = async (): Promise<Offer[]> =>
    (await request(world.app).get("/flights/offers")).body.offers as Offer[];

  it("es público y devuelve vacío si no hay vuelos en la ventana", async () => {
    const res = await request(world.app).get("/flights/offers");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ offers: [] });
  });

  it("solo incluye vuelos que salen entre 8 y 30 días desde hoy", async () => {
    const days = [5, 7, 9, 29, 31, 40];
    const ids = new Map<number, string>();
    for (const d of days) {
      const route = await world.createRoute("DOMESTIC");
      ids.set(d, (await world.createFlight(inDays(d), "ACTIVE", { routeId: route.id })).id);
    }

    const listed = (await offers()).map((o) => o.id);

    expect(listed).toContain(ids.get(9));
    expect(listed).toContain(ids.get(29));
    for (const d of [5, 7, 31, 40]) expect(listed).not.toContain(ids.get(d));
  });

  it("no repite ruta aunque tenga varios vuelos elegibles", async () => {
    const route = await world.createRoute("DOMESTIC");
    for (const d of [12, 13, 14]) {
      await world.createFlight(inDays(d), "ACTIVE", { routeId: route.id });
    }

    const listed = await offers();
    const rows = await world.prisma.scheduledFlight.findMany({
      where: { id: { in: listed.map((o) => o.id) } },
      select: { flightRouteId: true },
    });

    expect(rows.filter((r) => r.flightRouteId === route.id)).toHaveLength(1);
    expect(new Set(rows.map((r) => r.flightRouteId)).size).toBe(rows.length);
  });

  it("excluye los vuelos que no cumplen ningún criterio y los finalizados", async () => {
    const route = await world.createRoute("DOMESTIC");
    const full = await world.createFlight(inDays(15), "ACTIVE", {
      routeId: route.id,
      occupancyRate: 90,
      numAvailableSeats: 10,
      averagePriceEconomy: 500,
      averagePriceBusiness: 2000,
    });
    const otherRoute = await world.createRoute("DOMESTIC");
    const finalized = await world.createFlight(inDays(15), "FINALIZED", { routeId: otherRoute.id });

    const listed = (await offers()).map((o) => o.id);

    expect(listed).not.toContain(full.id);
    expect(listed).not.toContain(finalized.id);
  });

  it("el precio de la oferta coincide con GET /flights y con el que se congela al bloquear", async () => {
    const route = await world.createRoute("INTERNATIONAL");
    const flight = await world.createFlight(inDays(20), "ACTIVE", { routeId: route.id });

    const offer = (await offers()).find((o) => o.id === flight.id)!;
    // base 100 con 15 % de descuento (OFFER_DISCOUNT_PERCENTAGE); Business: 100 × 3 × 0,85.
    expect(offer).toMatchObject({
      priceEconomyUsd: 85,
      priceBusinessUsd: 255,
      offer: { discountPercentage: 15 },
    });

    const detail = await request(world.app).get(`/flights/${flight.id}`);
    expect(detail.body.flight).toMatchObject({ priceEconomyUsd: 85, priceBusinessUsd: 255 });

    const booking = await world.startBooking(flight.id);
    const held = await world.hold(booking, await world.seatId("02A", flight.id), flight.id);
    expect(held.body.seat.priceUsd).toBe(85);
  });
});

describe("ofertas: máximo 5 nacionales y 5 internacionales (Postgres real)", () => {
  let world: World;

  beforeAll(async () => {
    world = await createWorld();
  });
  afterAll(async () => {
    await world?.stop();
  });

  it("devuelve hasta 5 de cada tipo, sin rutas repetidas", async () => {
    for (const type of ["DOMESTIC", "INTERNATIONAL"] as const) {
      for (let i = 0; i < 7; i += 1) {
        const route = await world.createRoute(type);
        await world.createFlight(new Date(world.clock.now().getTime() + (10 + i) * DAY), "ACTIVE", {
          routeId: route.id,
        });
      }
    }

    const res = await request(world.app).get("/flights/offers");
    const list = res.body.offers as Offer[];
    const byType = (type: string) => list.filter((o) => o.routeType === type);

    expect(res.status).toBe(200);
    expect(byType("DOMESTIC")).toHaveLength(5);
    expect(byType("INTERNATIONAL")).toHaveLength(5);
    expect(new Set(list.map((o) => `${o.from.iataCode}-${o.to.iataCode}`)).size).toBe(10);
  });
});
