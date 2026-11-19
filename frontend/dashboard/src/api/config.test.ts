import { afterEach, describe, expect, it, vi } from "vitest";
import { apiBaseUrl, wsUrl } from "./config.ts";

describe("configuración de la API", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("por defecto la API es /api y el WebSocket usa el host de la página", () => {
    vi.stubEnv("VITE_API_URL", "");
    vi.stubGlobal("location", { protocol: "http:", host: "localhost:8080" });
    expect(apiBaseUrl()).toBe("/api");
    expect(wsUrl()).toBe("ws://localhost:8080/api/ws");
  });

  it("en https el WebSocket es wss", () => {
    vi.stubEnv("VITE_API_URL", "");
    vi.stubGlobal("location", { protocol: "https:", host: "lifex.example.com" });
    expect(wsUrl()).toBe("wss://lifex.example.com/api/ws");
  });

  it("con VITE_API_URL absoluta se usa tal cual y se quita la barra final", () => {
    vi.stubEnv("VITE_API_URL", "https://api.example.com/");
    expect(apiBaseUrl()).toBe("https://api.example.com");
    expect(wsUrl()).toBe("wss://api.example.com/ws");
  });
});
