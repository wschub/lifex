import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // jsdom sin almacenamiento: nada que limpiar
  }
});

// jsdom no trae ResizeObserver (las gráficas de recharts lo usan para medir su contenedor).
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
}
