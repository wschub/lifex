import { describe, expect, it } from "vitest";
import {
  isOfferEligible,
  priceForClass,
  type FlightPricingInput,
  type PricingConfig,
} from "../../../../src/modules/flights/domain/services/dynamic-price.ts";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date("2026-11-19T12:00:00Z");
const CONFIG: PricingConfig = { businessBaseMultiplier: 3, offerDiscountPercentage: 15 };

function flight(overrides: Partial<FlightPricingInput> = {}): FlightPricingInput {
  return {
    routeType: "DOMESTIC",
    status: "ACTIVE",
    // Salida a 3 h: fuera de la ventana de ofertas, así que aplica el precio dinámico.
    departureDate: new Date(NOW.getTime() + 3 * HOUR),
    basePriceDefault: 100,
    averagePriceEconomy: 0,
    averagePriceBusiness: 0,
    occupancyRate: 90,
    numAvailableSeats: 10,
    ...overrides,
  };
}

/** Salida `hours` horas después de NOW (precio dinámico: no hay oferta con menos de 8 días). */
const at = (hours: number, overrides: Partial<FlightPricingInput> = {}): FlightPricingInput =>
  flight({ departureDate: new Date(NOW.getTime() + hours * HOUR), ...overrides });

describe("precio dinámico", () => {
  it("primer ticket Economy: basePriceDefault +20 %", () => {
    // 100 × 1,20 = 120; a más de 72 h no hay recargo por horas.
    expect(priceForClass(at(100), "ECONOMY", NOW, CONFIG)).toEqual({
      priceUsd: 120,
      discountPercentage: null,
    });
  });

  it("primer ticket Business: basePriceDefault × 3 +20 %", () => {
    expect(priceForClass(at(100), "BUSINESS", NOW, CONFIG).priceUsd).toBe(360);
  });

  it("con promedio > 0 sube 5 % sobre el promedio de la clase", () => {
    const f = at(100, { averagePriceEconomy: 200, averagePriceBusiness: 500 });
    expect(priceForClass(f, "ECONOMY", NOW, CONFIG).priceUsd).toBe(210);
    expect(priceForClass(f, "BUSINESS", NOW, CONFIG).priceUsd).toBe(525);
  });

  describe("recargo de 0,5 % por hora del promedio en las últimas 72 h", () => {
    // Promedio 200: cada hora transcurrida suma 1,00 USD sobre el precio base 210.
    const withAverage = (hours: number, routeType: "DOMESTIC" | "INTERNATIONAL") =>
      at(hours, { routeType, averagePriceEconomy: 200 });

    it.each([
      // [horas que faltan, horas transcurridas, nacional / internacional]
      [72, 0],
      [48, 24],
      [10, 62],
    ])("a %i h faltantes suma %i horas transcurridas (nacional e internacional)", (h, elapsed) => {
      for (const type of ["DOMESTIC", "INTERNATIONAL"] as const) {
        expect(priceForClass(withAverage(h, type), "ECONOMY", NOW, CONFIG).priceUsd).toBe(
          210 + elapsed,
        );
      }
    });

    it("el recargo se congela en 5 h antes (internacional): máximo 67 horas", () => {
      expect(priceForClass(withAverage(5, "INTERNATIONAL"), "ECONOMY", NOW, CONFIG).priceUsd).toBe(
        277,
      );
      expect(priceForClass(withAverage(2, "INTERNATIONAL"), "ECONOMY", NOW, CONFIG).priceUsd).toBe(
        277,
      );
      expect(priceForClass(withAverage(1, "INTERNATIONAL"), "ECONOMY", NOW, CONFIG).priceUsd).toBe(
        277,
      );
    });

    it("el recargo se congela en 2 h antes (nacional): máximo 70 horas", () => {
      expect(priceForClass(withAverage(2, "DOMESTIC"), "ECONOMY", NOW, CONFIG).priceUsd).toBe(280);
      expect(priceForClass(withAverage(1, "DOMESTIC"), "ECONOMY", NOW, CONFIG).priceUsd).toBe(280);
    });

    it("cuenta solo horas completas", () => {
      // Faltan 71,5 h: han pasado 0,5 h → 0 horas completas.
      expect(
        priceForClass(at(71.5, { averagePriceEconomy: 200 }), "ECONOMY", NOW, CONFIG).priceUsd,
      ).toBe(210);
      // Faltan 70,5 h: 1,5 h → 1 hora completa.
      expect(
        priceForClass(at(70.5, { averagePriceEconomy: 200 }), "ECONOMY", NOW, CONFIG).priceUsd,
      ).toBe(211);
    });

    it("sin promedio, el recargo usa como referencia el precio del primer ticket", () => {
      // R = 100 × 1,2 = 120; a 48 h: 24 h × 0,5 % × 120 = 14,40.
      expect(priceForClass(at(48), "ECONOMY", NOW, CONFIG).priceUsd).toBe(134.4);
    });

    it("el vuelo ya salido no baja del tope", () => {
      expect(
        priceForClass(at(-3, { averagePriceEconomy: 200 }), "ECONOMY", NOW, CONFIG).priceUsd,
      ).toBe(280);
    });
  });
});

