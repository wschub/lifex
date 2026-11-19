import { AppError } from "../../../../shared/errors/app-error.ts";

export const FLIGHT_STATUSES = ["ACTIVE", "CANCELLED", "DELAYED", "SOLD_OUT", "FINALIZED"] as const;
export type FlightStatus = (typeof FLIGHT_STATUSES)[number];

/** Estados que aparecen en la búsqueda pública (nunca FINALIZED). */
export const SEARCHABLE_STATUSES: readonly FlightStatus[] = ["ACTIVE", "DELAYED", "SOLD_OUT"];

/** Estados en los que todavía se pueden bloquear asientos y comprar. */
export const BOOKABLE_STATUSES: readonly FlightStatus[] = ["ACTIVE", "DELAYED"];

/** Estados a los que un administrador puede mover un vuelo a mano. SOLD_OUT lo decide el sistema. */
const MANUAL_TARGETS: readonly FlightStatus[] = ["ACTIVE", "DELAYED", "CANCELLED", "FINALIZED"];
const FINAL_STATUSES: readonly FlightStatus[] = ["CANCELLED", "FINALIZED"];

export interface ScheduledFlightProps {
  id: string;
  departureDate: Date;
  arrivalDate: Date;
  status: FlightStatus;
}

export class ScheduledFlight {
  readonly id: string;
  readonly departureDate: Date;
  readonly arrivalDate: Date;
  readonly status: FlightStatus;

  private constructor(props: ScheduledFlightProps) {
    this.id = props.id;
    this.departureDate = props.departureDate;
    this.arrivalDate = props.arrivalDate;
    this.status = props.status;
    Object.freeze(this);
  }

  /** Valida que la llegada sea posterior a la salida. */
  static create(props: ScheduledFlightProps): ScheduledFlight {
    if (!(props.departureDate.getTime() < props.arrivalDate.getTime())) {
      throw new AppError("validation", { code: "INVALID_FLIGHT_DATES" });
    }
    return new ScheduledFlight(props);
  }

  static restore(props: ScheduledFlightProps): ScheduledFlight {
    return new ScheduledFlight(props);
  }

  /** Un cambio manual de estado: lanza si el destino no es válido o el vuelo ya terminó. */
  assertCanChangeStatusTo(target: FlightStatus): void {
    const allowed =
      MANUAL_TARGETS.includes(target) &&
      !FINAL_STATUSES.includes(this.status) &&
      target !== this.status;
    if (!allowed) throw new AppError("conflict", { code: "INVALID_FLIGHT_STATUS" });
  }

  isBookable(): boolean {
    return BOOKABLE_STATUSES.includes(this.status);
  }
}

export function isFlightStatus(value: string): value is FlightStatus {
  return (FLIGHT_STATUSES as readonly string[]).includes(value);
}

/** Lectura de un vuelo para la búsqueda y el detalle: incluye ruta, precios y disponibilidad. */
export interface FlightListing {
  id: string;
  flightRouteId: number;
  routeType: "DOMESTIC" | "INTERNATIONAL";
  from: AirportInfo;
  to: AirportInfo;
  departureDate: Date;
  arrivalDate: Date;
  status: FlightStatus;
  numMaxSeats: number;
  numAvailableSeats: number;
  /** 0-100. */
  occupancyRate: number;
  basePriceDefault: number;
  averagePriceEconomy: number;
  averagePriceBusiness: number;
  availableByClass: { economy: number; business: number };
}

export interface AirportInfo {
  iataCode: string;
  city: string;
  cityEs: string;
  cityImageName: string | null;
  country: string;
  countryEs: string;
}
