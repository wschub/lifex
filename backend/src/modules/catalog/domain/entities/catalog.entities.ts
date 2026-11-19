import type { Locale } from "../../../../shared/i18n/locale.ts";

/** Nombre mostrado al usuario: inglés en `name`, español en `nameEs`. */
export interface LocalizedName {
  name: string;
  nameEs: string;
}

export interface Country extends LocalizedName {
  id: number;
  isoCode: string;
}

export interface Airport {
  id: number;
  iataCode: string;
}

export interface City extends LocalizedName {
  id: number;
  countryIsoCode: string;
  /** Ruta relativa a la foto de la ciudad, si existe. */
  imageUrl: string | null;
  airports: Airport[];
}

export interface LuggageType extends LocalizedName {
  id: number;
  rank: number;
  feePercentage: number;
  businessOnly: boolean;
}

/** Elige el nombre según el idioma de la petición. */
export function localizedName(item: LocalizedName, locale: Locale): string {
  return locale === "es" ? item.nameEs : item.name;
}
