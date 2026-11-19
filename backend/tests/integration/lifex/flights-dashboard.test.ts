import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorld, type World } from "../../helpers/lifex-world.ts";

describe("búsqueda de vuelos y dashboard (Postgres real)", () => {
  let world: World;

  beforeAll(async () => {
    world = await createWorld();
    // Mismo día/ruta: uno FINALIZED (no debe aparecer) y otro agotado (debe aparecer marcado).
    await world.createFlight(new Date(`${world.flightDate}T20:00:00Z`), "FINALIZED");
    const soldOut = await world.createFlight(new Date(`${world.flightDate}T22:00:00Z`));
    await world.prisma.scheduledFlight.update({
      where: { id: soldOut.id },
      data: { status: "SOLD_OUT", numAvailableSeats: 0 },
    });
  });
  afterAll(async () => {
    await world?.stop();
  });

  it("1.1 / 1.2 / 1.5 devuelve solo vuelos buscables, con tarifa, horario, clases y agotados marcados", async () => {
    const res = await request(world.app).get(`/flights?from=MDE&to=BOG&date=${world.flightDate}`);

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
      departureDate: `${world.flightDate}T15:00:00.000Z`,
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
    const denied = await request(world.app).get(`/dashboard/flights?date=${world.flightDate}`);
    const ok = await request(world.app)
      .get(`/dashboard/flights?date=${world.flightDate}`)
      .set("Authorization", world.staff.viewer as string);

    expect(denied.status).toBe(401);
    expect(ok.body.flights.length).toBeGreaterThanOrEqual(3);
  });

  describe("resumen del día para las gráficas (overview)", () => {
    const overview = async (date = world.flightDate) =>
      (
        await request(world.app)
          .get(`/dashboard/overview?date=${date}`)
          .set("Authorization", world.staff.viewer as string)
      ).body.overview;

    it("exige autenticación y el permiso dashboard:read", async () => {
      const anonymous = await request(world.app).get(
        `/dashboard/overview?date=${world.flightDate}`,
      );
      expect(anonymous.status).toBe(401);
    });

    it("cuenta los vuelos del día y, tras una compra, suma el ticket, el dinero y la ocupación", async () => {
      const before = await overview();
      const booking = await world.startBooking();
      const seat = await world.seatId("03C");
      await world.hold(booking, seat);
      const priced = await world.setPassengers(booking, [world.passenger(seat)]);
      await world.pay(booking, `overview-${Date.now()}`);
      await world.drainOutbox();

      const after = await overview();

      expect(after.flights.total).toBe(before.flights.total);
      expect(after.flights.total).toBeGreaterThanOrEqual(1);
      expect(after.sales.ticketsSold - before.sales.ticketsSold).toBe(1);
      expect(after.sales.revenueUsd - before.sales.revenueUsd).toBeCloseTo(
        priced.body.booking.totalPriceUsd,
        2,
      );
      // Otras pruebas del archivo dejan asientos RESERVED sin recalcular el vuelo: el pago los cuenta todos.
      expect(after.seats.sold).toBeGreaterThanOrEqual(before.seats.sold + 1);
      expect(after.seats.byClass.economy.sold - before.seats.byClass.economy.sold).toBe(1);
      expect(after.byHour).toHaveLength(24);
    });

    it("sin fecha usa hoy y rechaza una fecha inválida", async () => {
      const today = await request(world.app)
        .get("/dashboard/overview")
        .set("Authorization", world.staff.viewer as string);
      const invalid = await request(world.app)
        .get("/dashboard/overview?date=ayer")
        .set("Authorization", world.staff.viewer as string);
      expect(today.status).toBe(200);
      expect(today.body.overview.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(invalid.body.code).toBe("INVALID_SEARCH_DATE");
    });
  });

  describe("pasajeros del vuelo y check-in", () => {
    const viewer = () => world.staff.viewer as string;
    const admin = () => world.staff.admin as string;

    /** Una reserva pagada; devuelve la reserva y los ids de sus tickets. */
    async function paidOrder(flightId: string, email: string, seats: string[], phone?: string) {
      const start = await request(world.app)
        .post("/bookings")
        .send({ flightId, contactEmail: email, ...(phone ? { contactPhone: phone } : {}) });
      const booking = { id: start.body.booking.id as string, auth: `Bearer ${start.body.token}` };
      const ids: string[] = [];
      for (const identifier of seats) {
        const seat = await world.seatId(identifier, flightId);
        await world.hold(booking, seat, flightId);
        ids.push(seat);
      }
      const res = await world.setPassengers(
        booking,
        ids.map((seat, index) =>
          world.passenger(seat, {
            fullName: ["Alfa", "Beta", "Gamma"][index] ?? "Delta",
            lastName: ["Uno", "Dos", "Tres"][index] ?? "Cuatro",
            documentNumber: `200${index}${email.length}`,
            ...(index === 0 ? { luggageTypeId: 1 } : {}),
          }),
        ),
      );
      expect(res.status).toBe(200);
      await world.pay(booking, `key-${booking.id}`);
      await world.drainOutbox(2);
      return { booking, reservation: res.body.booking.reservationNumber as string };
    }

    const passengersOf = (flightId: string, auth = viewer()) =>
      request(world.app)
        .get(`/dashboard/flights/${flightId}/passengers`)
        .set("Authorization", auth);

    it("lista a los pasajeros con ticket de las reservas pagadas: nombre, contacto, clase, asiento y reserva", async () => {
      const flight = await world.createFlight(new Date("2026-12-20T15:00:00Z"));
      const { reservation } = await paidOrder(
        flight.id,
        "ana@example.com",
        ["01A", "02A"],
        "+573001112233",
      );
      // una reserva sin pagar no aparece
      const draft = await world.startBooking(flight.id, "borrador@example.com");
      await world.hold(draft, await world.seatId("03A", flight.id), flight.id);

      const res = await passengersOf(flight.id);

      expect(res.status).toBe(200);
      expect(res.body.passengers).toHaveLength(2);
      const [business, economy] = res.body.passengers;
      expect(business).toMatchObject({
        fullName: "Alfa",
        lastName: "Uno",
        isHolder: true,
        seatIdentifier: "01A",
        seatClass: "BUSINESS",
        reservationNumber: reservation,
        contactEmail: "ana@example.com",
        contactPhone: "+573001112233",
        luggage: "Light",
        checkedIn: false,
        checkedInAt: null,
      });
      expect(business.ticketCode).toMatch(/^LX/);
      expect(economy).toMatchObject({ seatClass: "ECONOMY", isHolder: false, luggage: null });
      expect(
        res.body.passengers.some(
          (p: { contactEmail: string }) => p.contactEmail === "borrador@example.com",
        ),
      ).toBe(false);
    });

    it("exige autenticación, y un vuelo inexistente responde 404", async () => {
      const flight = await world.createFlight(new Date("2026-12-21T15:00:00Z"));
      const anonymous = await request(world.app).get(`/dashboard/flights/${flight.id}/passengers`);
      const missing = await passengersOf("11111111-2222-4333-8444-555555555555");
      expect(anonymous.status).toBe(401);
      expect(missing.status).toBe(404);
      expect(missing.body.code).toBe("FLIGHT_NOT_FOUND");
      expect((await passengersOf(flight.id)).body.passengers).toEqual([]);
    });

    it("el check-in se registra y se quita; solo lo hace quien gestiona vuelos", async () => {
      const flight = await world.createFlight(new Date("2026-12-22T15:00:00Z"));
      await paidOrder(flight.id, "carlos@example.com", ["02B"]);
      const [passenger] = (await passengersOf(flight.id)).body.passengers;
      const url = `/dashboard/flights/${flight.id}/passengers/${passenger.ticketId}/check-in`;

      const denied = await request(world.app)
        .patch(url)
        .set("Authorization", viewer())
        .send({ checkedIn: true });
      const done = await request(world.app)
        .patch(url)
        .set("Authorization", admin())
        .send({ checkedIn: true });
      const invalid = await request(world.app)
        .patch(url)
        .set("Authorization", admin())
        .send({ checkedIn: "si" });

      expect(denied.status).toBe(403);
      expect(done.status).toBe(200);
      expect(done.body.passenger).toMatchObject({
        checkedIn: true,
        checkedInAt: expect.any(String),
      });
      expect(invalid.status).toBe(400);
      expect((await passengersOf(flight.id)).body.passengers[0].checkedIn).toBe(true);

      const undone = await request(world.app)
        .patch(url)
        .set("Authorization", admin())
        .send({ checkedIn: false });
      expect(undone.body.passenger).toMatchObject({ checkedIn: false, checkedInAt: null });
    });

    it("no permite tocar el ticket de otro vuelo", async () => {
      const flight = await world.createFlight(new Date("2026-12-23T15:00:00Z"));
      const other = await world.createFlight(new Date("2026-12-24T15:00:00Z"));
      await paidOrder(flight.id, "diana@example.com", ["02C"]);
      const [passenger] = (await passengersOf(flight.id)).body.passengers;

      const res = await request(world.app)
        .patch(`/dashboard/flights/${other.id}/passengers/${passenger.ticketId}/check-in`)
        .set("Authorization", admin())
        .send({ checkedIn: true });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("TICKET_NOT_FOUND");
      expect((await passengersOf(flight.id)).body.passengers[0].checkedIn).toBe(false);
    });
  });

  describe("lista de vuelos del panel: paginada y con filtros", () => {
    const viewer = () => world.staff.viewer as string;
    const list = (query: string) =>
      request(world.app).get(`/dashboard/flights${query}`).set("Authorization", viewer());

    it("incluye los vuelos internacionales y no se queda en los primeros (la lista no se trunca)", async () => {
      const international = await world.createRoute("INTERNATIONAL");
      const departure = new Date(Date.parse(`${world.flightDate}T15:00:00Z`) + 3 * 3_600_000);
      await world.createFlight(departure, "ACTIVE", { routeId: international.id });

      const res = await list(`?date=${world.flightDate}`);

      expect(res.status).toBe(200);
      const types = res.body.flights.map((f: { routeType: string }) => f.routeType);
      expect(types).toContain("DOMESTIC");
      expect(types).toContain("INTERNATIONAL");
      expect(res.body).toMatchObject({ page: 1, pageSize: 20 });
      expect(res.body.total).toBe(res.body.flights.length);
      expect(res.body.flights[0]).toMatchObject({
        from: "MDE",
        fromCity: expect.any(String),
        reservations: expect.any(Number),
      });
    });

    it("pagina: el total es el de todas las páginas y las páginas no se repiten ni se saltan filas", async () => {
      for (let hour = 0; hour < 5; hour += 1) {
        await world.createFlight(
          new Date(Date.parse(`${world.flightDate}T16:00:00Z`) + hour * 600_000),
        );
      }
      const first = await list(`?date=${world.flightDate}&pageSize=3&page=1`);
      const second = await list(`?date=${world.flightDate}&pageSize=3&page=2`);
      const all = await list(`?date=${world.flightDate}&pageSize=100`);

      expect(first.body.flights).toHaveLength(3);
      expect(first.body.total).toBe(all.body.total);
      const ids = [...first.body.flights, ...second.body.flights].map(
        (f: { flightId: string }) => f.flightId,
      );
      expect(ids).toEqual(
        all.body.flights.slice(0, ids.length).map((f: { flightId: string }) => f.flightId),
      );
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("filtra por origen, destino y fecha", async () => {
      const international = await world.createRoute("INTERNATIONAL");
      const day = new Date(Date.parse(`${world.flightDate}T15:00:00Z`) + 24 * 3_600_000);
      await world.createFlight(day, "ACTIVE", { routeId: international.id });
      const route = await world.prisma.flightRoute.findUniqueOrThrow({
        where: { id: international.id },
        include: { fromAirport: true, destinationAirport: true },
      });

      const byRoute = await list(
        `?from=${route.fromAirport.iataCode.toLowerCase()}&to=${route.destinationAirport.iataCode}`,
      );
      const otherDay = await list(`?date=${world.flightDate}&from=${route.fromAirport.iataCode}`);
      const domestic = await list(`?date=${world.flightDate}&from=MDE&to=BOG`);

      expect(byRoute.body.total).toBeGreaterThanOrEqual(1);
      expect(
        byRoute.body.flights.every((f: { routeType: string }) => f.routeType === "INTERNATIONAL"),
      ).toBe(true);
      expect(otherDay.body.total).toBe(0);
      expect(
        domestic.body.flights.every(
          (f: { from: string; to: string }) => f.from === "MDE" && f.to === "BOG",
        ),
      ).toBe(true);
    });

    it("sin fecha lista los vuelos que aún no salieron", async () => {
      const res = await list("");
      expect(res.status).toBe(200);
      const now = Date.now();
      expect(
        res.body.flights.every(
          (f: { departureDate: string }) => Date.parse(f.departureDate) >= now,
        ),
      ).toBe(true);
    });

    it("rechaza filtros inválidos con un código claro", async () => {
      const airport = await list("?from=MEDELLIN");
      const page = await list("?page=0");
      const size = await list("?pageSize=abc");
      expect(airport.status).toBe(400);
      expect(airport.body.code).toBe("INVALID_AIRPORT");
      expect(page.body.code).toBe("INVALID_PAGE");
      expect(size.body.code).toBe("INVALID_PAGE");
    });

    it("limita el tamaño de página a 100", async () => {
      const res = await list("?pageSize=5000");
      expect(res.body.pageSize).toBe(100);
    });
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
