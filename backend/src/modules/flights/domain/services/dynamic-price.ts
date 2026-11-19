/**
 * Precio dinámico de un vuelo por clase (USD) y elegibilidad para oferta. Dominio puro.
 *
 * Reglas (ver HU5 en docs/user-stories-acceptance-criteria.md):
 *  - Primer ticket de una clase (promedio en 0): precio base de la clase +20 %.
 *  - Con promedio > 0: promedio de la clase +5 %.
 *  - Recargo por horas: 0,5 % de la referencia por cada hora completa transcurrida dentro de las últimas
 *    72 h, congelado a 2 h (nacional) o 5 h (internacional) de la salida.
 *  - Una oferta ignora todo lo anterior: precio base de la clase menos el descuento fijo.
 */

export type PricedSeatClass = "ECONOMY" | "BUSINESS";
export type PricedRouteType = "DOMESTIC" | "INTERNATIONAL";

export const FIRST_TICKET_MARKUP = 0.2;
export const AVERAGE_MARKUP = 0.05;
export const HOURLY_MARKUP = 0.005;
export const SURCHARGE_WINDOW_HOURS = 72;
export const SURCHARGE_CUTOFF_HOURS: Record<PricedRouteType, number> = {
  DOMESTIC: 2,
  INTERNATIONAL: 5,
};

export const OFFER_MIN_DAYS_AHEAD = 8;
export const OFFER_MAX_DAYS_AHEAD = 30;
export const OFFER_MAX_OCCUPANCY_PERCENT = 60;
export const OFFER_MIN_AVAILABLE_SEATS = 100;
export const OFFER_AVERAGE_TOLERANCE = 0.3;

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export interface PricingConfig {
  /** Business parte de basePriceDefault × este multiplicador. */
  businessBaseMultiplier: number;
  /** Descuento fijo (0-100) de una oferta. */
  offerDiscountPercentage: number;
}

/** Lo mínimo de un vuelo que hace falta para calcular su precio. */
export interface FlightPricingInput {
  routeType: PricedRouteType;
  status: string;
  departureDate: Date;
  basePriceDefault: number;
  averagePriceEconomy: number;
  averagePriceBusiness: number;
  /** 0-100. */
  occupancyRate: number;
  numAvailableSeats: number;
}

export interface ClassPrice {
  priceUsd: number;
  /** null si no es oferta. */
  discountPercentage: number | null;
}

const roundCents = (value: number): number => Math.round(value * 100) / 100;

function classBase(flight: FlightPricingInput, seatClass: PricedSeatClass, config: PricingConfig) {
  return seatClass === "BUSINESS"
    ? flight.basePriceDefault * config.businessBaseMultiplier
    : flight.basePriceDefault;
}

function classAverage(flight: FlightPricingInput, seatClass: PricedSeatClass): number {
  return seatClass === "BUSINESS" ? flight.averagePriceBusiness : flight.averagePriceEconomy;
}

/** Horas completas de recargo acumuladas a `now` (0 a 72 − corte). */
function surchargeHours(flight: FlightPricingInput, now: Date): number {
  const cutoff = SURCHARGE_CUTOFF_HOURS[flight.routeType];
  const hoursLeft = (flight.departureDate.getTime() - now.getTime()) / HOUR_MS;
  const elapsed = SURCHARGE_WINDOW_HOURS - Math.max(hoursLeft, cutoff);
  const capped = Math.min(Math.max(elapsed, 0), SURCHARGE_WINDOW_HOURS - cutoff);
  return Math.floor(capped);
}

/**
 * Una oferta es un vuelo ACTIVE que sale entre 8 y 30 días desde `now` y cumple cualquiera de:
 * ocupación <= 60 %, >= 100 asientos libres, o promedios sin pasar 30 % sobre su base.
 */
export function isOfferEligible(
  flight: FlightPricingInput,
  now: Date,
  config: PricingConfig,
): boolean {
  if (flight.status !== "ACTIVE") return false;
  const ahead = flight.departureDate.getTime() - now.getTime();
  if (ahead < OFFER_MIN_DAYS_AHEAD * DAY_MS || ahead > OFFER_MAX_DAYS_AHEAD * DAY_MS) return false;

  const lowOccupancy = flight.occupancyRate <= OFFER_MAX_OCCUPANCY_PERCENT;
  const manySeats = flight.numAvailableSeats >= OFFER_MIN_AVAILABLE_SEATS;
  const limit = 1 + OFFER_AVERAGE_TOLERANCE;
  const averagesNearBase =
    flight.averagePriceEconomy <= roundCents(flight.basePriceDefault * limit) &&
    flight.averagePriceBusiness <=
      roundCents(flight.basePriceDefault * config.businessBaseMultiplier * limit);
  return lowOccupancy || manySeats || averagesNearBase;
}

/** Precio vigente de una clase a `now`. Oferta y precio dinámico son excluyentes. */
export function priceForClass(
  flight: FlightPricingInput,
  seatClass: PricedSeatClass,
  now: Date,
  config: PricingConfig,
): ClassPrice {
  const base = classBase(flight, seatClass, config);

  if (isOfferEligible(flight, now, config)) {
    const discount = config.offerDiscountPercentage;
    return { priceUsd: roundCents(base * (1 - discount / 100)), discountPercentage: discount };
  }

  const average = classAverage(flight, seatClass);
  const reference = average > 0 ? average : base * (1 + FIRST_TICKET_MARKUP);
  const start = average > 0 ? average * (1 + AVERAGE_MARKUP) : reference;
  const surcharge = reference * HOURLY_MARKUP * surchargeHours(flight, now);
  return { priceUsd: roundCents(start + surcharge), discountPercentage: null };
}
