import { beforeEach, describe, expect, it, vi } from "vitest";
import { isChunkLoadError, reloadOnce } from "./chunk-reload.ts";

describe("isChunkLoadError", () => {
  it.each([
    "Failed to fetch dynamically imported module: https://x.app/assets/Home-kzseercE.js",
    "error loading dynamically imported module: /assets/Home.js",
    "Importing a module script failed.",
    "Unable to preload CSS for /assets/index.css",
  ])("reconoce «%s»", (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it("no confunde otros errores", () => {
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isChunkLoadError("algo raro")).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe("reloadOnce", () => {
  beforeEach(() => sessionStorage.clear());

  it("recarga la primera vez y no vuelve a recargar enseguida (evita el bucle)", () => {
    const reload = vi.fn();
    let time = 1_000_000;
    expect(reloadOnce(reload, () => time)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);

    time += 5_000;
    expect(reloadOnce(reload, () => time)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("pasado un rato permite recargar otra vez (otro despliegue distinto)", () => {
    const reload = vi.fn();
    let time = 1_000_000;
    reloadOnce(reload, () => time);
    time += 60_000;
    expect(reloadOnce(reload, () => time)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });
});
