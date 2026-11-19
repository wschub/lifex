import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorld, DECLINED_CARD, TIMEOUT_CARD, type World } from "../../helpers/lifex-world.ts";

describe("reserva y pago (Postgres real)", () => {
  let world: World;

  beforeAll(async () => {
    world = await createWorld();
  });
  afterAll(async () => {
    await world?.stop();
  });

  /** Bloquea un asiento, registra al pasajero y devuelve la reserva lista para pagar. */
  async function readyBooking(identifier: string, passengerExtra: Record<string, unknown> = {}) {
    const booking = await world.startBooking();
    const seat = await world.seatId(identifier);
    expect((await world.hold(booking, seat)).status).toBe(200);
    const res = await world.setPassengers(booking, [world.passenger(seat, passengerExtra)]);
    expect(res.status).toBe(200);
    return { booking, seat, priced: res.body.booking };
  }

  const seatStatus = async (seatId: string) =>
    (await world.prisma.flightSeat.findUniqueOrThrow({ where: { id: seatId } })).seatStatus;

  it("calcula el precio: asiento + recargo de equipaje + impuestos", async () => {
    const { priced } = await readyBooking("02A", { luggageTypeId: 1 });

    // Asiento Economy a precio vigente 105 USD (promedio 100 +5 %) + 10% de equipaje (costo adicional,
    // sobre el precio del asiento) = 115.50; impuestos 19% = 21.95; total 137.45
    expect([priced.flightPriceUsd, priced.taxesUsd, priced.totalPriceUsd]).toEqual([
      115.5, 21.95, 137.45,
    ]);
  });

  it("el equipaje Business solo se acepta con un asiento BUSINESS", async () => {
    const booking = await world.startBooking();
    const economy = await world.seatId("02B");
    const business = await world.seatId("01A");
    await world.hold(booking, economy);
    await world.hold(booking, business);
    const businessLuggage = (
      await world.prisma.luggageType.findFirstOrThrow({ where: { name: "Business Flex" } })
    ).id;

    const rejected = await world.setPassengers(booking, [
      world.passenger(economy, { luggageTypeId: businessLuggage }),
    ]);
    const accepted = await world.setPassengers(booking, [
      world.passenger(business, { luggageTypeId: businessLuggage }),
    ]);

    expect([rejected.status, rejected.body.code]).toEqual([400, "LUGGAGE_NOT_ALLOWED"]);
    expect(accepted.status).toBe(200);
  });

  it("no acepta pasajeros con un asiento que la sesión no tiene bloqueado", async () => {
    const booking = await world.startBooking();
    const other = await world.startBooking();
    const seat = await world.seatId("02C");
    await world.hold(other, seat);

    const res = await world.setPassengers(booking, [world.passenger(seat)]);

    expect([res.status, res.body.code]).toEqual([409, "PASSENGERS_SEATS_MISMATCH"]);
  });

  it("una sesión de invitado no puede tocar la reserva de otra", async () => {
    const mine = await world.startBooking();
    const theirs = await world.startBooking();

    const res = await request(world.app)
      .get(`/bookings/${theirs.id}`)
      .set("Authorization", mine.auth);

    expect([res.status, res.body.code]).toEqual([403, "GUEST_TOKEN_MISMATCH"]);
  });

  it("3.1 sin Idempotency-Key responde 400", async () => {
    const { booking } = await readyBooking("02D");

    const res = await world.pay(booking, undefined);

    expect([res.status, res.body.code]).toEqual([400, "IDEMPOTENCY_KEY_REQUIRED"]);
  });

  it("3.2–3.5 pago aprobado: idempotente, PAYMENT_PENDING mientras se procesa y RESERVED + ticket al final", async () => {
    const { booking, seat } = await readyBooking("03A");
    const key = "key-aprobada-0001";

    const first = await world.pay(booking, key);
    const replay = await world.pay(booking, key);
    const reused = await world.pay(booking, key, "5555 5555 5555 4444");

    expect(first.status).toBe(202);
    expect(replay.status).toBe(202);
    expect(replay.body.payment.id).toBe(first.body.payment.id);
    expect([reused.status, reused.body.code]).toEqual([422, "IDEMPOTENCY_KEY_REUSED"]);
    expect(await world.prisma.payment.count({ where: { orderId: booking.id } })).toBe(1);

    // 3.4: en PAYMENT_PENDING el job de expiración no lo libera, aunque el bloqueo ya haya vencido.
    expect(await seatStatus(seat)).toBe("PAYMENT_PENDING");
    world.clock.advanceMinutes(30);
    await world.composed.releaseExpiredHolds.execute();
    expect(await seatStatus(seat)).toBe("PAYMENT_PENDING");

    await world.drainOutbox(2);

    // 3.5
    expect(await seatStatus(seat)).toBe("RESERVED");
    const order = await world.prisma.order.findUniqueOrThrow({ where: { id: booking.id } });
    expect(order.status).toBe("CONFIRMED");
    const tickets = await world.prisma.ticket.findMany({ where: { seatId: seat } });
    expect(tickets).toHaveLength(1);
    expect(tickets[0]?.ticketCode).toMatch(/^LX[A-Z2-9]{10}$/);
    const events = (await world.prisma.outboxEvent.findMany({ orderBy: { createdAt: "asc" } })).map(
      (e) => e.eventType,
    );
    expect(events).toEqual(expect.arrayContaining(["BookingConfirmed", "SeatSold"]));
    const flight = await world.prisma.scheduledFlight.findUniqueOrThrow({
      where: { id: world.flight.id },
    });
    expect(flight.numAvailableSeats).toBeLessThan(12);
    // 3.9: el correo salió con el ticket
    expect(world.notifier.tickets.at(-1)?.ticket.ticketCode).toBe(tickets[0]?.ticketCode);

    // 3.8: un asiento RESERVED no se puede volver a bloquear
    const another = await world.startBooking();
    expect((await world.hold(another, seat)).status).toBe(409);
  });

  it("3.7 nunca se guarda el número completo de la tarjeta, solo marca y últimos 4", async () => {
    const { booking } = await readyBooking("03B");
    await world.pay(booking, "key-sin-tarjeta-1");
    await world.drainOutbox(2);

    const payment = await world.prisma.payment.findFirstOrThrow({ where: { orderId: booking.id } });
    expect([payment.cardBrand, payment.cardLast4]).toEqual(["VISA", "4242"]);
    const dump = JSON.stringify([
      payment,
      await world.prisma.outboxEvent.findMany(),
      await world.prisma.order.findMany(),
    ]);
    expect(dump).not.toContain("4242424242424242");
    expect(dump).not.toContain("4242 4242");
  });

  it("3.6 pago rechazado: el asiento vuelve a FREE, la orden se cancela y se emite SeatReleased", async () => {
    const { booking, seat } = await readyBooking("03C");

    const res = await world.pay(booking, "key-rechazada-001", DECLINED_CARD);
    expect(res.status).toBe(202);
    expect(await seatStatus(seat)).toBe("PAYMENT_PENDING");
    await world.drainOutbox(2);

    expect(await seatStatus(seat)).toBe("FREE");
    expect((await world.prisma.order.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
      "CANCELLED",
    );
    expect(
      (await world.prisma.payment.findFirstOrThrow({ where: { orderId: booking.id } })).status,
    ).toBe("REJECTED");
    const released = await world.prisma.outboxEvent.findFirst({
      where: {
        eventType: "SeatReleased",
        payload: { path: ["reason"], equals: "payment_rejected" },
      },
    });
    expect(released).not.toBeNull();
  });

  it("timeout de la pasarela: se reintenta con backoff y, agotados los reintentos, se rechaza y libera el asiento", async () => {
    const { booking, seat } = await readyBooking("03D");
    await world.pay(booking, "key-timeout-0001", TIMEOUT_CARD);

    await world.composed.processOutbox.execute();
    const event = await world.prisma.outboxEvent.findFirstOrThrow({
      where: {
        eventType: "PaymentRequested",
        aggregateId: (
          await world.prisma.payment.findFirstOrThrow({ where: { orderId: booking.id } })
        ).id,
      },
    });
    expect([event.status, event.attempts]).toEqual(["PENDING", 1]);
    expect(await seatStatus(seat)).toBe("PAYMENT_PENDING");

    await world.drainOutbox(6);

    expect(await seatStatus(seat)).toBe("FREE");
    expect(
      (await world.prisma.payment.findFirstOrThrow({ where: { orderId: booking.id } })).status,
    ).toBe("REJECTED");
  });

  it("3.9 si el correo falla, la reserva sigue confirmada y el envío se reintenta", async () => {
    world.notifier.failing = true;
    const before = world.notifier.tickets.length;
    const { booking } = await readyBooking("01F");
    await world.pay(booking, "key-correo-caido-1");

    await world.composed.processOutbox.execute();
    await world.composed.processOutbox.execute();
    expect((await world.prisma.order.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe(
      "CONFIRMED",
    );
    expect(world.notifier.tickets.length).toBe(before);
    const pending = await world.prisma.outboxEvent.findFirst({
      where: { eventType: "TicketEmailRequested", aggregateId: booking.id },
    });
    expect(pending?.status).toBe("PENDING");

    world.notifier.failing = false;
    await world.drainOutbox(3);
    expect(world.notifier.tickets.length).toBe(before + 1);
  });

  it("una orden ya pagada no se puede modificar ni volver a pagar con otra clave", async () => {
    const { booking } = await readyBooking("01C");
    await world.pay(booking, "key-primera-vez-1");

    const second = await world.pay(booking, "key-segunda-vez-1");
    const edit = await world.setPassengers(booking, []);

    expect([second.status, second.body.code]).toEqual([409, "BOOKING_NOT_PAYABLE"]);
    expect(edit.status).toBe(400);
  });

  it("no se puede pagar si el bloqueo ya venció", async () => {
    const { booking, seat } = await readyBooking("01D");
    world.clock.advanceMinutes(16);

    const res = await world.pay(booking, "key-bloqueo-vencido");

    expect([res.status, res.body.code]).toEqual([409, "SEATS_NO_LONGER_HELD"]);
    expect(await seatStatus(seat)).toBe("BLOCKED");
  });
});
