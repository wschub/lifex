import type { FlightListing } from "../../domain/entities/scheduled-flight.entity.ts";
import type { ScheduledFlightRepository } from "../../domain/repositories/scheduled-flight.repository.ts";
import {
  isOfferEligible,
  OFFER_MAX_DAYS_AHEAD,
  OFFER_MIN_DAYS_AHEAD,
  type PricingConfig,
} from "../../domain/services/dynamic-price.ts";
import { type PublicFlight, toPublicFlight } from "../flight-view.ts";

/** Máximo de ofertas por tipo de ruta (nacional / internacional). */
export const OFFERS_PER_ROUTE_TYPE = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fisher–Yates con la aleatoriedad inyectada (las pruebas la fijan). */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Ofertas de la portada: vuelos elegibles (ventana de 8 a 30 días y criterios de `isOfferEligible`),
 * al azar, sin repetir ruta, hasta 5 nacionales y 5 internacionales.
 */
export class ListOfferFlights {
  private readonly flights: ScheduledFlightRepository;
  private readonly pricing: PricingConfig;
  private readonly now: () => Date;
  private readonly random: () => number;

  constructor(deps: {
    flights: ScheduledFlightRepository;
    pricing: PricingConfig;
    now?: () => Date;
    random?: () => number;
  }) {
    this.flights = deps.flights;
    this.pricing = deps.pricing;
    this.now = deps.now ?? (() => new Date());
    this.random = deps.random ?? Math.random;
  }

  async execute(): Promise<PublicFlight[]> {
    const now = this.now();
    const candidates = await this.flights.findOfferCandidates(
      new Date(now.getTime() + OFFER_MIN_DAYS_AHEAD * DAY_MS),
      new Date(now.getTime() + OFFER_MAX_DAYS_AHEAD * DAY_MS),
    );
    const eligible = candidates.filter((flight) => isOfferEligible(flight, now, this.pricing));

    const picked: FlightListing[] = [];
    const usedRoutes = new Set<number>();
    const perType = { DOMESTIC: 0, INTERNATIONAL: 0 };
    for (const flight of shuffled(eligible, this.random)) {
      if (usedRoutes.has(flight.flightRouteId)) continue;
      if (perType[flight.routeType] >= OFFERS_PER_ROUTE_TYPE) continue;
      usedRoutes.add(flight.flightRouteId);
      perType[flight.routeType] += 1;
      picked.push(flight);
    }
    return picked.map((flight) => toPublicFlight(flight, { now, config: this.pricing }));
  }
}
