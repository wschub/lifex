import type { LuggageType, PublicFlight } from "@lifex/shared";
import type { TFunction } from "@/i18n/i18n.ts";
import type { Cabin, FareId } from "@/stores/booking-wizard.ts";
import type { IconName } from "./shell/icon-paths.ts";

/**
 * Las tarifas de la web son los tipos de equipaje del catálogo (`GET /catalog/luggage-types`):
 * rank 1-3 → Economy Light/Classic/Flex, rank 4-5 → Business (los nombres del prototipo, Elite y Royal).
 * Alinear estos nombres y precios con el backend es el pendiente urgente 8.1 del diseño.
 */
const FARE_BY_RANK: Record<number, FareId> = {
  1: "light",
  2: "classic",
  3: "flex",
  4: "elite",
  5: "royal",
};

export interface FareOption {
  id: FareId;
  luggageTypeId: number;
  cabin: Cabin;
  /** Recargo sobre el precio del asiento, en %. */
  feePercentage: number;
}

export const cabinOf = (id: FareId): Cabin =>
  id === "elite" || id === "royal" ? "business" : "economy";

export function fareOptions(types: readonly LuggageType[]): FareOption[] {
  return types
    .filter((lt) => FARE_BY_RANK[lt.rank] !== undefined)
    .sort((a, b) => a.rank - b.rank)
    .map((lt) => {
      const id = FARE_BY_RANK[lt.rank]!;
      return { id, luggageTypeId: lt.id, cabin: cabinOf(id), feePercentage: lt.feePercentage };
    });
}

const cents = (usd: number) => Math.round(usd * 100) / 100;

/**
 * Precio por pasajero con impuestos incluidos, antes de elegir asiento: precio medio de la cabina,
 * más el recargo del tipo de equipaje, más impuestos. El total definitivo lo calcula el backend con el asiento real.
 */
export function farePriceUsd(
  fare: FareOption,
  flight: PublicFlight,
  taxPercentage: number,
): number {
  const base =
    fare.cabin === "business" ? flight.averagePriceBusinessUsd : flight.averagePriceEconomyUsd;
  return cents(base * (1 + fare.feePercentage / 100) * (1 + taxPercentage / 100));
}

/** Precio más bajo de la cabina Economy (tarifa Light): el "Desde" de tarjetas y de la tira de fechas. */
export function lowestPriceUsd(
  fares: readonly FareOption[],
  flights: readonly PublicFlight[],
  taxPercentage: number,
): number | null {
  const light = fares.find((f) => f.id === "light");
  if (!light) return null;
  const prices = flights
    .filter((f) => !f.soldOut && f.status !== "CANCELLED")
    .map((f) => farePriceUsd(light, f, taxPercentage));
  return prices.length ? Math.min(...prices) : null;
}

export function fareLabel(id: FareId, t: TFunction): string {
  return cabinOf(id) === "business"
    ? `${t("cabin.business")} ${t(`fare.${id}`)}`
    : `${t("cabin.economy")} · ${t(`fare.${id}`)}`;
}

/** Millas lifexperience por USD, por tarifa. */
export const MILES_PER_USD: Record<FareId, number> = {
  light: 3,
  classic: 6,
  flex: 8,
  elite: 10,
  royal: 12,
};

type FareItem = readonly [key: string, included: 0 | 1, icon: IconName];

/** Qué incluye cada tarifa (textos del diccionario del prototipo). */
export const FARE_ITEMS: Record<FareId, readonly FareItem[]> = {
  light: [
    ["i.personal", 1, "bag"],
    ["i.carry", 1, "luggage"],
    ["i.meal", 1, "meal"],
    ["i.miles3", 1, "star"],
  ],
  classic: [
    ["i.personal", 1, "bag"],
    ["i.carry", 1, "luggage"],
    ["i.bag", 1, "luggage"],
    ["i.checkin", 1, "check"],
    ["i.seatE", 1, "seat"],
    ["i.meal", 1, "meal"],
    ["i.miles6", 1, "star"],
    ["i.change", 0, "x"],
    ["i.refund", 0, "x"],
  ],
  flex: [
    ["i.personal", 1, "bag"],
    ["i.carry", 1, "luggage"],
    ["i.bag", 1, "luggage"],
    ["i.checkin", 1, "check"],
    ["i.seatP", 1, "seat"],
    ["i.meal", 1, "meal"],
    ["i.miles8", 1, "star"],
    ["i.change", 1, "refund"],
    ["i.refund", 1, "refund"],
  ],
  elite: [
    ["i.personal", 1, "bag"],
    ["i.carry", 1, "luggage"],
    ["i.bag2", 1, "luggage"],
    ["i.seatB", 1, "seat"],
    ["i.menuB", 1, "meal"],
    ["i.miles10", 1, "star"],
    ["i.priority", 1, "crown"],
    ["i.lounge", 1, "crown"],
    ["i.change", 1, "refund"],
    ["i.refund", 1, "refund"],
  ],
  royal: [
    ["i.personal", 1, "bag"],
    ["i.carry", 1, "luggage"],
    ["i.bag3", 1, "luggage"],
    ["i.seatB", 1, "seat"],
    ["i.fast", 1, "seat"],
    ["i.menuB", 1, "meal"],
    ["i.miles12", 1, "star"],
    ["i.priority", 1, "crown"],
    ["i.lounge", 1, "crown"],
    ["i.freeChg", 1, "refund"],
  ],
};
