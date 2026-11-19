import { beforeEach, describe, expect, it, vi } from "vitest";
import { login, logout, refresh } from "./auth.ts";

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("auth api", () => {
  it("sends cookies and the CSRF header on login, refresh and logout", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            accessToken: "t",
            tokenType: "Bearer",
            expiresIn: 900,
            user: {
              publicId: "u",
              email: "a@b.co",
              firstName: "A",
              lastName: "B",
              countryDefault: null,
              mobilePhone: null,
              locale: "es",
              status: "ACTIVE",
              createdAt: "2026-11-01T00:00:00.000Z",
            },
          }),
        ),
      ),
    );
    await login({ email: "a@b.co", password: "x" });
    await refresh();
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await logout();
    for (const [, init] of fetchMock.mock.calls) {
      expect(init?.credentials).toBe("include");
      expect(new Headers(init?.headers).get("x-csrf-protection")).toBe("1");
    }
  });
});
