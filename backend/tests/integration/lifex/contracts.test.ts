import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import {
  changeFlightStatusResponseSchema,
  citiesResponseSchema,
  clientMessageSchema,
  countriesResponseSchema,
  dashboardFlightsResponseSchema,
  flightDetailResponseSchema,
  flightEventSchema,
  flightMetricsResponseSchema,
  flightSearchResponseSchema,
  holdSeatResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  loginResponseSchema,
  luggageTypesResponseSchema,
  publicConfigSchema,
  meResponseSchema,
  orderTicketsSchema,
  paymentAcceptedSchema,
  problemSchema,
  requestPaymentSchema,
  seatMapSchema,
  serverMessageSchema,
  setPassengersRequestSchema,
  startBookingRequestSchema,
  startBookingResponseSchema,
  bookingResponseSchema,
  TOPIC,
  WS_PATH,
} from "../../../../shared/src/index.ts";
import { createWorld, STAFF_PASSWORD, type World } from "../../helpers/lifex-world.ts";

/**
 * Pruebas de contrato: lo que responde la API real (Postgres real) tiene que cumplir los esquemas de
 * `lifex/shared`, que es lo que consume el frontend. Si cambia una respuesta, estas pruebas fallan.
 */
describe("contratos de shared/ contra la API real", () => {
  let world: World;

  beforeAll(async () => {
    world = await createWorld({ listen: true });
  });
  afterAll(async () => {
    await world?.stop();
  });

  it("catálogo, búsqueda y detalle de vuelos", async () => {
    const countries = await request(world.app).get("/catalog/countries");
    const cities = await request(world.app).get("/catalog/cities?country=CO");
    const luggage = await request(world.app).get("/catalog/luggage-types");
    const search = await request(world.app).get(
      `/flights?from=MDE&to=BOG&date=${world.flightDate}`,
    );
    const detail = await request(world.app).get(`/flights/${world.flight.id}`);

    expect(() => countriesResponseSchema.parse(countries.body)).not.toThrow();
    expect(() => citiesResponseSchema.parse(cities.body)).not.toThrow();
    expect(() => luggageTypesResponseSchema.parse(luggage.body)).not.toThrow();
    expect(flightSearchResponseSchema.parse(search.body).flights).toHaveLength(1);
    expect(flightDetailResponseSchema.parse(detail.body).flight.id).toBe(world.flight.id);
  });

  it("las ciudades llevan imagen opcional (catálogo y vuelos)", async () => {
    const cities = await request(world.app).get("/catalog/cities?country=CO");
    const byName = new Map(
      citiesResponseSchema.parse(cities.body).cities.map((city) => [city.name, city]),
    );
    expect(byName.get("Medellín")?.imageUrl).toBe("/img/destinations/medellin.jpg");
    expect(byName.get("Bogotá")?.imageUrl).toBeNull();

    const search = await request(world.app).get(
      `/flights?from=MDE&to=BOG&date=${world.flightDate}`,
    );
    const flights = flightSearchResponseSchema.parse(search.body).flights;
    expect(flights.length).toBeGreaterThan(0);
    expect(flights[0]?.from.cityImageUrl).toBe("/img/destinations/medellin.jpg");
    expect(flights[0]?.to.cityImageUrl).toBeNull();
  });

  it("GET /config expone la tasa, los impuestos y los límites públicos", async () => {
    const response = await request(world.app).get("/config");
    expect(response.status).toBe(200);
    const config = publicConfigSchema.parse(response.body);
    expect(config.iataTrm).toBe(3300);
    expect(config.taxPercentage).toBe(19);
    expect(Object.keys(config).sort()).toEqual([
      "iataTrm",
      "maxHeldSeatsPerSession",
      "maxSeatLockMinutes",
      "taxPercentage",
    ]);
  });

  it("flujo de compra completo: reserva, asiento, pasajeros, pago y tickets", async () => {
    const startBody = startBookingRequestSchema.parse({
      flightId: world.flight.id,
      contactEmail: "cliente@example.com",
    });
    const started = await request(world.app).post("/bookings").send(startBody);
    const { booking, token } = startBookingResponseSchema.parse(started.body);
    const auth = `Bearer ${token}`;

    const map = seatMapSchema.parse(
      (await request(world.app).get(`/flights/${world.flight.id}/seats`)).body,
    );
    const seat = map.seats.find((item) => item.status === "FREE" && item.seatClass === "ECONOMY");
    expect(seat).toBeDefined();
    const held = await request(world.app)
      .post(`/flights/${world.flight.id}/seats/${seat!.id}/hold`)
      .set("Authorization", auth);
    expect(holdSeatResponseSchema.parse(held.body).seat.status).toBe("BLOCKED");

    const passengersBody = setPassengersRequestSchema.parse({
      passengers: [
        {
          fullName: "Ana",
          lastName: "Gómez",
          documentType: "CC",
          documentNumber: "1234567",
          gender: "FEMENINO",
          dateBirth: "1990-05-01",
          nationalityCountryId: world.country.id,
          seatId: seat!.id,
        },
      ],
    });
    const withPassengers = await request(world.app)
      .put(`/bookings/${booking.id}/passengers`)
      .set("Authorization", auth)
      .send(passengersBody);
    expect(bookingResponseSchema.parse(withPassengers.body).booking.totalPriceUsd).toBeGreaterThan(
      0,
    );

    const paymentBody = requestPaymentSchema.parse({
      card: {
        number: "4242 4242 4242 4242",
        holderName: "ANA GOMEZ",
        expMonth: 12,
        expYear: 2035,
        cvv: "123",
      },
    });
    const paid = await request(world.app)
      .post(`/bookings/${booking.id}/payments`)
      .set("Authorization", auth)
      .set(IDEMPOTENCY_KEY_HEADER, "contract-key-0001")
      .send(paymentBody);
    expect(paid.status).toBe(202);
    expect(paymentAcceptedSchema.parse(paid.body).booking.status).toBe("PAYMENT_PENDING");

    await world.drainOutbox(2);
    const confirmed = await request(world.app)
      .get(`/bookings/${booking.id}`)
      .set("Authorization", auth);
    const confirmedBooking = bookingResponseSchema.parse(confirmed.body).booking;
    expect(confirmedBooking.status).toBe("CONFIRMED");
    expect(confirmedBooking.passengers[0]?.ticketCode).toMatch(/^LX/);

    const tickets = await request(world.app)
      .get(`/bookings/${booking.id}/tickets`)
      .set("Authorization", auth);
    expect(orderTicketsSchema.parse(tickets.body).tickets).toHaveLength(1);
  });

  it("login, /auth/me, dashboard y cambio de estado", async () => {
    const login = await request(world.app)
      .post("/auth/login")
      .send({ email: "admin@lifex.test", password: STAFF_PASSWORD });
    expect(() => loginResponseSchema.parse(login.body)).not.toThrow();
    const admin = world.staff.admin as string;

    const me = meResponseSchema.parse(
      (await request(world.app).get("/auth/me").set("Authorization", admin)).body,
    );
    expect(me.permissions).toEqual(expect.arrayContaining(["flights:manage", "dashboard:read"]));

    const metrics = await request(world.app)
      .get(`/dashboard/flights/${world.flight.id}`)
      .set("Authorization", admin);
    const list = await request(world.app)
      .get(`/dashboard/flights?date=${world.flightDate}`)
      .set("Authorization", admin);
    expect(flightMetricsResponseSchema.parse(metrics.body).metrics.numMaxSeats).toBe(12);
    expect(dashboardFlightsResponseSchema.parse(list.body).flights.length).toBeGreaterThan(0);

    const changed = await request(world.app)
      .patch(`/flights/${world.flight.id}/status`)
      .set("Authorization", admin)
      .send({ status: "DELAYED" });
    expect(changeFlightStatusResponseSchema.parse(changed.body).flight.status).toBe("DELAYED");
  });

  it("los errores cumplen el contrato problem details", async () => {
    const responses = [
      await request(world.app).get("/flights?from=MDE"),
      await request(world.app).get("/dashboard/flights/" + world.flight.id),
      await request(world.app)
        .post("/bookings")
        .send({ flightId: world.flight.id, contactEmail: "x" }),
      await request(world.app).get("/no-existe"),
    ];

    for (const res of responses) {
      const problem = problemSchema.parse(res.body);
      expect(problem.status).toBe(res.status);
    }
  });

  it("los mensajes WebSocket del servidor cumplen el catálogo de eventos", async () => {
    const messages: unknown[] = [];
    const socket = new WebSocket(`ws://127.0.0.1:${world.port}${WS_PATH}`);
    socket.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
    await new Promise<void>((resolve) => socket.once("open", () => resolve()));
    const subscribe = clientMessageSchema.parse({
      action: "subscribe",
      topic: TOPIC.flight(world.flight.id),
    });
    socket.send(JSON.stringify(subscribe));
    socket.send(JSON.stringify({ action: "subscribe", topic: TOPIC.dashboard(world.flight.id) }));

    // Genera un evento de cada familia: bloqueo, pago aprobado (PaymentPending, Sold, Confirmed) y rechazo.
    const first = await world.startBooking();
    const seatA = await world.seatId("03A");
    await world.hold(first, seatA);
    await world.setPassengers(first, [world.passenger(seatA)]);
    await world.pay(first, "ws-contract-ok-01");
    const second = await world.startBooking();
    const seatB = await world.seatId("03B");
    await world.hold(second, seatB);
    await world.setPassengers(second, [world.passenger(seatB, { documentNumber: "7654321" })]);
    await world.pay(second, "ws-contract-no-01", "4000 0000 0000 0002");
    await world.drainOutbox(3);
    await new Promise((resolve) => setTimeout(resolve, 300));
    socket.close();

    const types = new Set<string>();
    for (const message of messages) {
      expect(() => serverMessageSchema.parse(message)).not.toThrow();
      const event = flightEventSchema.safeParse(message);
      if (event.success) types.add(event.data.type);
    }
    expect([...types]).toEqual(
      expect.arrayContaining([
        "BookingConfirmed",
        "SeatHeld",
        "SeatPaymentPending",
        "SeatReleased",
        "SeatSold",
      ]),
    );
    // dashboard:* sin token: el servidor responde con un error FORBIDDEN válido
    expect(messages).toContainEqual(expect.objectContaining({ type: "error", code: "FORBIDDEN" }));
  });
});
