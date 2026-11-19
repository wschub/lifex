import type { MeResponse } from "@lifex/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStaffSession } from "@/stores/staff-session.ts";
import { LoginPage } from "./LoginPage.tsx";

const user = {
  publicId: "u1",
  email: "admin@lifex.test",
  firstName: "Ada",
  lastName: "Admin",
  countryDefault: null,
  mobilePhone: null,
  locale: "es",
  status: "ACTIVE",
  createdAt: "2026-11-01T00:00:00.000Z",
};

const loginBody = { accessToken: "jwt", tokenType: "Bearer", expiresIn: 900, user };
const me = (permissions: string[]): MeResponse => ({ user, roles: ["ADMIN"], permissions });

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const fetchMock = vi.fn<typeof fetch>();

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<p>panel</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function enterEmail(email: string) {
  await userEvent.type(screen.getByLabelText("Correo electrónico"), email);
  await userEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  useStaffSession.getState().clear();
});

describe("LoginPage", () => {
  it("rejects an email with an invalid format without calling the API", async () => {
    renderLogin();
    await enterEmail("no-es-un-correo");
    expect(screen.getByText("Escribe un correo válido")).toBeInTheDocument();
    expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("moves to the password step without any API call", async () => {
    renderLogin();
    await enterEmail("admin@lifex.test");
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByText("admin@lifex.test")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts credentials, loads permissions and opens the panel", async () => {
    fetchMock
      .mockResolvedValueOnce(json(loginBody))
      .mockResolvedValueOnce(json(me(["dashboard:read"])));
    renderLogin();
    await enterEmail("admin@lifex.test");
    await userEvent.type(screen.getByLabelText("Contraseña"), "clave-de-prueba-1234");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("panel")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/auth\/login$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "admin@lifex.test",
      password: "clave-de-prueba-1234",
    });
    expect(useStaffSession.getState().accessToken).toBe("jwt");
  });

  it("shows the API error and keeps the email when credentials are wrong", async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        {
          type: "about:blank",
          title: "Unauthorized",
          status: 401,
          code: "INVALID_CREDENTIALS",
          detail: "Credenciales inválidas",
        },
        401,
      ),
    );
    renderLogin();
    await enterEmail("admin@lifex.test");
    await userEvent.type(screen.getByLabelText("Contraseña"), "mala");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("Credenciales inválidas")).toBeInTheDocument();
    expect(screen.getByText("admin@lifex.test")).toBeInTheDocument();
    expect(screen.queryByText("panel")).not.toBeInTheDocument();
  });

  it("denies access to a user without dashboard:read", async () => {
    fetchMock
      .mockResolvedValueOnce(json(loginBody))
      .mockResolvedValueOnce(json(me(["flights:read"])))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    renderLogin();
    await enterEmail("admin@lifex.test");
    await userEvent.type(screen.getByLabelText("Contraseña"), "clave-de-prueba-1234");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText(/no tiene acceso al panel/i)).toBeInTheDocument();
    await waitFor(() => expect(useStaffSession.getState().accessToken).toBeNull());
    expect(screen.queryByText("panel")).not.toBeInTheDocument();
  });
});
