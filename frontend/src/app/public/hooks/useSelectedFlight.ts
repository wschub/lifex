import { useQuery } from "@tanstack/react-query";
import { flightQuery, luggageTypesQuery } from "@/api/queries.ts";
import { useWizard } from "@/stores/booking-wizard.ts";
import { fareOptions, type FareOption } from "../fares.ts";

/** El vuelo elegido (consulta por id), las tarifas del catálogo y la tarifa elegida, si ya hay. */
export function useSelectedFlight() {
  const { flightId, fareId } = useWizard();
  const flight = useQuery({ ...flightQuery(flightId ?? ""), enabled: !!flightId });
  const types = useQuery(luggageTypesQuery());
  const fares: FareOption[] = fareOptions(types.data?.luggageTypes ?? []);
  const fare = fares.find((f) => f.id === fareId) ?? null;
  return {
    flight: flight.data?.flight ?? null,
    fares,
    fare,
    loading: flight.isPending || types.isPending,
    error: flight.error ?? types.error,
    refetch: () => {
      void flight.refetch();
      void types.refetch();
    },
  };
}
