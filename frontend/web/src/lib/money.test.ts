import { describe, expect, it } from "vitest";
import { formatMoney } from "./money.ts";

describe("formatMoney", () => {
  it("muestra USD en inglés", () => {
    expect(formatMoney(340, "en", 3300)).toBe("USD 340");
  });

  it("convierte a COP en español con la tasa IATA_TRM", () => {
    expect(formatMoney(340, "es", 3300)).toBe("COP 1.122.000");
  });

  it("redondea a pesos enteros y a dólares enteros", () => {
    expect(formatMoney(100.4, "es", 3333)).toBe("COP 334.633");
    expect(formatMoney(339.6, "en", 3300)).toBe("USD 340");
  });

  it("muestra cero sin separadores", () => {
    expect(formatMoney(0, "es", 3300)).toBe("COP 0");
  });
});
