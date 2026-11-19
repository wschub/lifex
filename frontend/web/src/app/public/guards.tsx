import type { ReactNode } from "react";
import { Navigate } from "react-router";
import type { WizardState } from "@/stores/booking-wizard.ts";
import { useWizard } from "@/stores/booking-wizard.ts";

export type WizardStep =
  "fares" | "summary" | "passengers" | "customize" | "seats" | "payment" | "confirmation";

type Snapshot = Pick<
  WizardState,
  | "flightId"
  | "fareId"
  | "passengers"
  | "holder"
  | "booking"
  | "seats"
  | "confirmedBookingId"
  | "search"
>;

/**
 * Ruta a la que hay que volver si falta algo para estar en un paso; `null` si se puede continuar.
 * Cada paso exige lo que producen los anteriores: así entrar directo a `/payment` nunca rompe la página.
 */
export function redirectFor(step: WizardStep, s: Snapshot): string | null {
  if (step === "confirmation") return s.confirmedBookingId ? null : "/";
  if (!s.flightId)
    return s.search.to
      ? `/results?from=${s.search.from}&to=${s.search.to}&date=${s.search.date}&pax=${s.search.pax}`
      : "/";
  if (step === "fares") return null;
  if (!s.fareId) return "/fares";
  if (step === "summary" || step === "passengers") return null;
  const peopleReady =
    s.holder?.ok &&
    s.passengers.length >= s.search.pax &&
    s.passengers.slice(0, s.search.pax).every((p) => p.ok);
  if (!peopleReady || !s.booking) return "/passengers";
  if (step === "customize" || step === "seats") return null;
  const seated = s.seats.length >= s.search.pax && s.seats.slice(0, s.search.pax).every(Boolean);
  // Sin asiento (por ejemplo, venció el bloqueo) se vuelve al mapa a elegirlo de nuevo.
  return seated ? null : "/seats";
}

/** Protege una página del asistente: redirige al paso que falta en lugar de renderizar a medias. */
export function RequireStep({ step, children }: { step: WizardStep; children: ReactNode }) {
  const snapshot = useWizard();
  const to = redirectFor(step, snapshot);
  return to ? <Navigate to={to} replace /> : <>{children}</>;
}
