import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FLIGHT_ID, seatEvent } from "@/test/fixtures.ts";
import { createWsClient } from "./client.ts";

class FakeSocket {
  static instances: FakeSocket[] = [];
  static readonly OPEN = 1;
  readyState = 0;
  sent: unknown[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(message: unknown) {
    this.onmessage?.({ data: typeof message === "string" ? message : JSON.stringify(message) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

const TOPIC = `flight:${FLIGHT_ID}` as const;
const last = () => FakeSocket.instances.at(-1)!;

beforeEach(() => {
  FakeSocket.instances = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

const make = (extra: Partial<Parameters<typeof createWsClient>[1]> = {}) =>
  createWsClient("ws://api.test/ws", {
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    ...extra,
  });

describe("createWsClient", () => {
  it("al conectar envía subscribe y, tras el subscribed del servidor, pide resincronizar", () => {
    const onResync = vi.fn();
    const client = make({ onResync });
    client.subscribe(TOPIC);
    last().open();
    expect(last().sent).toEqual([{ action: "subscribe", topic: TOPIC }]);
    expect(onResync).not.toHaveBeenCalled();
    last().receive({ type: "subscribed", topic: TOPIC });
    expect(onResync).toHaveBeenCalledExactlyOnceWith(TOPIC);
  });

  it("entrega los eventos de vuelo al manejador del tema", () => {
    const onEvent = vi.fn();
    const client = make();
    client.subscribe(TOPIC, { onEvent });
    last().open();
    const event = seatEvent("SeatHeld", 0, 11);
    last().receive(event);
    expect(onEvent).toHaveBeenCalledExactlyOnceWith(event);
  });

  it("reconecta tras un cierre inesperado y vuelve a suscribir los temas", () => {
    const onResync = vi.fn();
    const client = make({ onResync });
    client.subscribe(TOPIC);
    last().open();
    last().receive({ type: "subscribed", topic: TOPIC });
    last().drop();
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(FakeSocket.instances).toHaveLength(2);
    last().open();
    expect(last().sent).toEqual([{ action: "subscribe", topic: TOPIC }]);
    last().receive({ type: "subscribed", topic: TOPIC });
    expect(onResync).toHaveBeenCalledTimes(2);
  });

  it("espera cada vez más entre reintentos, con tope de 8 s", () => {
    const client = make();
    client.subscribe(TOPIC);
    const delays: number[] = [];
    for (let i = 0; i < 7; i++) {
      const before = FakeSocket.instances.length;
      last().drop();
      let waited = 0;
      while (FakeSocket.instances.length === before) {
        vi.advanceTimersByTime(100);
        waited += 100;
        if (waited > 20_000) throw new Error("no reconectó");
      }
      delays.push(waited);
    }
    expect(delays).toEqual([500, 1000, 2000, 4000, 8000, 8000, 8000]);
  });

  it("ignora mensajes que no validan contra el esquema", () => {
    const onEvent = vi.fn();
    const client = make();
    client.subscribe(TOPIC, { onEvent });
    last().open();
    last().receive("esto no es json");
    last().receive({ type: "SeatHeld", version: "x" });
    last().receive({ type: "desconocido" });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("al cancelar la suscripción envía unsubscribe y deja de entregar eventos", () => {
    const onEvent = vi.fn();
    const client = make();
    const unsubscribe = client.subscribe(TOPIC, { onEvent });
    last().open();
    unsubscribe();
    expect(last().sent.at(-1)).toEqual({ action: "unsubscribe", topic: TOPIC });
    last().receive(seatEvent("SeatHeld", 0, 11));
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("suscribirse con el socket ya abierto envía subscribe al instante", () => {
    const client = make();
    client.subscribe(`flights:search`);
    last().open();
    client.subscribe(TOPIC);
    expect(last().sent).toContainEqual({ action: "subscribe", topic: TOPIC });
  });

  it("close() corta el socket y no reconecta", () => {
    const client = make();
    client.subscribe(TOPIC);
    last().open();
    client.close();
    vi.advanceTimersByTime(30_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("manda el token del staff en la URL", () => {
    const client = make({ token: "a b" });
    client.subscribe(TOPIC);
    expect(last().url).toBe("ws://api.test/ws?token=a%20b");
  });
});
