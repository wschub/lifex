import type { PublicConfig } from "@lifex/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { createMemoryRouter, RouterProvider, type RouteObject } from "react-router";
import { keys } from "@/api/keys.ts";

export const TEST_CONFIG: PublicConfig = {
  iataTrm: 3300,
  taxPercentage: 19,
  maxSeatLockMinutes: 15,
  idleTimeoutMinutes: 2,
  maxHeldSeatsPerSession: 6,
};

export function makeQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  client.setQueryData(keys.config, TEST_CONFIG);
  return client;
}

/** Monta una o varias rutas con router en memoria y la configuración pública ya cargada. */
export function renderRoutes(
  routes: RouteObject[],
  initialEntries: string[],
  client = makeQueryClient(),
) {
  const router = createMemoryRouter(routes, { initialEntries });
  const utils = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router, client };
}

export function renderPage(element: ReactElement, path = "/", entry = path, client?: QueryClient) {
  return renderRoutes([{ path, element }], [entry], client);
}
