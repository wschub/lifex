import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { citiesQuery } from "@/api/queries.ts";
import type { Lang } from "@/i18n/dictionary.ts";

export interface AirportEntry {
  iata: string;
  name: string;
  nameEs: string;
  countryIsoCode: string;
  imageUrl: string | null;
}

/** Un registro por aeropuerto, con el nombre de su ciudad en ambos idiomas. */
export function useCities() {
  const query = useQuery(citiesQuery());
  const entries = useMemo<AirportEntry[]>(
    () =>
      (query.data?.cities ?? []).flatMap((city) =>
        city.airports.map((a) => ({
          iata: a.iataCode,
          name: city.name,
          nameEs: city.nameEs,
          countryIsoCode: city.countryIsoCode,
          imageUrl: city.imageUrl,
        })),
      ),
    [query.data],
  );
  const byIata = useMemo(() => new Map(entries.map((e) => [e.iata, e])), [entries]);
  const cityName = (iata: string, lang: Lang): string => {
    const e = byIata.get(iata);
    return e ? (lang === "es" ? e.nameEs : e.name) : iata;
  };
  return { ...query, entries, byIata, cityName };
}
