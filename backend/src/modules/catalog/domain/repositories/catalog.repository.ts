import type { City, Country, LuggageType } from "../entities/catalog.entities.ts";

/** Solo lectura: el catálogo se llena con el seed. */
export interface CatalogRepository {
  listCountries(): Promise<Country[]>;
  listCities(filter?: { countryIsoCode?: string }): Promise<City[]>;
  listLuggageTypes(): Promise<LuggageType[]>;
}
