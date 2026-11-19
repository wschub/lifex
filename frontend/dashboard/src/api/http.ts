import { IDEMPOTENCY_KEY_HEADER, problemSchema } from "@lifex/shared";
import type { z } from "zod";
import { useLangStore } from "@/i18n/i18n.ts";
import { apiBaseUrl } from "./config.ts";
import { ApiError } from "./errors.ts";

export interface ApiInit extends Omit<RequestInit, "body"> {
  /** JWT de la sesión de invitado (reserva). */
  bookingToken?: string;
  /** JWT de acceso del staff. */
  staffToken?: string;
  /** Cuerpo JSON: se serializa y se marca `application/json`. */
  json?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Endpoints con cookie (`/auth/refresh`, `/auth/logout`): añade `x-csrf-protection` y envía cookies. */
  csrf?: boolean;
  idempotencyKey?: string;
}

function buildUrl(path: string, query: ApiInit["query"]): string {
  const url = new URL(apiBaseUrl() + path, location.origin);
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }
  return url.toString();
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Llama a la API y valida la respuesta con un esquema de `@lifex/shared`.
 * Cualquier fallo sale como `ApiError` (red, HTTP o contrato).
 */
export async function apiFetch<S extends z.ZodType>(
  path: string,
  schema: S,
  init: ApiInit = {},
): Promise<z.output<S>> {
  const { bookingToken, staffToken, json, query, csrf, idempotencyKey, ...rest } = init;
  const headers = new Headers(rest.headers);
  headers.set("Accept-Language", useLangStore.getState().lang);
  const token = bookingToken ?? staffToken;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (csrf) headers.set("x-csrf-protection", "1");
  if (idempotencyKey) headers.set(IDEMPOTENCY_KEY_HEADER, idempotencyKey);
  let body: string | undefined;
  if (json !== undefined) {
    body = JSON.stringify(json);
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      ...rest,
      headers,
      body,
      ...(csrf ? { credentials: "include" as const } : {}),
    });
  } catch {
    throw new ApiError(0, "NETWORK");
  }

  const data = await readBody(response);
  if (!response.ok) {
    const parsed = problemSchema.safeParse(data);
    if (parsed.success) throw new ApiError(response.status, parsed.data.code, parsed.data);
    throw new ApiError(
      response.status,
      response.status === 429 ? "TOO_MANY_REQUESTS" : "HTTP_ERROR",
    );
  }

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(
      response.status,
      "CONTRACT",
      undefined,
      `La respuesta de ${path} no cumple el contrato: ${result.error.message}`,
    );
  }
  return result.data;
}
