import { AppError } from "../../../../shared/errors/app-error.ts";
import type { ScheduledFlightRepository } from "../../domain/repositories/scheduled-flight.repository.ts";
import { type PublicFlight, toPublicFlight } from "../flight-view.ts";

export class GetFlight {
  private readonly flights: ScheduledFlightRepository;

  constructor(deps: { flights: ScheduledFlightRepository }) {
    this.flights = deps.flights;
  }

  async execute(id: string): Promise<PublicFlight> {
    const listing = await this.flights.findListing(id);
    if (!listing) throw new AppError("not_found", { code: "FLIGHT_NOT_FOUND" });
    return toPublicFlight(listing);
  }
}
