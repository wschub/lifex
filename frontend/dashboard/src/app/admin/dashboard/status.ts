import type { FlightStatus } from "@lifex/shared";

export const STATUS_LABEL: Record<FlightStatus, string> = {
  ACTIVE: "Activo",
  DELAYED: "Retrasado",
  CANCELLED: "Cancelado",
  SOLD_OUT: "Agotado",
  FINALIZED: "Finalizado",
};

/** Estados que el administrador puede fijar a mano (SOLD_OUT y FINALIZED los decide el sistema). */
export const MANUAL_STATUSES: readonly FlightStatus[] = ["ACTIVE", "DELAYED", "CANCELLED"];

/** Cambios que envían un correo a todos los pasajeros con compra confirmada. */
export const NOTIFIES_PASSENGERS: readonly FlightStatus[] = ["DELAYED", "CANCELLED"];

export const statusLabel = (status: string): string =>
  STATUS_LABEL[status as FlightStatus] ?? status;

const percent = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
export const formatPercent = (value: number): string => `${percent.format(value)} %`;
