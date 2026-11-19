import type { AirportInfo, FlightListing } from "../domain/entities/scheduled-flight.entity.ts";
import { type PricingConfig, priceForClass } from "../domain/services/dynamic-price.ts";

/** Reloj y reglas de precio con las que se calcula el precio vigente al mostrar un vuelo. */
export interface PricingContext {
  now: Date;
  config: PricingConfig;
}

export interface PublicFlight {
  id: string;
  routeType: FlightListing["routeType"];
  from: AirportInfo;
  to: AirportInfo;
  departureDate: string;
  arrivalDate: string;
  status: FlightListing["status"];
  /** Precios siempre en USD; el front convierte a COP con IATA_TRM. */
  basePriceUsd: number;
  averagePriceEconomyUsd: number;
  averagePriceBusinessUsd: number;
  /** Precio vigente por clase en USD, calculado al consultar (precio dinámico u oferta). */
  priceEconomyUsd: number;
  priceBusinessUsd: number;
  /** Presente si el vuelo es una oferta (el descuento reemplaza al precio dinámico). */
  offer: { discountPercentage: number } | null;
  numAvailableSeats: number;
  availableByClass: FlightListing["availableByClass"];
  /** Un vuelo sin asientos se marca como agotado, no se oculta. */
  soldOut: boolean;
}

export function toPublicFlight(flight: FlightListing, pricing: PricingContext): PublicFlight {
  const economy = priceForClass(flight, "ECONOMY", pricing.now, pricing.config);
  const business = priceForClass(flight, "BUSINESS", pricing.now, pricing.config);
  return {
    id: flight.id,
    routeType: flight.routeType,
    from: flight.from,
    to: flight.to,
    departureDate: flight.departureDate.toISOString(),
    arrivalDate: flight.arrivalDate.toISOString(),
    status: flight.status,
    basePriceUsd: flight.basePriceDefault,
    averagePriceEconomyUsd: flight.averagePriceEconomy,
    averagePriceBusinessUsd: flight.averagePriceBusiness,
    priceEconomyUsd: economy.priceUsd,
    priceBusinessUsd: business.priceUsd,
    offer:
      economy.discountPercentage === null
        ? null
        : { discountPercentage: economy.discountPercentage },
    numAvailableSeats: flight.numAvailableSeats,
    availableByClass: flight.availableByClass,
    soldOut: flight.status === "SOLD_OUT" || flight.numAvailableSeats <= 0,
  };
}
