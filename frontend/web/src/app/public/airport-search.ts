import type { Lang } from "@/i18n/dictionary.ts";
import type { AirportEntry } from "./hooks/useCities.ts";

/** Minúsculas, sin tildes y sin espacios en los extremos (para comparar lo que escribe el usuario). */
export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export const cityLabel = (entry: AirportEntry, lang: Lang): string =>
  lang === "es" ? entry.nameEs : entry.name;

/** Texto que muestra el campo cuando hay una opción elegida: "Medellín (MDE)". */
export const airportLabel = (entry: AirportEntry, lang: Lang): string =>
  `${cityLabel(entry, lang)} (${entry.iata})`;

const isDomestic = (entry: AirportEntry): boolean => entry.countryIsoCode === "CO";

/** Menor es mejor; `null` = no coincide. Mira el código y el nombre de la ciudad en los dos idiomas. */
function score(entry: AirportEntry, query: string): number | null {
  const code = entry.iata.toLowerCase();
  const names = [normalizeText(entry.nameEs), normalizeText(entry.name)];
  if (code === query) return 0;
  if (code.startsWith(query)) return 1;
  if (names.some((name) => name.startsWith(query))) return 2;
  if (names.some((name) => name.split(/\s+/).some((word) => word.startsWith(query)))) return 3;
  if (names.some((name) => name.includes(query))) return 4;
  return null;
}

/**
 * Opciones del autocompletar. Sin texto: todas, nacionales primero y luego internacionales, cada grupo por
 * nombre. Con texto: las que coinciden por código o por ciudad, las mejores primero.
 */
export function filterAirports(entries: AirportEntry[], text: string, lang: Lang): AirportEntry[] {
  const query = normalizeText(text);
  const byName = (a: AirportEntry, b: AirportEntry): number =>
    cityLabel(a, lang).localeCompare(cityLabel(b, lang), lang);

  if (query === "") {
    return [...entries].sort(
      (a, b) => Number(isDomestic(b)) - Number(isDomestic(a)) || byName(a, b),
    );
  }
  return entries
    .map((entry) => ({ entry, rank: score(entry, query) }))
    .filter((item): item is { entry: AirportEntry; rank: number } => item.rank !== null)
    .sort((a, b) => a.rank - b.rank || byName(a.entry, b.entry))
    .map((item) => item.entry);
}

export function groupAirports(entries: AirportEntry[]): {
  domestic: AirportEntry[];
  international: AirportEntry[];
} {
  return {
    domestic: entries.filter(isDomestic),
    international: entries.filter((entry) => !isDomestic(entry)),
  };
}
