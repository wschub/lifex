import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LANG_STORAGE_KEY, useLang, useLangStore } from "./i18n.ts";

beforeEach(() => {
  localStorage.clear();
  useLangStore.setState({ lang: "es" });
});
afterEach(() => vi.restoreAllMocks());

describe("useLang", () => {
  it("traduce el login en español e inglés", () => {
    const { result } = renderHook(() => useLang());
    expect(result.current.t("login")).toBe("Iniciar sesión");
    act(() => result.current.setLang("en"));
    expect(result.current.lang).toBe("en");
    expect(result.current.t("login")).toBe("Log in");
  });

  it("devuelve la clave si no existe", () => {
    const { result } = renderHook(() => useLang());
    expect(result.current.t("clave-inexistente")).toBe("clave-inexistente");
  });

  it("sustituye variables {n}", () => {
    const { result } = renderHook(() => useLang());
    expect(result.current.t("step.of", { n: 2 })).toBe("Paso 2 de 4");
  });

  it("usa el texto en inglés cuando el idioma es inglés", () => {
    const { result } = renderHook(() => useLang());
    act(() => result.current.setLang("en"));
    expect(result.current.t("i.bag3")).toBe("3 checked bags (32 kg)");
  });

  it("los textos de una página tienen prioridad sobre los comunes", () => {
    const { result } = renderHook(() => useLang("credits"));
    expect(result.current.t("h")).toBe("Créditos de fotos");
  });

  it("guarda el idioma en lx-lang y lo comparten todos los componentes", () => {
    const a = renderHook(() => useLang());
    const b = renderHook(() => useLang());
    act(() => a.result.current.setLang("en"));
    expect(localStorage.getItem(LANG_STORAGE_KEY)).toBe("en");
    expect(LANG_STORAGE_KEY).toBe("lx-lang");
    expect(b.result.current.lang).toBe("en");
  });

  it("sigue funcionando si localStorage lanza", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    const { result } = renderHook(() => useLang());
    expect(() => act(() => result.current.setLang("en"))).not.toThrow();
    expect(result.current.lang).toBe("en");
  });
});
