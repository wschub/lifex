import { useQuery } from "@tanstack/react-query";
import { flightsQuery, luggageTypesQuery } from "@/api/queries.ts";
import { fareOptions, lowestPriceUsd } from "../fares.ts";
import { usePublicConfig } from "./usePublicConfig.ts";

/** Precio "desde" (tarifa Light, impuestos incluidos) de una ruta y fecha; `null` si no hay vuelos. */
export function useLowestPrice(
  from: string,
  to: string,
  date: string,
  enabled = true,
): { priceUsd: number | null; loading: boolean } {
  const config = usePublicConfig();
  const flights = useQuery({ ...flightsQuery({ from, to, date }), enabled: enabled && !!to });
  const types = useQuery(luggageTypesQuery());
  if (!enabled || !to) return { priceUsd: null, loading: false };
  if (!flights.data || !types.data) return { priceUsd: null, loading: !flights.isError };
  return {
    priceUsd: lowestPriceUsd(
      fareOptions(types.data.luggageTypes),
      flights.data.flights,
      config.taxPercentage,
    ),
    loading: false,
  };
}
