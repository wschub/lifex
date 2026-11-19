import { describe, expect, it } from "vitest";
import { Order } from "../../../../src/modules/bookings/domain/entities/order.entity.ts";
import { Passenger } from "../../../../src/modules/bookings/domain/entities/passenger.entity.ts";
import { computePricing } from "../../../../src/modules/bookings/domain/services/pricing.ts";
import { ScheduledFlight } from "../../../../src/modules/flights/domain/entities/scheduled-flight.entity.ts";
import { Seat } from "../../../../src/modules/inventory/domain/entities/seat.entity.ts";
import {
  passesLuhn,
  summarizeCard,
} from "../../../../src/modules/payments/domain/entities/payment.entity.ts";
import { Ticket } from "../../../../src/modules/tickets/domain/entities/ticket.entity.ts";
import { FakePaymentGateway } from "../../../../src/modules/payments/infrastructure/gateway/fake-payment-gateway.ts";

const NOW = new Date("2026-11-20T10:00:00Z");

const seat = (status: Seat["status"] = "FREE") =>
  Seat.restore({
    id: "s1",
    flightId: "f1",
    identifier: "02A",
    row: 2,
    column: "A",
    seatClass: "ECONOMY",
    price: 100,
    status,
    heldBySession: null,
    holdExpiresAt: null,
  });

describe("Seat: máquina de estados FREE → BLOCKED → PAYMENT_PENDING → RESERVED", () => {
  it("recorre el camino feliz", () => {
    const expires = new Date(NOW.getTime() + 900_000);
    const blocked = seat().transitionTo("BLOCKED", { sessionId: "order-1", expiresAt: expires });
    expect([blocked.status, blocked.heldBySession, blocked.holdExpiresAt]).toEqual([
      "BLOCKED",
      "order-1",
      expires,
    ]);
    expect(blocked.transitionTo("PAYMENT_PENDING").transitionTo("RESERVED").status).toBe(
      "RESERVED",
    );
  });

  it.each([
    ["FREE", "PAYMENT_PENDING"],
    ["FREE", "RESERVED"],
    ["BLOCKED", "RESERVED"],
    ["PAYMENT_PENDING", "BLOCKED"],
    ["RESERVED", "FREE"],
    ["RESERVED", "BLOCKED"],
  ] as const)("rechaza %s → %s", (from, to) => {
    expect(() => seat(from).transitionTo(to)).toThrow(
      expect.objectContaining({ code: "INVALID_SEAT_TRANSITION" }),
    );
  });

  it("devolver un asiento a FREE borra el bloqueo; PAYMENT_PENDING puede volver a FREE si el pago falla", () => {
    const freed = seat("PAYMENT_PENDING").transitionTo("FREE");
    expect([freed.status, freed.heldBySession, freed.holdExpiresAt]).toEqual(["FREE", null, null]);
  });

  it("un BLOCKED vencido cuenta como disponible; uno vigente o en pago, no", () => {
    const blocked = (expires: Date, status: Seat["status"] = "BLOCKED") =>
      Seat.restore({ ...seat(status), heldBySession: "x", holdExpiresAt: expires });
    expect(blocked(new Date(NOW.getTime() - 1)).isAvailable(NOW)).toBe(true);
    expect(blocked(new Date(NOW.getTime() + 1)).isAvailable(NOW)).toBe(false);
    expect(blocked(new Date(NOW.getTime() - 1), "PAYMENT_PENDING").isAvailable(NOW)).toBe(false);
    expect(blocked(new Date(NOW.getTime() + 1)).isHeldBy("x", NOW)).toBe(true);
    expect(blocked(new Date(NOW.getTime() + 1)).isHeldBy("y", NOW)).toBe(false);
  });
});

