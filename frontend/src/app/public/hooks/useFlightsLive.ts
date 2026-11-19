import { TOPIC, type FlightEvent, type PublicFlight } from "@lifex/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getWsClient } from "@/ws/shared-client.ts";
import type { WsClient } from "@/ws/client.ts";

type FlightsData = { flights: PublicFlight[] };

/**
 * Mantiene al día las pantallas de resultados: los cambios de estado de un vuelo (cancelado, retrasado,
 * agotado) llegan por el tema `flights:search` y se aplican a las consultas de `/flights` sin recargar.
 */
export function useFlightsLive(client: WsClient = getWsClient()): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    const onEvent = (event: FlightEvent) => {
      if (event.type !== "FlightStatusChanged") return;
      const { status } = event.data;
      queryClient.setQueriesData<FlightsData>({ queryKey: ["flights"] }, (old) =>
        old
          ? {
              flights: old.flights.map((f) =>
                f.id === event.flightId ? { ...f, status, soldOut: status === "SOLD_OUT" } : f,
              ),
            }
          : old,
      );
      queryClient.setQueryData<{ flight: PublicFlight }>(["flight", event.flightId], (old) =>
        old ? { flight: { ...old.flight, status, soldOut: status === "SOLD_OUT" } } : old,
      );
    };
    return client.subscribe(TOPIC.flightsSearch, {
      onEvent,
      onResync: () => void queryClient.invalidateQueries({ queryKey: ["flights"] }),
    });
  }, [client, queryClient]);
}
