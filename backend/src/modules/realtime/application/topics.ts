import { FLIGHT_EVENT } from "../../../shared/outbox/flight-events.ts";

export const TOPIC = {
  flight: (flightId: string) => `flight:${flightId}`,
  dashboard: (flightId: string) => `dashboard:${flightId}`,
  flightsSearch: "flights:search",
} as const;

/** A qué temas se difunde cada evento de vuelo. */
export function topicsFor(eventType: string, flightId: string): string[] {
  switch (eventType) {
    case FLIGHT_EVENT.flightStatusChanged:
      return [TOPIC.flight(flightId), TOPIC.dashboard(flightId), TOPIC.flightsSearch];
    case FLIGHT_EVENT.bookingConfirmed:
    case FLIGHT_EVENT.seatHeld:
    case FLIGHT_EVENT.seatReleased:
    case FLIGHT_EVENT.seatPaymentPending:
    case FLIGHT_EVENT.seatSold:
      return [TOPIC.flight(flightId), TOPIC.dashboard(flightId)];
    default:
      return [];
  }
}
