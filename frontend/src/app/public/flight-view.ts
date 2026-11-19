import type { PublicFlight } from "@lifex/shared";
import { DISPLAY_TIME_ZONE, formatTime } from "@/lib/dates.ts";

/** Fecha (AAAA-MM-DD) de un instante en hora de Colombia. */
export const bogotaDay = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TIME_ZONE }).format(new Date(iso));

export interface FlightTimes {
  dep: string;
  arr: string;
  /** La llegada cae al día siguiente (hora de Colombia). */
  nextDay: boolean;
  durationMinutes: number;
}

export function flightTimes(
  flight: Pick<PublicFlight, "departureDate" | "arrivalDate">,
): FlightTimes {
  return {
    dep: formatTime(flight.departureDate),
    arr: formatTime(flight.arrivalDate),
    nextDay: bogotaDay(flight.arrivalDate) !== bogotaDay(flight.departureDate),
    durationMinutes: Math.round(
      (new Date(flight.arrivalDate).getTime() - new Date(flight.departureDate).getTime()) / 60_000,
    ),
  };
}

/** "10h 05m" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m < 10 ? "0" : ""}${m}m`;
}

/** Es una salida que ya no se puede comprar. */
export const isBookable = (flight: Pick<PublicFlight, "status" | "soldOut">): boolean =>
  !flight.soldOut && (flight.status === "ACTIVE" || flight.status === "DELAYED");
