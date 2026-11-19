const BOGOTA = "America/Bogota";

/** Fecha de hoy en Colombia (AAAA-MM-DD), con independencia de la zona del navegador. */
export function todayBogota(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Suma `days` días a una fecha AAAA-MM-DD (calendario, sin horas). */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Fecha de salida por defecto del buscador: mañana. */
export function defaultSearchDate(now: Date = new Date()): string {
  return addDays(todayBogota(now), 1);
}
