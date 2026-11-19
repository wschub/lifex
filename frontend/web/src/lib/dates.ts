import type { Lang } from "@/i18n/dictionary.ts";

/** Todas las fechas de Lifex se muestran en hora de Colombia, sin importar dónde esté el navegador. */
export const DISPLAY_TIME_ZONE = "America/Bogota";

const localeOf = (lang: Lang) => (lang === "en" ? "en-US" : "es-CO");

/**
 * Fecha corta ("24 nov 2026" / "Nov 24, 2026"). Con `opts` propias usa Intl tal cual.
 * El formato crudo de `es-CO` ("24 de nov de 2026") no es el del diseño, por eso se arma con `formatToParts`.
 */
export function formatDate(iso: string, lang: Lang, opts?: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso);
  if (opts) {
    return new Intl.DateTimeFormat(localeOf(lang), { timeZone: DISPLAY_TIME_ZONE, ...opts }).format(
      date,
    );
  }
  const base: Intl.DateTimeFormatOptions = {
    timeZone: DISPLAY_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  if (lang === "en") return new Intl.DateTimeFormat("en-US", base).format(date);
  const parts = new Intl.DateTimeFormat("es-CO", base).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${pick("day")} ${pick("month").replace(/\.$/, "")} ${pick("year")}`;
}

/** Hora local de Colombia en 24 horas: "07:30". */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}
