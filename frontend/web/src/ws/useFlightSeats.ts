import { TOPIC, type FlightEvent, type SeatMap } from "@lifex/shared";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useEffect } from "react";
import { seatMapQuery } from "@/api/queries.ts";
import { keys } from "@/api/keys.ts";
import type { WsClient } from "./client.ts";
import { applySeatEvent } from "./seat-map-reducer.ts";
import { getWsClient } from "./shared-client.ts";

/**
 * Mapa de asientos de un vuelo: snapshot REST + eventos del tema `flight:{id}`. Si se detecta un hueco
 * en `version` o el socket se (re)conecta, vuelve a pedir el snapshot.
 */
export function useFlightSeats(
  flightId: string,
  client: WsClient = getWsClient(),
): UseQueryResult<SeatMap> {
  const queryClient = useQueryClient();
  const query = useQuery(seatMapQuery(flightId));

  useEffect(() => {
    const key = keys.seatMap(flightId);
    const refetch = () => void queryClient.invalidateQueries({ queryKey: key });
    const onEvent = (event: FlightEvent) => {
      let gap = false;
      queryClient.setQueryData<SeatMap>(key, (current) => {
        if (!current) return current; // el snapshot aún no llegó: él ya traerá este estado
        const result = applySeatEvent(current, event);
        gap = result.gap;
        return result.map;
      });
      if (gap) refetch();
    };
    return client.subscribe(TOPIC.flight(flightId), { onEvent, onResync: refetch });
  }, [flightId, client, queryClient]);

  return query;
}
