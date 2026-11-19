import {
  changeFlightStatusResponseSchema,
  setCheckInResponseSchema,
  type SetCheckInRequest,
  type ChangeFlightStatusRequest,
  type FlightStatus,
} from "@lifex/shared";
import { apiFetch } from "./http.ts";

/** `PATCH /flights/:id/status` (permiso `flights:manage`). Cancelar o retrasar dispara correos a los pasajeros. */
export const changeFlightStatus = (flightId: string, status: FlightStatus, staffToken: string) =>
  apiFetch(`/flights/${flightId}/status`, changeFlightStatusResponseSchema, {
    method: "PATCH",
    json: { status } satisfies ChangeFlightStatusRequest,
    staffToken,
  });

/** `PATCH /dashboard/flights/:id/passengers/:ticketId/check-in` (permiso `flights:manage`). */
export const setPassengerCheckIn = (
  flightId: string,
  ticketId: string,
  checkedIn: boolean,
  staffToken: string,
) =>
  apiFetch(
    `/dashboard/flights/${flightId}/passengers/${ticketId}/check-in`,
    setCheckInResponseSchema,
    { method: "PATCH", json: { checkedIn } satisfies SetCheckInRequest, staffToken },
  );