describe("ScheduledFlight", () => {
  const flight = (status: "ACTIVE" | "CANCELLED" | "SOLD_OUT" = "ACTIVE") =>
    ScheduledFlight.create({
      id: "f",
      departureDate: NOW,
      arrivalDate: new Date(NOW.getTime() + 3600_000),
      status,
    });

  it("valida departure_date < arrival_date", () => {
    expect(() =>
      ScheduledFlight.create({ id: "f", departureDate: NOW, arrivalDate: NOW, status: "ACTIVE" }),
    ).toThrow(expect.objectContaining({ code: "INVALID_FLIGHT_DATES" }));
  });

  it("solo permite los cambios manuales válidos", () => {
    expect(() => flight().assertCanChangeStatusTo("DELAYED")).not.toThrow();
    expect(() => flight().assertCanChangeStatusTo("SOLD_OUT")).toThrow();
    expect(() => flight().assertCanChangeStatusTo("ACTIVE")).toThrow();
    expect(() => flight("CANCELLED").assertCanChangeStatusTo("ACTIVE")).toThrow();
    expect(flight("SOLD_OUT").isBookable()).toBe(false);
  });
});

describe("Ticket: equipaje Business solo con asiento BUSINESS", () => {
  const businessFlex = { id: 5, feePercentage: 25, businessOnly: true };
  const light = { id: 1, feePercentage: 10, businessOnly: false };

  it("rechaza Business Flex en economy y lo acepta en business", () => {
    expect(() =>
      Ticket.issue({ passengerId: "p", seatId: "s", seatClass: "ECONOMY", luggage: businessFlex }),
    ).toThrow(expect.objectContaining({ code: "LUGGAGE_NOT_ALLOWED" }));
    const ticket = Ticket.issue({
      passengerId: "p",
      seatId: "s",
      seatClass: "BUSINESS",
      luggage: businessFlex,
    });
    expect(ticket.luggage).toEqual([{ luggageTypeId: 5, feeAppliedPercentage: 25 }]);
    expect(
      Ticket.issue({ passengerId: "p", seatId: "s", seatClass: "ECONOMY", luggage: light }).luggage,
    ).toHaveLength(1);
  });

  it("genera códigos únicos y legibles", () => {
    const codes = new Set(
      Array.from(
        { length: 500 },
        () => Ticket.issue({ passengerId: "p", seatId: "s", seatClass: "ECONOMY" }).ticketCode,
      ),
    );
    expect(codes.size).toBe(500);
    for (const code of codes) expect(code).toMatch(/^LX[A-HJ-NP-Z2-9]{10}$/);
  });
});

describe("computePricing", () => {
  it("suma en centavos: asientos + equipaje + impuestos", () => {
    expect(computePricing([{ seatPriceUsd: 80, luggageFeePercentage: 15 }], 19)).toEqual({
      seatsPrice: 80,
      luggagePrice: 12,
      flightPrice: 92,
      taxes: 17.48,
      totalPrice: 109.48,
    });
    expect(
      computePricing(
        [
          { seatPriceUsd: 0.1, luggageFeePercentage: null },
          { seatPriceUsd: 0.2, luggageFeePercentage: null },
        ],
        0,
      ).flightPrice,
    ).toBe(0.3);
  });

  it("separa asientos y equipaje y siempre cumple flightPrice = asientos + equipaje", () => {
    const pricing = computePricing(
      [
        { seatPriceUsd: 105, luggageFeePercentage: 10 },
        { seatPriceUsd: 99.99, luggageFeePercentage: null },
        { seatPriceUsd: 33.33, luggageFeePercentage: 15 },
      ],
      19,
    );
    expect(pricing.seatsPrice).toBe(238.32);
    expect(pricing.luggagePrice).toBe(15.5);
    expect(pricing.flightPrice).toBe(253.82);
    expect(Math.round((pricing.seatsPrice + pricing.luggagePrice) * 100)).toBe(
      Math.round(pricing.flightPrice * 100),
    );
    expect(computePricing([], 19).luggagePrice).toBe(0);
  });
});

