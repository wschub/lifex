import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorld, type World } from "../../helpers/lifex-world.ts";

describe("bloqueo de asientos (Postgres real)", () => {
  let world: World;

  beforeAll(async () => {
    world = await createWorld();
  });
  afterAll(async () => {
    await world?.stop();
  });

  it("2.1 al bloquear un asiento FREE pasa a BLOCKED con hold_expires_at = ahora + MAX_SEAT_LOCK_TIME", async () => {
    const booking = await world.startBooking();
    const seat = await world.seatId("02A");

    const res = await world.hold(booking, seat);

    expect(res.status).toBe(200);
    const row = await world.prisma.flightSeat.findUniqueOrThrow({ where: { id: seat } });
    expect(row.seatStatus).toBe("BLOCKED");
    expect(row.heldBySession).toBe(booking.id);
    const expected = world.clock.now().getTime() + 15 * 60_000;
    expect(Math.abs((row.holdExpiresAt?.getTime() ?? 0) - expected)).toBeLessThan(5000);
  });

  it("2.2 con 50 intentos paralelos sobre el mismo asiento, exactamente uno gana y el resto recibe 409", async () => {
    const seat = await world.seatId("02B");
    const bookings = await Promise.all(Array.from({ length: 50 }, () => world.startBooking()));

    const results = await Promise.all(bookings.map((booking) => world.hold(booking, seat)));

    const statuses = results.map((res) => res.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(49);
    const events = await world.prisma.outboxEvent.count({
      where: { eventType: "SeatHeld", payload: { path: ["seatId"], equals: seat } },
    });
    expect(events).toBe(1);
  });

  it("2.4 un bloqueo vencido se puede volver a bloquear sin esperar al job (expiración perezosa)", async () => {
    const seat = await world.seatId("02C");
    const first = await world.startBooking();
    const second = await world.startBooking();
    expect((await world.hold(first, seat)).status).toBe(200);
    expect((await world.hold(second, seat)).status).toBe(409);

    world.clock.advanceMinutes(16);
    const retry = await world.hold(second, seat);

    expect(retry.status).toBe(200);
    const row = await world.prisma.flightSeat.findUniqueOrThrow({ where: { id: seat } });
    expect(row.heldBySession).toBe(second.id);
  });

  it("2.5 el job libera los bloqueos vencidos y escribe SeatReleased", async () => {
    const seat = await world.seatId("02D");
    const booking = await world.startBooking();
    await world.hold(booking, seat);

    // Antes de que venza, el job no lo toca (otros bloqueos viejos de esta suite sí pueden liberarse).
    await world.composed.releaseExpiredHolds.execute();
    expect(
      (await world.prisma.flightSeat.findUniqueOrThrow({ where: { id: seat } })).seatStatus,
    ).toBe("BLOCKED");
    world.clock.advanceMinutes(16);
    const released = await world.composed.releaseExpiredHolds.execute();

    expect(released).toBeGreaterThanOrEqual(1);
    const row = await world.prisma.flightSeat.findUniqueOrThrow({ where: { id: seat } });
    expect([row.seatStatus, row.heldBySession, row.holdExpiresAt]).toEqual(["FREE", null, null]);
    const event = await world.prisma.outboxEvent.findFirst({
      where: { eventType: "SeatReleased", payload: { path: ["seatId"], equals: seat } },
    });
    expect(event?.payload).toMatchObject({ reason: "expired", status: "FREE" });
  });

  it("2.6 una sesión no puede mantener más de N asientos bloqueados a la vez", async () => {
    const booking = await world.startBooking();
    const results = [];
    for (const identifier of ["03A", "03B", "03C", "03D"]) {
      results.push(await world.hold(booking, await world.seatId(identifier)));
    }

    expect(results.map((res) => res.status)).toEqual([200, 200, 200, 409]);
    expect(results[3]?.body.code).toBe("TOO_MANY_HELD_SEATS");
  });

  it("el dueño puede soltar su asiento y otro lo puede tomar; un tercero no puede soltarlo", async () => {
    const seat = await world.seatId("01A");
    const owner = await world.startBooking();
    const other = await world.startBooking();
    await world.hold(owner, seat);

    const stranger = await world.hold(other, seat);
    expect(stranger.status).toBe(409);
    const foreignRelease = await import("supertest").then(({ default: request }) =>
      request(world.app)
        .delete(`/flights/${world.flight.id}/seats/${seat}/hold`)
        .set("Authorization", other.auth),
    );
    expect(foreignRelease.status).toBe(409);
    const ownRelease = await import("supertest").then(({ default: request }) =>
      request(world.app)
        .delete(`/flights/${world.flight.id}/seats/${seat}/hold`)
        .set("Authorization", owner.auth),
    );
    expect(ownRelease.status).toBe(204);
    expect((await world.hold(other, seat)).status).toBe(200);
  });

  it("una sesión de invitado sin token o con un token de otra audiencia no puede bloquear", async () => {
    const seat = await world.seatId("01C");
    const anonymous = await import("supertest").then(({ default: request }) =>
      request(world.app).post(`/flights/${world.flight.id}/seats/${seat}/hold`),
    );
    const staffToken = await world.hold({ auth: world.staff.admin as string }, seat);

    expect(anonymous.status).toBe(401);
    expect(staffToken.status).toBe(401);
  });
});
