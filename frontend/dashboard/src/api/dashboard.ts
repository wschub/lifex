import {
  changeFlightStatusResponseSchema,
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
