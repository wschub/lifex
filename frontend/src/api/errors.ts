import type { Problem } from "@lifex/shared";

/**
 * Error de la API. `code` es estable (`SEAT_UNAVAILABLE`, `INVALID_FLIGHT_STATUS`…) y es lo que mira la UI.
 * Códigos propios del cliente: `NETWORK` (sin respuesta), `CONTRACT` (el cuerpo no cumple `shared/`),
 * `TOO_MANY_REQUESTS` (429 sin cuerpo problem) y `HTTP_ERROR` (otro fallo sin cuerpo problem).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly problem: Problem | undefined;

  constructor(status: number, code: string, problem?: Problem, message?: string) {
    super(message ?? problem?.detail ?? code);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.problem = problem;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