describe("Order y Passenger", () => {
  it("la orden nace en DRAFT con números de orden y reserva, y caduca", () => {
    const order = Order.start({ flightId: "f", contactEmail: " Ana@Example.com " }, 2700, NOW);
    expect([order.status, order.contactEmail]).toEqual(["DRAFT", "ana@example.com"]);
    expect(order.orderNumber).toMatch(/^ORD-20261120-\d{6}$/);
    expect(order.reservationNumber).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    expect(() => order.assertEditable(new Date(NOW.getTime() + 2701_000))).toThrow(
      expect.objectContaining({ code: "BOOKING_EXPIRED" }),
    );
    expect(() => Order.start({ flightId: "f", contactEmail: "no-es-correo" }, 60, NOW)).toThrow(
      expect.objectContaining({ code: "INVALID_BOOKING_CONTACT" }),
    );
  });

  const input = {
    fullName: "Ana",
    lastName: "Gómez",
    documentType: "CC",
    documentNumber: "1234567",
    gender: "FEMENINO",
    dateBirth: "1990-05-01",
    nationalityCountryId: 1,
    seatId: "s",
  };

  it("deriva ADULT/CHILD por la edad y valida los datos", () => {
    expect(Passenger.create(input, NOW).passengerType).toBe("ADULT");
    expect(Passenger.create({ ...input, dateBirth: "2020-01-01" }, NOW).passengerType).toBe(
      "CHILD",
    );
    for (const bad of [
      { fullName: "" },
      { documentType: "XX" },
      { documentNumber: "1" },
      { gender: "otro" },
      { dateBirth: "2999-01-01" },
      { dateBirth: "ayer" },
    ]) {
      expect(() => Passenger.create({ ...input, ...bad }, NOW)).toThrow(
        expect.objectContaining({ code: "INVALID_PASSENGER" }),
      );
    }
  });
});

describe("tarjetas y pasarela simulada", () => {
  it("Luhn y resumen: solo marca y últimos 4", () => {
    expect(passesLuhn("4242424242424242")).toBe(true);
    expect(passesLuhn("4242424242424241")).toBe(false);
    expect(summarizeCard("4242 4242 4242 4242")).toEqual({ brand: "VISA", last4: "4242" });
    expect(summarizeCard("5555555555554444").brand).toBe("MASTERCARD");
  });

  const gateway = new FakePaymentGateway();
  const card = {
    number: "4242 4242 4242 4242",
    holderName: "ANA GOMEZ",
    expMonth: 12,
    expYear: 2030,
    cvv: "123",
  };

  it("rechaza tarjetas inválidas o vencidas", async () => {
    await expect(
      gateway.tokenize({ ...card, number: "4242 4242 4242 4241" }, NOW),
    ).rejects.toMatchObject({ code: "INVALID_CARD" });
    await expect(gateway.tokenize({ ...card, expYear: 2025 }, NOW)).rejects.toMatchObject({
      code: "INVALID_CARD",
    });
    await expect(gateway.tokenize({ ...card, cvv: "1" }, NOW)).rejects.toMatchObject({
      code: "INVALID_CARD",
    });
  });

  it("el token no contiene el número y el cobro es idempotente por clave", async () => {
    const tokenized = await gateway.tokenize(card, NOW);
    expect(tokenized.token).not.toContain("4242");
    const first = await gateway.charge({
      token: tokenized.token,
      amountUsd: 10,
      idempotencyKey: "k",
    });
    const second = await gateway.charge({
      token: tokenized.token,
      amountUsd: 10,
      idempotencyKey: "k",
    });
    expect(second).toBe(first);
    const declined = await gateway.tokenize({ ...card, number: "4000 0000 0000 0002" }, NOW);
    expect(
      (await gateway.charge({ token: declined.token, amountUsd: 1, idempotencyKey: "d" })).status,
    ).toBe("REJECTED");
  });
});
