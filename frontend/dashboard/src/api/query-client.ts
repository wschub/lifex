import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "./errors.ts";

/** No se reintentan los errores 4xx (no van a cambiar); los de red y 5xx, hasta 2 veces. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
