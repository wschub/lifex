import type { City, Country, LuggageType } from "../../domain/entities/catalog.entities.ts";
import type { CatalogRepository } from "../../domain/repositories/catalog.repository.ts";

export class ListCountries {
  private readonly catalog: CatalogRepository;
  constructor(deps: { catalog: CatalogRepository }) {
    this.catalog = deps.catalog;
  }
  execute(): Promise<Country[]> {
    return this.catalog.listCountries();
  }
}

export class ListCities {
  private readonly catalog: CatalogRepository;
  constructor(deps: { catalog: CatalogRepository }) {
    this.catalog = deps.catalog;
  }
  execute(filter: { countryIsoCode?: string } = {}): Promise<City[]> {
    return this.catalog.listCities(filter);
  }
}

export class ListLuggageTypes {
  private readonly catalog: CatalogRepository;
  constructor(deps: { catalog: CatalogRepository }) {
    this.catalog = deps.catalog;
  }
  execute(): Promise<LuggageType[]> {
    return this.catalog.listLuggageTypes();
  }
}

/** Valores de configuración que el navegador necesita para calcular precios y límites. */
export interface PublicConfig {
  /** Pesos colombianos por dólar (IATA_TRM). */
  iataTrm: number;
  taxPercentage: number;
  maxSeatLockMinutes: number;
  /** Minutos de inactividad en la web antes del modal de sesión (WEB_IDLE_TIMEOUT_MINUTES). */
  idleTimeoutMinutes: number;
  maxHeldSeatsPerSession: number;
}

export class GetPublicConfig {
  private readonly config: PublicConfig;
  constructor(deps: { config: PublicConfig }) {
    this.config = deps.config;
  }
  execute(): PublicConfig {
    return { ...this.config };
  }
}
