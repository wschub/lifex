import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorld, type World } from "../../helpers/lifex-world.ts";

describe("búsqueda de vuelos y dashboard (Postgres real)", () => {
  let world: World;

  beforeAll(async () => {
    world = await createWorld();
    // Mismo día/ruta: uno FINALIZED (no debe aparecer) y otro agotado (debe aparecer marcado).
    await world.createFlight(new Date("2026-12-01T20:00:00Z"), "FINALIZED");
    const soldOut = await world.createFlight(new Date("2026-12-01T22:00:00Z"));
    await world.prisma.scheduledFlight.update({
      where: { id: soldOut.id },
      data: { status: "SOLD_OUT", numAvailableSeats: 0 },
    });
  });
  afterAll(async () => {
    await world?.stop();
  });

  it("1.1 / 1.2 / 1.5 devuelve solo vuelos buscables, con tarifa, horario, clases y agotados marcados", async () => {
    const res = await request(world.app).get("/flights?from=MDE&to=BOG&date=2026-12-01");

    expect(res.status).toBe(200);
    expect(res.body.flights).toHaveLength(2);
    expect(res.body.flights.map((f: { status: string }) => f.status)).toEqual([
      "ACTIVE",
      "SOLD_OUT",
    ]);
    const [active, soldOut] = res.body.flights;
    expect(active).toMatchObject({
      basePriceUsd: 100,
      averagePriceBusinessUsd: 300,
      numAvailableSeats: 12,
      availableByClass: { economy: 8, business: 4 },
      departureDate: "2026-12-01T15:00:00.000Z",
      soldOut: false,
    });
    expect(soldOut.soldOut).toBe(true);
  });

  it("1.3 sin resultados responde 200 con lista vacía, no 404", async () => {
    const res = await request(world.app).get("/flights?from=MDE&to=BOG&date=2030-01-01");

    expect([res.status, res.body]).toEqual([200, { flights: [] }]);
  });

  it("valida los parámetros de la búsqueda", async () => {
    const bad = await request(world.app).get("/flights?from=MDE&to=BOG&date=01-12-2026");
    const missing = await request(world.app).get("/flights?from=MDE");

    expect([bad.status, bad.body.code]).toEqual([400, "INVALID_SEARCH_DATE"]);
    expect(missing.status).toBe(400);
  });

  it("4.1 el dashboard exige autenticación (401) y el permiso dashboard:read (403)", async () => {
    const url = `/dashboard/flights/${world.flight.id}`;

    const anonymous = await request(world.app).get(url);
    const nobody = await request(world.app)
      .get(url)
      .set("Authorization", world.staff.nobody as string);
    const viewer = await request(world.app)
      .get(url)
      .set("Authorization", world.staff.viewer as string);

    expect(anonymous.status).toBe(401);
    expect([nobody.status, nobody.body.code]).toEqual([403, "PERMISSION_DENIED"]);
    expect(viewer.status).toBe(200);
  });

  it("4.2 las cifras del dashboard coinciden exactamente con la tabla de asientos", async () => {
    const booking = await world.startBooking();
    for (const identifier of ["02A", "02B"])
      await world.hold(booking, await world.seatId(identifier));
    await world.prisma.flightSeat.update({
      where: { id: await world.seatId("03A") },
      data: { seatStatus: "PAYMENT_PENDING" },
    });
    await world.prisma.flightSeat.update({
      where: { id: await world.seatId("01A") },
      data: { seatStatus: "RESERVED" },
    });

    const res = await request(world.app)
      .get(`/dashboard/flights/${world.flight.id}`)
      .set("Authorization", world.staff.admin as string);

    expect(res.body.metrics.seats).toEqual({ free: 8, blocked: 2, paymentPending: 1, reserved: 1 });
    expect(res.body.metrics.byClass.business).toEqual({
      free: 3,
      blocked: 0,
      paymentPending: 0,
      reserved: 1,
    });
    const grouped = await world.prisma.flightSeat.groupBy({
      by: ["seatStatus"],
      where: { scheduledFlightId: world.flight.id },
      _count: { _all: true },
    });
    const total = grouped.reduce((sum, group) => sum + group._count._all, 0);
    expect(total).toBe(12);
  });

  it("lista los vuelos para elegir cuál monitorear (con permiso)", async () => {
    const denied = await request(world.app).get("/dashboard/flights?date=2026-12-01");
    const ok = await request(world.app)
      .get("/dashboard/flights?date=2026-12-01")
      .set("Authorization", world.staff.viewer as string);

    expect(denied.status).toBe(401);
    expect(ok.body.flights.length).toBeGreaterThanOrEqual(3);
  });

  it("4.4 solo flights:manage cambia el estado de un vuelo; el visor recibe 403", async () => {
    const url = `/flights/${world.flight.id}/status`;

    const viewer = await request(world.app)
      .patch(url)
      .set("Authorization", world.staff.viewer as string)
      .send({ status: "DELAYED" });
    const anonymous = await request(world.app).patch(url).send({ status: "DELAYED" });
    const admin = await request(world.app)
      .patch(url)
      .set("Authorization", world.staff.admin as string)
      .send({ status: "DELAYED" });

    expect(viewer.status).toBe(403);
    expect(anonymous.status).toBe(401);
    expect(admin.status).toBe(200);
    expect(admin.body.flight).toMatchObject({ status: "DELAYED", previous: "ACTIVE" });
    const event = await world.prisma.outboxEvent.findFirstOrThrow({
      where: { eventType: "FlightStatusChanged" },
    });
    expect(event.payload).toMatchObject({
      flightId: world.flight.id,
      status: "DELAYED",
      previousStatus: "ACTIVE",
    });
  });

  it("rechaza cambios de estado inválidos (SOLD_OUT a mano, o salir de un estado final)", async () => {
    const url = `/flights/${world.flight.id}/status`;
    const admin = world.staff.admin as string;

    const soldOut = await request(world.app)
      .patch(url)
      .set("Authorization", admin)
      .send({ status: "SOLD_OUT" });
    await request(world.app).patch(url).set("Authorization", admin).send({ status: "CANCELLED" });
    const revive = await request(world.app)
      .patch(url)
      .set("Authorization", admin)
      .send({ status: "ACTIVE" });

    expect([soldOut.status, soldOut.body.code]).toEqual([409, "INVALID_FLIGHT_STATUS"]);
    expect([revive.status, revive.body.code]).toEqual([409, "INVALID_FLIGHT_STATUS"]);
  });

  it("un vuelo CANCELLED ya no admite bloqueos ni reservas nuevas", async () => {
    const booking = await world.startBooking(world.flight.id).catch((error: Error) => error);
    expect(booking).toBeInstanceOf(Error);
    const res = await request(world.app)
      .post("/bookings")
      .send({ flightId: world.flight.id, contactEmail: "a@b.co" });
    expect([res.status, res.body.code]).toEqual([409, "FLIGHT_NOT_BOOKABLE"]);
  });
});
