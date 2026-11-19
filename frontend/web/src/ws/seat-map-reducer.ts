import type { FlightEvent, SeatMap } from "@lifex/shared";

export interface SeatEventResult {
  map: SeatMap;
  /** Se perdió algún evento intermedio: hay que volver a pedir el snapshot por REST. */
  gap: boolean;
}

/**
 * Aplica un evento de vuelo sobre el snapshot. Cada evento trae un `version` secuencial por vuelo:
 * los repetidos o anteriores se ignoran y un salto (`version > map.version + 1`) marca `gap`.
 * Con hueco el evento igual se aplica (cada uno trae el estado absoluto del asiento); el snapshot
 * posterior corrige el resto. No modifica el mapa de entrada.
 */
export function applySeatEvent(map: SeatMap, event: FlightEvent): SeatEventResult {
  if (event.version <= map.version) return { map, gap: false };
  const gap = event.version > map.version + 1;

  switch (event.type) {
    case "SeatHeld":
    case "SeatPaymentPending":
    case "SeatSold":
    case "SeatReleased": {
      const { seatId, status } = event.data;
      return {
        map: {
          ...map,
          version: event.version,
          seats: map.seats.map((seat) => (seat.id === seatId ? { ...seat, status } : seat)),
        },
        gap,
      };
    }
    case "FlightStatusChanged":
      return {
        map: { ...map, version: event.version, flightStatus: event.data.status },
        gap,
      };
    case "BookingConfirmed":
      // Los asientos ya cambiaron con sus SeatSold; este evento solo avanza la versión.
      return { map: { ...map, version: event.version }, gap };
  }
}
