import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { createWorld, GOOD_CARD, type World } from "../../helpers/lifex-world.ts";

interface Message {
  type: string;
  topic?: string;
  version?: number;
  data?: Record<string, unknown>;
  code?: string;
}

/** Cliente de pruebas: guarda todo lo recibido y permite esperar un mensaje concreto. */
class TestClient {
  readonly messages: Message[] = [];
  private constructor(private readonly socket: WebSocket) {
    socket.on("message", (raw) => this.messages.push(JSON.parse(raw.toString()) as Message));
  }

  static async connect(port: number, token?: string): Promise<TestClient> {
    const query = token ? `?token=${encodeURIComponent(token)}` : "";
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws${query}`);
    const client = new TestClient(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once("open", () => resolve());
      socket.once("error", reject);
    });
    return client;
  }

  async subscribe(topic: string): Promise<Message> {
    this.socket.send(JSON.stringify({ action: "subscribe", topic }));
    return this.waitFor(
      (m) => (m.type === "subscribed" || m.type === "error") && m.topic === topic,
    );
  }

  async waitFor(predicate: (message: Message) => boolean, timeoutMs = 3000): Promise<Message> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = this.messages.find(predicate);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`timeout esperando un mensaje; recibidos: ${JSON.stringify(this.messages)}`);
  }

  close(): void {
    this.socket.close();
  }
}

describe("tiempo real por WebSocket (servidor y Postgres reales)", () => {
  let world: World;

  beforeAll(async () => {
    world = await createWorld({ listen: true });
  });
  afterAll(async () => {
    await world?.stop();
  });

  /** Procesa el outbox como lo haría el worker del scheduler. */
  const pump = () => world.composed.processOutbox.execute();

  it("2.3 al bloquear un asiento, los demás clientes del vuelo reciben SeatHeld en menos de 1 segundo", async () => {
    const watcher = await TestClient.connect(world.port);
    const other = await TestClient.connect(world.port);
    const topic = `flight:${world.flight.id}`;
    expect((await watcher.subscribe(topic)).type).toBe("subscribed");
    expect((await other.subscribe(topic)).type).toBe("subscribed");
    const booking = await world.startBooking();
    const seat = await world.seatId("02A");

    const startedAt = Date.now();
    await world.hold(booking, seat);
    await pump();
    const event = await watcher.waitFor((m) => m.type === "SeatHeld", 1000);
    await other.waitFor((m) => m.type === "SeatHeld", 1000);

    expect(Date.now() - startedAt).toBeLessThan(1000);
    expect(event.data).toMatchObject({ seatId: seat, status: "BLOCKED" });
    expect(typeof event.version).toBe("number");
    watcher.close();
    other.close();
  });

  it("los eventos de un vuelo llevan versión secuencial y el snapshot REST permite resincronizar", async () => {
    const client = await TestClient.connect(world.port);
    await client.subscribe(`flight:${world.flight.id}`);
    const booking = await world.startBooking();
    const before = (
      await world.prisma.scheduledFlight.findUniqueOrThrow({ where: { id: world.flight.id } })
    ).eventVersion;
    await world.hold(booking, await world.seatId("02B"));
    await world.hold(booking, await world.seatId("02C"));
    await pump();

    await client.waitFor((m) => m.type === "SeatHeld" && m.version === before + 2);
    const versions = client.messages.filter((m) => m.type === "SeatHeld").map((m) => m.version);
    expect(versions.slice(-2)).toEqual([before + 1, before + 2]);

    const { default: request } = await import("supertest");
    const snapshot = await request(world.app).get(`/flights/${world.flight.id}/seats`);
    expect(snapshot.body.version).toBe(before + 2);
    client.close();
  });

  it("3.5 al confirmarse una compra, los clientes del vuelo reciben BookingConfirmed y SeatSold", async () => {
    const client = await TestClient.connect(world.port);
    await client.subscribe(`flight:${world.flight.id}`);
    const booking = await world.startBooking();
    const seat = await world.seatId("03A");
    await world.hold(booking, seat);
    await world.setPassengers(booking, [world.passenger(seat)]);
    await world.pay(booking, "key-ws-confirmacion-1", GOOD_CARD);

    await world.drainOutbox(2);

    await client.waitFor((m) => m.type === "SeatSold");
    const confirmed = await client.waitFor((m) => m.type === "BookingConfirmed");
    expect(confirmed.data).toMatchObject({ orderId: booking.id });
    client.close();
  });

  it("1.4 un cambio de estado del vuelo llega a la pantalla de resultados (flights:search) y al dashboard", async () => {
    const search = await TestClient.connect(world.port);
    const admin = await TestClient.connect(
      world.port,
      (world.staff.admin as string).replace("Bearer ", ""),
    );
    await search.subscribe("flights:search");
    await admin.subscribe(`dashboard:${world.flight.id}`);

    const { default: request } = await import("supertest");
    const res = await request(world.app)
      .patch(`/flights/${world.flight.id}/status`)
      .set("Authorization", world.staff.admin as string)
      .send({ status: "DELAYED" });
    expect(res.status).toBe(200);
    await pump();

    const seen = await search.waitFor((m) => m.type === "FlightStatusChanged");
    expect(seen.data).toMatchObject({ status: "DELAYED", previousStatus: "ACTIVE" });
    await admin.waitFor((m) => m.type === "FlightStatusChanged");
    search.close();
    admin.close();
  });

  it("4.3 el dashboard recibe un evento por cada cambio de asiento, solo con permiso", async () => {
    const viewer = await TestClient.connect(
      world.port,
      (world.staff.viewer as string).replace("Bearer ", ""),
    );
    const anonymous = await TestClient.connect(world.port);
    const nobody = await TestClient.connect(
      world.port,
      (world.staff.nobody as string).replace("Bearer ", ""),
    );
    const topic = `dashboard:${world.flight.id}`;

    expect((await viewer.subscribe(topic)).type).toBe("subscribed");
    expect((await anonymous.subscribe(topic)).code).toBe("FORBIDDEN");
    expect((await nobody.subscribe(topic)).code).toBe("FORBIDDEN");

    const booking = await world.startBooking();
    const seat = await world.seatId("03C");
    await world.hold(booking, seat);
    await pump();
    await viewer.waitFor((m) => m.type === "SeatHeld" && m.data?.seatId === seat);
    world.clock.advanceMinutes(16);
    await world.composed.releaseExpiredHolds.execute();
    await pump();
    await viewer.waitFor((m) => m.type === "SeatReleased" && m.data?.seatId === seat);
    viewer.close();
    anonymous.close();
    nobody.close();
  });

  it("rechaza temas inválidos", async () => {
    const client = await TestClient.connect(world.port);

    const socketMessages = client.messages;
    void client.subscribe("flight:not-a-uuid").catch(() => undefined);
    const bad = await client.waitFor((m) => m.code === "INVALID_TOPIC");
    expect(bad.type).toBe("error");
    expect(socketMessages.some((m) => m.type === "subscribed")).toBe(false);
    client.close();
  });
});
