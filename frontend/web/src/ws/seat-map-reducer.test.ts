import { describe, expect, it } from "vitest";
import { makeSeatMap, releasedEvent, seatEvent, statusChangedEvent } from "@/test/fixtures.ts";
import { applySeatEvent } from "./seat-map-reducer.ts";

describe("applySeatEvent", () => {
  it("SeatHeld pone el asiento BLOCKED y sube la versión", () => {
    const { map, gap } = applySeatEvent(makeSeatMap(), seatEvent("SeatHeld", 0, 11));
    expect(map.seats[0]!.status).toBe("BLOCKED");
    expect(map.seats[1]!.status).toBe("FREE");
    expect(map.version).toBe(11);
    expect(gap).toBe(false);
  });

  it("SeatReleased deja el asiento FREE", () => {
    const blocked = applySeatEvent(makeSeatMap(), seatEvent("SeatHeld", 1, 11)).map;
    const { map } = applySeatEvent(blocked, releasedEvent(1, 12));
    expect(map.seats[1]!.status).toBe("FREE");
    expect(map.version).toBe(12);
  });

  it("SeatSold deja el asiento RESERVED", () => {
    const { map } = applySeatEvent(makeSeatMap(), seatEvent("SeatSold", 2, 11));
    expect(map.seats[2]!.status).toBe("RESERVED");
  });

  it("SeatPaymentPending deja el asiento PAYMENT_PENDING", () => {
    const { map } = applySeatEvent(makeSeatMap(), seatEvent("SeatPaymentPending", 0, 11));
    expect(map.seats[0]!.status).toBe("PAYMENT_PENDING");
  });

  it("ignora un evento con versión repetida o anterior (mismo objeto, sin hueco)", () => {
    const start = makeSeatMap();
    const same = applySeatEvent(start, seatEvent("SeatHeld", 0, 10));
    expect(same.map).toBe(start);
    expect(same.gap).toBe(false);
    const older = applySeatEvent(start, seatEvent("SeatHeld", 0, 7));
    expect(older.map).toBe(start);
    expect(older.gap).toBe(false);
  });

  it("un salto de 2 devuelve gap: true", () => {
    const { gap } = applySeatEvent(makeSeatMap(), seatEvent("SeatHeld", 0, 12));
    expect(gap).toBe(true);
  });

  it("FlightStatusChanged actualiza el estado del vuelo", () => {
    const { map } = applySeatEvent(makeSeatMap(), statusChangedEvent("CANCELLED", 11));
    expect(map.flightStatus).toBe("CANCELLED");
    expect(map.version).toBe(11);
  });

  it("un asiento desconocido no rompe y la versión avanza", () => {
    const event = seatEvent("SeatHeld", 0, 11);
    if (event.type === "SeatHeld") event.data.seatId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const { map } = applySeatEvent(makeSeatMap(), event);
    expect(map.seats.every((s) => s.status === "FREE")).toBe(true);
    expect(map.version).toBe(11);
  });

  it("no modifica el mapa de entrada", () => {
    const start = makeSeatMap();
    applySeatEvent(start, seatEvent("SeatHeld", 0, 11));
    expect(start.seats[0]!.status).toBe("FREE");
    expect(start.version).toBe(10);
  });
});
