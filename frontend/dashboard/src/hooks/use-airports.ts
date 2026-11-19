import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { citiesQuery } from "@/api/queries.ts";
import type { AirportEntry } from "@/lib/airport-search.ts";

/** Todos los aeropuertos del catálogo (nacionales e internacionales), uno por código IATA. */
export function useAirports(): AirportEntry[] {
  const { data } = useQuery(citiesQuery());
  return useMemo(
    () =>
      (data?.cities ?? []).flatMap((city) =>
        city.airports.map((airport) => ({
          iata: airport.iataCode,
          name: city.name,
          nameEs: city.nameEs,
          countryIsoCode: city.countryIsoCode,
        })),
      ),
    [data],
  );
}
