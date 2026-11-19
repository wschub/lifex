import { AppError } from "../../../../shared/errors/app-error.ts";
import type { ScheduledFlightRepository } from "../../domain/repositories/scheduled-flight.repository.ts";
import { type PricingContext, type PublicFlight, toPublicFlight } from "../flight-view.ts";
import type { PricingConfig } from "../../domain/services/dynamic-price.ts";

export interface SearchFlightsInput {
  from: string;
  to: string;
  /** AAAA-MM-DD, interpretado en la hora de Colombia (UTC−5). */
  date: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const IATA = /^[A-Za-z]{3}$/;
const COLOMBIA_OFFSET = "-05:00";
const DAY_MS = 24 * 60 * 60 * 1000;

export class SearchFlights {
  private readonly flights: ScheduledFlightRepository;
  private readonly pricing: PricingConfig;
  private readonly now: () => Date;

  constructor(deps: {
    flights: ScheduledFlightRepository;
    pricing: PricingConfig;
    now?: () => Date;
  }) {
    this.flights = deps.flights;
    this.pricing = deps.pricing;
    this.now = deps.now ?? (() => new Date());
  }

  async execute(input: SearchFlightsInput): Promise<PublicFlight[]> {
    if (!IATA.test(input.from) || !IATA.test(input.to)) {
      throw new AppError("validation", {
        details: {
          issues: [{ field: IATA.test(input.from) ? "to" : "from", code: "invalid_format" }],
        },
      });
    }
    const dayStart = new Date(`${input.date}T00:00:00${COLOMBIA_OFFSET}`);
    if (!DATE.test(input.date) || Number.isNaN(dayStart.getTime())) {
      throw new AppError("validation", { code: "INVALID_SEARCH_DATE" });
    }
    const listings = await this.flights.search({
      fromIata: input.from.toUpperCase(),
      toIata: input.to.toUpperCase(),
      dayStart,
      dayEnd: new Date(dayStart.getTime() + DAY_MS),
    });
    const context: PricingContext = { now: this.now(), config: this.pricing };
    return listings.map((listing) => toPublicFlight(listing, context));
  }
}