describe("oferta (excluyente con el precio dinámico)", () => {
  // Promedios altos: así el criterio (c) no cumple y cada prueba aísla un solo criterio.
  const HIGH = { averagePriceEconomy: 500, averagePriceBusiness: 2000 };

  const inWindow = (days: number, overrides: Partial<FlightPricingInput> = {}) =>
    flight({ departureDate: new Date(NOW.getTime() + days * DAY), ...overrides });

  it("un vuelo elegible ignora +20 %, +5 % y el recargo: classBase × (1 − descuento)", () => {
    const f = inWindow(10, { occupancyRate: 30 });
    expect(priceForClass(f, "ECONOMY", NOW, CONFIG)).toEqual({
      priceUsd: 85,
      discountPercentage: 15,
    });
    expect(priceForClass(f, "BUSINESS", NOW, CONFIG).priceUsd).toBe(255);
  });

  it("la ventana es de 8 a 30 días, con bordes incluidos", () => {
    const base = { occupancyRate: 10 };
    expect(isOfferEligible(inWindow(8, base), NOW, CONFIG)).toBe(true);
    expect(isOfferEligible(inWindow(30, base), NOW, CONFIG)).toBe(true);
    expect(
      isOfferEligible(
        flight({ ...base, departureDate: new Date(NOW.getTime() + 8 * DAY - 1) }),
        NOW,
        CONFIG,
      ),
    ).toBe(false);
    expect(
      isOfferEligible(
        flight({ ...base, departureDate: new Date(NOW.getTime() + 30 * DAY + 1) }),
        NOW,
        CONFIG,
      ),
    ).toBe(false);
  });

  it("solo los vuelos ACTIVE pueden ser oferta", () => {
    expect(
      isOfferEligible(inWindow(10, { status: "DELAYED", occupancyRate: 0 }), NOW, CONFIG),
    ).toBe(false);
    expect(
      isOfferEligible(inWindow(10, { status: "SOLD_OUT", occupancyRate: 0 }), NOW, CONFIG),
    ).toBe(false);
  });

  it("criterio (a): ocupación <= 60 %", () => {
    expect(isOfferEligible(inWindow(10, { occupancyRate: 60 }), NOW, CONFIG)).toBe(true);
    expect(isOfferEligible(inWindow(10, { occupancyRate: 60.01, ...HIGH }), NOW, CONFIG)).toBe(
      false,
    );
  });

  it("criterio (b): >= 100 asientos disponibles", () => {
    expect(
      isOfferEligible(inWindow(10, { occupancyRate: 90, numAvailableSeats: 100 }), NOW, CONFIG),
    ).toBe(true);
    expect(
      isOfferEligible(
        inWindow(10, { occupancyRate: 90, numAvailableSeats: 99, ...HIGH }),
        NOW,
        CONFIG,
      ),
    ).toBe(false);
  });

  it("criterio (c): ambos promedios no pasan 30 % sobre su base (Business con el multiplicador)", () => {
    const base = { occupancyRate: 90 };
    expect(
      isOfferEligible(
        inWindow(10, { ...base, averagePriceEconomy: 130, averagePriceBusiness: 390 }),
        NOW,
        CONFIG,
      ),
    ).toBe(true);
    expect(
      isOfferEligible(
        inWindow(10, { ...base, averagePriceEconomy: 130.01, averagePriceBusiness: 390 }),
        NOW,
        CONFIG,
      ),
    ).toBe(false);
    expect(
      isOfferEligible(
        inWindow(10, { ...base, averagePriceEconomy: 130, averagePriceBusiness: 390.01 }),
        NOW,
        CONFIG,
      ),
    ).toBe(false);
  });

  it("con ocupación alta y pocos asientos, y promedios altos, no es oferta y usa el dinámico", () => {
    const f = inWindow(10, {
      occupancyRate: 90,
      averagePriceEconomy: 200,
      averagePriceBusiness: 600,
    });
    expect(isOfferEligible(f, NOW, CONFIG)).toBe(false);
    expect(priceForClass(f, "ECONOMY", NOW, CONFIG)).toEqual({
      priceUsd: 210,
      discountPercentage: null,
    });
  });
});
