import type { MeResponse } from "@lifex/shared";

export const staffUser = {
  publicId: "u1",
  email: "viewer@lifex.test",
  firstName: "Vera",
  lastName: "Viewer",
  countryDefault: null,
  mobilePhone: null,
  locale: "es",
  status: "ACTIVE",
  createdAt: "2026-11-01T00:00:00.000Z",
};

export const makeMe = (permissions: string[], roles = ["ADMIN_VIEWER"]): MeResponse => ({
  user: staffUser,
  roles,
  permissions,
});

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

export const problemBody = (status: number, code: string, detail: string) => ({
  type: "about:blank",
  title: code,
  status,
  code,
  detail,
});

/** jsdom no trae `matchMedia`; el sidebar de shadcn lo usa para saber si es móvil. */
export function stubMatchMedia(matches: boolean): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}
