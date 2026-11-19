import { AppError } from "../../../../shared/errors/app-error.ts";
import type { ScheduledFlightRepository } from "../../domain/repositories/scheduled-flight.repository.ts";
import type { PricingConfig } from "../../domain/services/dynamic-price.ts";
import { type PublicFlight, toPublicFlight } from "../flight-view.ts";

export class GetFlight {
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

  async execute(id: string): Promise<PublicFlight> {
    const listing = await this.flights.findListing(id);
    if (!listing) throw new AppError("not_found", { code: "FLIGHT_NOT_FOUND" });
    return toPublicFlight(listing, { now: this.now(), config: this.pricing });
  }
}
