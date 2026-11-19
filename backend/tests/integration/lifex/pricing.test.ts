import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorld, DECLINED_CARD, type World } from "../../helpers/lifex-world.ts";

const DAY = 86_400_000;

describe("precios dinámicos (Postgres real)", () => {
  let world: World;
  let nextDay = 100;

  beforeAll(async () => {
    world = await createWorld();
  });
  afterAll(async () => {
    await world?.stop();
  });

  /** Vuelo nuevo, lejos (fuera de ofertas y de las últimas 72 h), con promedios 100 / 300 y base 100. */
  const freshFlight = async (overrides = {}) => {
    nextDay += 1;
    const departure = new Date(world.flight.departureDate.getTime() + (nextDay - 90) * DAY);
    return world.createFlight(departure, "ACTIVE", overrides);
  };

  const readFlight = (id: string) =>
    world.prisma.scheduledFlight.findUniqueOrThrow({ where: { id } });

  it("GET /flights y /flights/:id traen el precio vigente por clase y sin oferta", async () => {
    // Promedio Economy 100 → 105; Business 300 → 315 (+5 % sobre cada promedio).
    const flight = await freshFlight();
    const date = flight.departureDate.toISOString().slice(0, 10);

    const list = await request(world.app).get(`/flights?from=MDE&to=BOG&date=${date}`);
    const detail = await request(world.app).get(`/flights/${flight.id}`);

    const expected = { priceEconomyUsd: 105, priceBusinessUsd: 315, offer: null };
    expect(list.body.flights[0]).toMatchObject(expected);
    expect(detail.body.flight).toMatchObject(expected);
  });

  it("sin compras previas (promedios en 0) el primer ticket sube 20 % sobre la base de la clase", async () => {
    const flight = await freshFlight({ averagePriceEconomy: 0, averagePriceBusiness: 0 });
    const detail = await request(world.app).get(`/flights/${flight.id}`);

    expect(detail.body.flight).toMatchObject({ priceEconomyUsd: 120, priceBusinessUsd: 360 });
  });

  it("el mapa de asientos muestra el precio vigente de su clase en los asientos libres", async () => {
    const flight = await freshFlight();
    const map = await request(world.app).get(`/flights/${flight.id}/seats`);
    const price = (id: string) =>
      map.body.seats.find((seat: { identifier: string }) => seat.identifier === id).priceUsd;

    expect(price("02A")).toBe(105);
    expect(price("01A")).toBe(315);
  });

  it("al bloquear, el precio se congela: el cambio posterior del promedio no lo toca", async () => {
    const flight = await freshFlight();
    const booking = await world.startBooking(flight.id);
    const seat = await world.seatId("02A", flight.id);

    const held = await world.hold(booking, seat, flight.id);
    expect(held.body.seat.priceUsd).toBe(105);

    await world.prisma.scheduledFlight.update({
      where: { id: flight.id },
      data: { averagePriceEconomy: 200 },
    });
    const map = await request(world.app).get(`/flights/${flight.id}/seats`);
    const byId = (id: string) =>
      map.body.seats.find((s: { identifier: string }) => s.identifier === id);
    expect(byId("02A").priceUsd).toBe(105); // bloqueado: conserva el congelado
    expect(byId("02B").priceUsd).toBe(210); // libre: ya sigue el nuevo promedio

    const priced = await world.setPassengers(booking, [world.passenger(seat)]);
    expect(priced.body.booking.flightPriceUsd).toBe(105);
  });

  it("tras un pago aprobado se recalculan asientos, ocupación y promedios; el segundo precio sube", async () => {
    const flight = await freshFlight();

    const first = await world.startBooking(flight.id);
    const seatA = await world.seatId("02A", flight.id);
    await world.hold(first, seatA, flight.id);
    await world.setPassengers(first, [world.passenger(seatA)]);
    expect((await world.pay(first, "precio-pago-001")).status).toBe(202);
    await world.drainOutbox(2);

    const afterFirst = await readFlight(flight.id);
    expect(Number(afterFirst.averagePriceEconomy)).toBe(105);
    expect(Number(afterFirst.averagePriceBusiness)).toBe(0); // sin ventas en Business
    expect(afterFirst.numAvailableSeats).toBe(11);
    expect(Number(afterFirst.occupancyRate)).toBe(8.33);

    // El segundo comprador ve 105 × 1,05 = 110,25.
    const second = await world.startBooking(flight.id, "otro@example.com");
    const seatB = await world.seatId("02B", flight.id);
    expect((await world.hold(second, seatB, flight.id)).body.seat.priceUsd).toBe(110.25);
    await world.setPassengers(second, [world.passenger(seatB)]);
    expect((await world.pay(second, "precio-pago-002")).status).toBe(202);
    await world.drainOutbox(2);

    const afterSecond = await readFlight(flight.id);
    expect(Number(afterSecond.averagePriceEconomy)).toBeCloseTo(107.63, 1); // (105 + 110,25) / 2
    expect(afterSecond.numAvailableSeats).toBe(10);
    expect(Number(afterSecond.occupancyRate)).toBe(16.67);
  });

  it("un pago rechazado no actualiza ninguna cifra del vuelo", async () => {
    const flight = await freshFlight();
    const booking = await world.startBooking(flight.id);
    const seat = await world.seatId("02C", flight.id);
    await world.hold(booking, seat, flight.id);
    await world.setPassengers(booking, [world.passenger(seat)]);
    await world.pay(booking, "precio-rechazado-01", DECLINED_CARD);
    await world.drainOutbox(2);

    const after = await readFlight(flight.id);
    expect(Number(after.averagePriceEconomy)).toBe(100);
    expect(after.numAvailableSeats).toBe(12);
    expect(Number(after.occupancyRate)).toBe(0);
  });
});
