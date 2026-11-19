import type { PrismaClient } from "../../../../generated/prisma/client.ts";
import type { City, Country, LuggageType } from "../../domain/entities/catalog.entities.ts";
import type { CatalogRepository } from "../../domain/repositories/catalog.repository.ts";

export class PrismaCatalogRepository implements CatalogRepository {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async listCountries(): Promise<Country[]> {
    const rows = await this.prisma.country.findMany({ orderBy: { name: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      isoCode: row.isoCode,
      name: row.name,
      nameEs: row.nameEs,
    }));
  }

  async listCities(filter: { countryIsoCode?: string } = {}): Promise<City[]> {
    const rows = await this.prisma.city.findMany({
      where: filter.countryIsoCode ? { country: { isoCode: filter.countryIsoCode } } : {},
      include: { country: true, airports: true },
      orderBy: { name: "asc" },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      nameEs: row.nameEs,
      countryIsoCode: row.country.isoCode,
      imageUrl: row.imageUrl,
      airports: row.airports.map((airport) => ({ id: airport.id, iataCode: airport.iataCode })),
    }));
  }

  async listLuggageTypes(): Promise<LuggageType[]> {
    const rows = await this.prisma.luggageType.findMany({ orderBy: { rank: "asc" } });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      nameEs: row.nameEs,
      rank: row.rank,
      feePercentage: Number(row.feePercentage),
      businessOnly: row.businessOnly,
    }));
  }
}
