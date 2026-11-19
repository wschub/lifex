import { AppError } from "../../../../shared/errors/app-error.ts";
import { type FlightStatus } from "../../domain/entities/scheduled-flight.entity.ts";
import type { ScheduledFlightRepository } from "../../domain/repositories/scheduled-flight.repository.ts";

export class ChangeFlightStatus {
  private readonly flights: ScheduledFlightRepository;

  constructor(deps: { flights: ScheduledFlightRepository }) {
    this.flights = deps.flights;
  }

  /** El evento FlightStatusChanged lo escribe el repositorio en la misma transacción del cambio. */
  async execute(
    flightId: string,
    status: FlightStatus,
  ): Promise<{
    id: string;
    status: FlightStatus;
    previous: FlightStatus;
    /** Reservas confirmadas a las que se les encoló el aviso (0 si el vuelo no tiene compras). */
    notifiedOrders: number;
  }> {
    const flight = await this.flights.findById(flightId);
    if (!flight) throw new AppError("not_found", { code: "FLIGHT_NOT_FOUND" });
    flight.assertCanChangeStatusTo(status);
    const { previous, notifiedOrders } = await this.flights.updateStatus(flightId, status);
    return { id: flightId, status, previous, notifiedOrders };
  }
}
