import type { FlightEvent, SeatMap } from "@lifex/shared";

export const FLIGHT_ID = "11111111-1111-4111-8111-111111111111";
export const SEAT_IDS = [
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
] as const;

/** Mapa de 3 asientos libres en la versión 10. */
export function makeSeatMap(overrides: Partial<SeatMap> = {}): SeatMap {
  return {
    flightId: FLIGHT_ID,
    flightStatus: "ACTIVE",
    version: 10,
    seats: SEAT_IDS.map((id, index) => ({
      id,
      identifier: `0${index + 1}A`,
      row: index + 1,
      column: "A",
      seatClass: "ECONOMY" as const,
      priceUsd: 25,
      status: "FREE" as const,
    })),
    ...overrides,
  };
}

type SeatEventType = "SeatHeld" | "SeatPaymentPending" | "SeatSold";
const SEAT_STATUS = {
  SeatHeld: "BLOCKED",
  SeatPaymentPending: "PAYMENT_PENDING",
  SeatSold: "RESERVED",
} as const;

export function seatEvent(type: SeatEventType, seatIndex: number, version: number): FlightEvent {
  return {
    type,
    topic: `flight:${FLIGHT_ID}`,
    flightId: FLIGHT_ID,
    version,
    at: "2026-11-24T12:00:00.000Z",
    data: {
      seatId: SEAT_IDS[seatIndex]!,
      seatIdentifier: `0${seatIndex + 1}A`,
      status: SEAT_STATUS[type],
    },
  };
}

export function releasedEvent(seatIndex: number, version: number): FlightEvent {
  return {
    type: "SeatReleased",
    topic: `flight:${FLIGHT_ID}`,
    flightId: FLIGHT_ID,
    version,
    at: "2026-11-24T12:00:00.000Z",
    data: {
      seatId: SEAT_IDS[seatIndex]!,
      seatIdentifier: `0${seatIndex + 1}A`,
      status: "FREE",
      reason: "released",
    },
  };
}

export function statusChangedEvent(
  status: "CANCELLED" | "DELAYED" | "ACTIVE",
  version: number,
): FlightEvent {
  return {
    type: "FlightStatusChanged",
    topic: `flight:${FLIGHT_ID}`,
    flightId: FLIGHT_ID,
    version,
    at: "2026-11-24T12:00:00.000Z",
    data: { status, previousStatus: "ACTIVE" },
  };
}
