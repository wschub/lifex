import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, makeMe, problemBody } from "@/test/admin-fixtures.ts";
import { usePermission, useStaffSession } from "@/stores/staff-session.ts";
import { AdminGuard } from "./AdminGuard.tsx";

const fetchMock = vi.fn<typeof fetch>();
const refreshBody = { accessToken: "fresh", tokenType: "Bearer", expiresIn: 900 };

function ManageProbe() {
  return <p>{usePermission("flights:manage") ? "can-manage" : "read-only"}</p>;
}

function renderGuarded() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/login" element={<p>login</p>} />
        <Route
          path="/"
          element={
            <AdminGuard>
              <p>dashboard</p>
              <ManageProbe />
            </AdminGuard>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  useStaffSession.getState().clear();
});
afterEach(() => vi.useRealTimers());

describe("AdminGuard", () => {
  it("redirects to the login when there is no session and refresh fails", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(problemBody(401, "INVALID_REFRESH_TOKEN", "Sesión inválida"), 401),
    );
    renderGuarded();
    expect(await screen.findByText("login")).toBeInTheDocument();
    expect(screen.queryByText("dashboard")).not.toBeInTheDocument();
  });

  it("recovers the session from the refresh cookie", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(refreshBody))
      .mockResolvedValueOnce(jsonResponse(makeMe(["dashboard:read"])));
    renderGuarded();
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(useStaffSession.getState().accessToken).toBe("fresh");
  });

  it("lets a viewer (dashboard:read only) in, without flights:manage", async () => {
    useStaffSession.getState().setSession("t", makeMe(["dashboard:read"]), 900);
    renderGuarded();
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(screen.getByText("read-only")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("redirects a session without dashboard:read", async () => {
    useStaffSession.getState().setSession("t", makeMe(["flights:read"]), 900);
    renderGuarded();
    expect(await screen.findByText("login")).toBeInTheDocument();
  });

  it("refreshes the access token before it expires", async () => {
    vi.useFakeTimers();
    useStaffSession.getState().setSession("old", makeMe(["dashboard:read"]), 900);
    fetchMock.mockResolvedValueOnce(jsonResponse(refreshBody));
    renderGuarded();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900_000);
    });
    expect(useStaffSession.getState().accessToken).toBe("fresh");
  });
});
