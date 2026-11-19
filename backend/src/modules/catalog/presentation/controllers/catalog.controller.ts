import type { RequestHandler } from "express";
import { AppError } from "../../../../shared/errors/app-error.ts";
import type {
  GetPublicConfig,
  ListCities,
  ListCountries,
  ListLuggageTypes,
} from "../../application/use-cases/catalog.use-cases.ts";

export interface CatalogControllerDeps {
  listCountries: ListCountries;
  listCities: ListCities;
  listLuggageTypes: ListLuggageTypes;
  getPublicConfig: GetPublicConfig;
}

const ISO = /^[A-Za-z]{2}$/;

export function createCatalogController(deps: CatalogControllerDeps) {
  const countries: RequestHandler = async (_req, res) => {
    res.json({ countries: await deps.listCountries.execute() });
  };

  const cities: RequestHandler = async (req, res) => {
    const country = typeof req.query.country === "string" ? req.query.country : undefined;
    if (country !== undefined && !ISO.test(country)) {
      throw new AppError("validation", {
        details: { issues: [{ field: "country", code: "invalid_format" }] },
      });
    }
    const countryIsoCode = country?.toUpperCase();
    res.json({ cities: await deps.listCities.execute(countryIsoCode ? { countryIsoCode } : {}) });
  };

  const luggageTypes: RequestHandler = async (_req, res) => {
    res.json({ luggageTypes: await deps.listLuggageTypes.execute() });
  };

  const publicConfig: RequestHandler = (_req, res) => {
    res.json(deps.getPublicConfig.execute());
  };

  return { countries, cities, luggageTypes, publicConfig };
}
