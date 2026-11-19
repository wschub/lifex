import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createWorld, type World } from "../../helpers/lifex-world.ts";

describe("administración: flota, clientes y compras (Postgres real)", () => {
  let world: World;
  const admin = () => world.staff.admin as string;
  const viewer = () => world.staff.viewer as string;
  const get = (path: string, auth = admin()) =>
    request(world.app).get(path).set("Authorization", auth);

  /** Una reserva pagada con un pasajero por asiento; devuelve su código de reserva. */
  async function paidOrder(email: string, seats: string[], holder: string, phone?: string) {
    const start = await request(world.app)
      .post("/bookings")
      .send({
        flightId: world.flight.id,
        contactEmail: email,
        ...(phone ? { contactPhone: phone } : {}),
      });
    const booking = { id: start.body.booking.id as string, auth: `Bearer ${start.body.token}` };
    const ids: string[] = [];
    for (const identifier of seats) {
      const seat = await world.seatId(identifier);
      await world.hold(booking, seat);
      ids.push(seat);
    }
    const res = await world.setPassengers(
      booking,
      ids.map((seat, index) =>
        world.passenger(seat, {
          fullName: index === 0 ? holder : "Acompañante",
          lastName: "Prueba",
          documentNumber: `300${index}${email.length}${seats[0]}`,
        }),
      ),
    );
    expect(res.status).toBe(200);
    await world.pay(booking, `key-${booking.id}`);
    await world.drainOutbox(2);
    return res.body.booking as { reservationNumber: string; totalPriceUsd: number };
  }

  let anaFirst: { reservationNumber: string; totalPriceUsd: number };
  let anaSecond: { reservationNumber: string; totalPriceUsd: number };
  let bruno: { reservationNumber: string; totalPriceUsd: number };

  beforeAll(async () => {
    world = await createWorld();
    anaFirst = await paidOrder("ana@example.com", ["02A"], "Ana", "+573001112233");
    anaSecond = await paidOrder("ana@example.com", ["02B"], "Ana", "+573009998877");
    bruno = await paidOrder("bruno@example.com", ["02C", "02D"], "Bruno");
    // una reserva sin pagar: no es una compra ni un cliente
    const draft = await world.startBooking(world.flight.id, "carla@example.com");
    await world.hold(draft, await world.seatId("03A"));
  });
  afterAll(async () => {
    await world?.stop();
  });

  describe("flota", () => {
    it("solo la ve el administrador: sin sesión 401 y el encargado (solo lectura) 403", async () => {
      expect((await request(world.app).get("/dashboard/aircraft")).status).toBe(401);
      expect((await get("/dashboard/aircraft", viewer())).status).toBe(403);
      expect((await get("/dashboard/aircraft")).status).toBe(200);
    });

    it("lista cada avión con su modelo, descripción, capacidad por clase, alcance y vuelos programados", async () => {
      const res = await get("/dashboard/aircraft");
      const plane = res.body.aircraft.find(
        (item: { internalIdentifier: string }) => item.internalIdentifier === "TST-001",
      );
      expect(plane).toMatchObject({
        reference: "Test jet",
        typeRange: "DOMESTIC",
        totalSeats: 12,
        businessSeats: 4,
        economySeats: 8,
        rangeNauticalMiles: 1000,
        rangeKm: 1852,
        seatColumns: "ABCD",
        status: "AVAILABLE",
      });
      expect(plane.upcomingFlights).toBeGreaterThanOrEqual(1);
      expect(plane).toHaveProperty("descriptionEs");
    });
  });

  describe("clientes", () => {
    it("solo los ve el administrador", async () => {
      expect((await request(world.app).get("/dashboard/customers")).status).toBe(401);
      expect((await get("/dashboard/customers", viewer())).status).toBe(403);
    });

    it("agrupa por correo a quienes compraron: nº de compras, total gastado, teléfono y nombre de la última compra", async () => {
      const res = await get("/dashboard/customers");
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ page: 1, pageSize: 20, total: 2 });
      const emails = res.body.customers.map((c: { email: string }) => c.email);
      expect(emails).toEqual(["bruno@example.com", "ana@example.com"]); // la última compra primero
      const ana = res.body.customers.find((c: { email: string }) => c.email === "ana@example.com");
      expect(ana).toMatchObject({ name: "Ana Prueba", purchases: 2, phone: "+573009998877" });
      expect(ana.totalUsd).toBeCloseTo(anaFirst.totalPriceUsd + anaSecond.totalPriceUsd, 2);
      expect(emails).not.toContain("carla@example.com"); // sin pagar: no es cliente
      const brunoRow = res.body.customers[0];
      expect(brunoRow.purchases).toBe(1);
      expect(brunoRow.totalUsd).toBeCloseTo(bruno.totalPriceUsd, 2);
    });

    it("busca por nombre, correo o teléfono, y los símbolos del texto no se interpretan como comodines", async () => {
      expect((await get("/dashboard/customers?search=bruno")).body.total).toBe(1);
      expect((await get("/dashboard/customers?search=ANA%20PRUEBA")).body.customers[0].email).toBe(
        "ana@example.com",
      );
      expect((await get("/dashboard/customers?search=9998877")).body.total).toBe(1);
      expect((await get("/dashboard/customers?search=%25")).body.total).toBe(0);
      expect((await get("/dashboard/customers?search=nadie")).body.customers).toEqual([]);
    });

    it("pagina con el total de todas las páginas", async () => {
      const first = await get("/dashboard/customers?pageSize=1&page=1");
      const second = await get("/dashboard/customers?pageSize=1&page=2");
      expect(first.body).toMatchObject({ total: 2, pageSize: 1 });
      expect(first.body.customers).toHaveLength(1);
      expect(second.body.customers).toHaveLength(1);
      expect(second.body.customers[0].email).not.toBe(first.body.customers[0].email);
    });
  });

  describe("compras", () => {
    it("solo las ve el administrador", async () => {
      expect((await request(world.app).get("/dashboard/purchases")).status).toBe(401);
      expect((await get("/dashboard/purchases", viewer())).status).toBe(403);
    });

    it("por defecto lista las compras confirmadas, con cliente, vuelo, pasajeros, total y pago", async () => {
      const res = await get("/dashboard/purchases");
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      const purchase = res.body.purchases.find(
        (item: { reservationNumber: string }) => item.reservationNumber === bruno.reservationNumber,
      );
      expect(purchase).toMatchObject({
        status: "CONFIRMED",
        customerName: "Bruno Prueba",
        customerEmail: "bruno@example.com",
        passengers: 2,
        flight: { from: "MDE", to: "BOG", fromCity: "Medellín", routeType: "DOMESTIC" },
        payment: { status: "APPROVED", cardLast4: "4242" },
      });
      expect(purchase.totalUsd).toBeCloseTo(bruno.totalPriceUsd, 2);
      // la última compra primero
      expect(res.body.purchases[0].reservationNumber).toBe(bruno.reservationNumber);
    });

    it("filtra por cliente (sus compras), por texto, por estado, por ruta y por fecha de compra", async () => {
      const ana = await get("/dashboard/purchases?email=ANA@example.com");
      expect(ana.body.total).toBe(2);
      expect(
        ana.body.purchases.every(
          (p: { customerEmail: string }) => p.customerEmail === "ana@example.com",
        ),
      ).toBe(true);

      const byCode = await get(
        `/dashboard/purchases?search=${anaFirst.reservationNumber.toLowerCase()}`,
      );
      expect(byCode.body.total).toBe(1);
      expect((await get("/dashboard/purchases?search=Acompa%C3%B1ante")).body.total).toBe(1);

      const all = await get("/dashboard/purchases?status=ALL");
      const draft = await get("/dashboard/purchases?status=PAYMENT_PENDING");
      expect(all.body.total).toBeGreaterThanOrEqual(3);
      expect(
        draft.body.purchases.every((p: { status: string }) => p.status === "PAYMENT_PENDING"),
      ).toBe(true);

      expect((await get("/dashboard/purchases?origin=mde&destination=BOG")).body.total).toBe(3);
      expect((await get("/dashboard/purchases?origin=BOG")).body.total).toBe(0);

      const today = new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
      expect((await get(`/dashboard/purchases?dateFrom=${today}&dateTo=${today}`)).body.total).toBe(
        3,
      );
      expect((await get("/dashboard/purchases?dateTo=2020-01-01")).body.total).toBe(0);
    });

    it("pagina y valida los filtros", async () => {
      const first = await get("/dashboard/purchases?pageSize=2&page=1");
      const second = await get("/dashboard/purchases?pageSize=2&page=2");
      expect(first.body.purchases).toHaveLength(2);
      expect(second.body.purchases).toHaveLength(1);
      expect(first.body.total).toBe(3);

      const status = await get("/dashboard/purchases?status=PAGADA");
      const date = await get("/dashboard/purchases?dateFrom=ayer");
      const size = await get("/dashboard/purchases?pageSize=0");
      expect(status.body.code).toBe("INVALID_PURCHASE_STATUS");
      expect(date.body.code).toBe("INVALID_SEARCH_DATE");
      expect(size.body.code).toBe("INVALID_PAGE");
      expect((await get("/dashboard/purchases?pageSize=5000")).body.pageSize).toBe(100);
    });
  });
});
