import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { cityImageSrc, fallbackToSky, SKY_IMAGE, useImageOrSky } from "./city-image.ts";

describe("cityImageSrc", () => {
  it("arma la ruta pública con el nombre del archivo que guarda la BD", () => {
    expect(cityImageSrc("medellin.jpg")).toBe("/img/destinations/medellin.jpg");
  });

  it("usa la imagen del cielo cuando la ciudad no tiene imagen", () => {
    expect(cityImageSrc(null)).toBe(SKY_IMAGE);
    expect(cityImageSrc(undefined)).toBe(SKY_IMAGE);
    expect(cityImageSrc("")).toBe(SKY_IMAGE);
  });

  it("no deja pasar rutas: solo un nombre de archivo", () => {
    expect(cityImageSrc("../secret.jpg")).toBe(SKY_IMAGE);
    expect(cityImageSrc("/img/destinations/x.jpg")).toBe(SKY_IMAGE);
  });
});

describe("fallbackToSky", () => {
  it("cambia la imagen rota por la del cielo", () => {
    const img = document.createElement("img");
    img.src = "/img/destinations/lisboa.jpg";
    fallbackToSky({ currentTarget: img } as never);
    expect(img.getAttribute("src")).toBe(SKY_IMAGE);
  });

  it("no entra en bucle si la imagen del cielo también falla", () => {
    const img = document.createElement("img");
    img.src = SKY_IMAGE;
    let sets = 0;
    const set = img.setAttribute.bind(img);
    img.setAttribute = (n: string, v: string) => {
      sets += 1;
      set(n, v);
    };
    fallbackToSky({ currentTarget: img } as never);
    expect(sets).toBe(0);
  });
});

describe("useImageOrSky", () => {
  const originalImage = globalThis.Image;
  afterEach(() => {
    globalThis.Image = originalImage;
  });

  function stubImage(outcome: "load" | "error") {
    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => (outcome === "load" ? this.onload?.() : this.onerror?.()));
      }
    }
    globalThis.Image = FakeImage as never;
  }

  it("conserva la imagen si carga", async () => {
    stubImage("load");
    const { result } = renderHook(() => useImageOrSky("/img/destinations/medellin.jpg"));
    await waitFor(() => expect(result.current).toBe("/img/destinations/medellin.jpg"));
  });

  it("cae al cielo si el archivo no existe", async () => {
    stubImage("error");
    const { result } = renderHook(() => useImageOrSky("/img/destinations/lisboa.jpg"));
    await waitFor(() => expect(result.current).toBe(SKY_IMAGE));
  });
});
