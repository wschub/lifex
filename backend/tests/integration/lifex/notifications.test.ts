import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorld, type World } from "../../helpers/lifex-world.ts";

describe("correos al cliente (Postgres real)", () => {
  let world: World;

  beforeAll(async () => {
    world = await createWorld();
  });
  afterAll(async () => {
    await world?.stop();
  });

  /** Una reserva pagada y confirmada; devuelve su id. */
  async function confirmedOrder(flightId: string, email: string, seats: string[]) {
    const booking = await world.startBooking(flightId, email);
    const ids = [];
    for (const identifier of seats) {
      const seat = await world.seatId(identifier, flightId);
      await world.hold(booking, seat, flightId);
      ids.push(seat);
    }
    const res = await world.setPassengers(
      booking,
      ids.map((seat, index) =>
        world.passenger(seat, {
          fullName: ["Alfa", "Beta"][index] ?? "Gamma",
          documentNumber: `10000${index}`,
        }),
      ),
    );
    expect(res.status).toBe(200);
    await world.pay(booking, `key-${booking.id}`);
    await world.drainOutbox(2);
    expect((await world.prisma.order.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
      "CONFIRMED",
    );
    return booking;
  }

  const patchStatus = (flightId: string, status: string) =>
    request(world.app)
      .patch(`/flights/${flightId}/status`)
      .set("Authorization", world.staff.admin as string)
      .send({ status });

  it("un correo por ticket al confirmar la compra, al correo de contacto, con el QR", async () => {
    const booking = await confirmedOrder(world.flight.id, "dos-pasajeros@example.com", [
      "02A",
      "02B",
    ]);

    const sent = world.notifier.tickets.filter((item) => item.confirmation.orderId === booking.id);

    expect(sent).toHaveLength(2);
    expect(sent.map((item) => item.confirmation.contactEmail)).toEqual([
      "dos-pasajeros@example.com",
      "dos-pasajeros@example.com",
    ]);
    expect(new Set(sent.map((item) => item.ticket.ticketCode)).size).toBe(2);
    expect(sent[0]?.confirmation.buyerFirstName).toBe("Alfa");
    expect(sent[0]?.confirmation.locale).toBe("es");
  });

  it("el idioma del comprador (Accept-Language) queda en la reserva", async () => {
    const res = await request(world.app)
      .post("/bookings")
      .set("Accept-Language", "en-US,en;q=0.9")
      .send({ flightId: world.flight.id, contactEmail: "en@example.com" });

    const order = await world.prisma.order.findUniqueOrThrow({
      where: { id: res.body.booking.id },
    });
    expect(order.locale).toBe("en");
  });

  it("4.6 al CANCELAR el vuelo se avisa por correo a cada orden ya pagada, y solo a esas", async () => {
    const flight = await world.createFlight(new Date("2026-12-05T15:00:00Z"));
    const first = await confirmedOrder(
      flight.id,
      "uno@example.com",
      ["02A", "02B"].map((x) => x),
    );
    const second = await confirmedOrder(flight.id, "dos@example.com", ["03A"]);
    const draft = await world.startBooking(flight.id, "borrador@example.com");
    await world.hold(draft, await world.seatId("03B", flight.id), flight.id);
    const other = await world.createFlight(new Date("2026-12-06T15:00:00Z"));
    await confirmedOrder(other.id, "otro-vuelo@example.com", ["02A"]);
    world.notifier.disruptions.length = 0;

    const res = await patchStatus(flight.id, "CANCELLED");
    expect(res.status).toBe(200);
    await world.drainOutbox(2);

    const sent = world.notifier.disruptions;
    expect(sent.map((item) => item.confirmation.contactEmail).sort()).toEqual([
      "dos@example.com",
      "uno@example.com",
    ]);
    expect(sent.every((item) => item.disruption === "CANCELLED")).toBe(true);
    // un solo correo por orden aunque tenga varios pasajeros, con todos listados
    const firstEmail = sent.find((item) => item.confirmation.orderId === first.id);
    expect(firstEmail?.confirmation.tickets).toHaveLength(2);
    expect(sent.some((item) => item.confirmation.orderId === second.id)).toBe(true);
    expect(sent.some((item) => item.confirmation.orderId === draft.id)).toBe(false);
  });

  it("4.6 un retraso también avisa; volver a ACTIVE o un cambio inválido no envía nada", async () => {
    const flight = await world.createFlight(new Date("2026-12-07T15:00:00Z"));
    await confirmedOrder(flight.id, "retraso@example.com", ["02C"]);
    world.notifier.disruptions.length = 0;

    await patchStatus(flight.id, "DELAYED");
    await world.drainOutbox(2);
    expect(
      world.notifier.disruptions.map((item) => [item.confirmation.contactEmail, item.disruption]),
    ).toEqual([["retraso@example.com", "DELAYED"]]);

    world.notifier.disruptions.length = 0;
    await patchStatus(flight.id, "ACTIVE");
    await patchStatus(flight.id, "SOLD_OUT"); // inválido: 409
    await world.drainOutbox(2);
    expect(world.notifier.disruptions).toHaveLength(0);
  });

  it("4.7 si el correo falla, el cambio de estado se mantiene y el aviso se reintenta sin duplicar", async () => {
    const flight = await world.createFlight(new Date("2026-12-08T15:00:00Z"));
    await confirmedOrder(flight.id, "reintento@example.com", ["02D"]);
    world.notifier.disruptions.length = 0;
    world.notifier.failing = true;

    const res = await patchStatus(flight.id, "CANCELLED");
    await world.composed.processOutbox.execute();
    expect(res.status).toBe(200);
    expect(
      (await world.prisma.scheduledFlight.findUniqueOrThrow({ where: { id: flight.id } })).status,
    ).toBe("CANCELLED");
    expect(world.notifier.disruptions).toHaveLength(0);

    world.notifier.failing = false;
    await world.drainOutbox(3);
    await world.drainOutbox(2);
    expect(world.notifier.disruptions).toHaveLength(1);
  });

  it("sirve la imagen QR de un ticket real y responde 404 para cualquier otro código", async () => {
    const { ticketCode } = await world.prisma.ticket.findFirstOrThrow();

    const png = await request(world.app)
      .get(`/tickets/${ticketCode}/qr.png`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    const unknown = await request(world.app).get("/tickets/LXAAAAAAAAAA/qr.png");
    const malformed = await request(world.app).get("/tickets/hola/qr.png");

    expect(png.status).toBe(200);
    expect(png.headers["content-type"]).toBe("image/png");
    expect(png.headers["cache-control"]).toContain("max-age");
    // Los correos y el front (otro origen) deben poder mostrar la imagen.
    expect(png.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect((png.body as Buffer).subarray(1, 4).toString()).toBe("PNG");
    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(404);
  });
});
