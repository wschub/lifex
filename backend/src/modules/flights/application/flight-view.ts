import type { AirportInfo, FlightListing } from "../domain/entities/scheduled-flight.entity.ts";

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
  numAvailableSeats: number;
  availableByClass: FlightListing["availableByClass"];
  /** Un vuelo sin asientos se marca como agotado, no se oculta. */
  soldOut: boolean;
}

export function toPublicFlight(flight: FlightListing): PublicFlight {
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
    numAvailableSeats: flight.numAvailableSeats,
    availableByClass: flight.availableByClass,
    soldOut: flight.status === "SOLD_OUT" || flight.numAvailableSeats <= 0,
  };
}
