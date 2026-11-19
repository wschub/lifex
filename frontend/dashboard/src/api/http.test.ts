import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { useLangStore } from "@/i18n/i18n.ts";
import { apiFetch } from "./http.ts";
import { ApiError } from "./errors.ts";

const okSchema = z.object({ hello: z.string() });

function respond(status: number, body: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  useLangStore.setState({ lang: "es" });
});
afterEach(() => vi.unstubAllGlobals());

const problem = (status: number, code: string) => ({
  type: "about:blank",
  title: "Error",
  status,
  code,
  detail: "detalle",
});

describe("apiFetch", () => {
  it("parsea una respuesta válida con el esquema", async () => {
    fetchMock.mockResolvedValue(respond(200, { hello: "mundo" }));
    await expect(apiFetch("/x", okSchema)).resolves.toEqual({ hello: "mundo" });
  });

  it("lanza un error de contrato si el cuerpo no cumple el esquema", async () => {
    fetchMock.mockResolvedValue(respond(200, { hello: 5 }));
    await expect(apiFetch("/x", okSchema)).rejects.toMatchObject({ code: "CONTRACT" });
  });

  it("convierte un 409 SEAT_UNAVAILABLE en ApiError con ese code", async () => {
    fetchMock.mockResolvedValue(respond(409, problem(409, "SEAT_UNAVAILABLE")));
    const error = await apiFetch("/x", okSchema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "SEAT_UNAVAILABLE" });
    expect((error as ApiError).problem?.detail).toBe("detalle");
  });

  it("convierte un 429 en ApiError con status 429", async () => {
    fetchMock.mockResolvedValue(respond(429, problem(429, "TOO_MANY_REQUESTS")));
    await expect(apiFetch("/x", okSchema)).rejects.toMatchObject({ status: 429 });
  });

  it("trata un 429 sin cuerpo problem como TOO_MANY_REQUESTS", async () => {
    fetchMock.mockResolvedValue(new Response("slow down", { status: 429 }));
    await expect(apiFetch("/x", okSchema)).rejects.toMatchObject({
      status: 429,
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("convierte un fallo de red en ApiError NETWORK", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiFetch("/x", okSchema)).rejects.toMatchObject({ status: 0, code: "NETWORK" });
  });

  it("envía el token de la reserva como Bearer", async () => {
    fetchMock.mockResolvedValue(respond(200, { hello: "a" }));
    await apiFetch("/x", okSchema, { bookingToken: "tok-1" });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer tok-1");
  });

  it("envía el token del staff como Bearer", async () => {
    fetchMock.mockResolvedValue(respond(200, { hello: "a" }));
    await apiFetch("/x", okSchema, { staffToken: "staff-1" });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer staff-1");
  });

  it("envía Accept-Language con el idioma activo", async () => {
    fetchMock.mockResolvedValue(respond(200, { hello: "a" }));
    useLangStore.setState({ lang: "en" });
    await apiFetch("/x", okSchema);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(new Headers(init.headers).get("accept-language")).toBe("en");
  });

  it("serializa json y lo marca como application/json", async () => {
    fetchMock.mockResolvedValue(respond(200, { hello: "a" }));
    await apiFetch("/x", okSchema, { method: "POST", json: { a: 1 } });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.body).toBe('{"a":1}');
    expect(new Headers(init.headers).get("content-type")).toBe("application/json");
  });

  it("con csrf añade x-csrf-protection y manda las cookies", async () => {
    fetchMock.mockResolvedValue(respond(200, { hello: "a" }));
    await apiFetch("/x", okSchema, { method: "POST", csrf: true });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(new Headers(init.headers).get("x-csrf-protection")).toBe("1");
    expect(init.credentials).toBe("include");
  });

  it("una respuesta 204 vacía valida contra z.undefined()", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiFetch("/x", z.undefined())).resolves.toBeUndefined();
  });

  it("sin VITE_API_URL la API es /api en el mismo origen, con query", async () => {
    fetchMock.mockResolvedValue(respond(200, { hello: "a" }));
    await apiFetch("/flights", okSchema, { query: { from: "BOG", to: "MDE" } });
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      `${location.origin}/api/flights?from=BOG&to=MDE`,
    );
  });
});
