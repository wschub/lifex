import { describe, expect, it } from "vitest";
import { cityImageSrc, SKY_IMAGE } from "./city-image.ts";

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
