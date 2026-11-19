import { TOPIC } from "@lifex/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { WsClient } from "@/ws/client.ts";

/**
 * Mantiene el dashboard al día por WebSocket: el vuelo seleccionado (`dashboard:{id}`, exige el permiso
 * `dashboard:read`) y los cambios de estado de cualquier vuelo (`flights:search`). Ante cualquier evento se
 * vuelve a leer lo afectado, así los conteos son siempre los reales de la base de datos.
 */
export function useDashboardLive(
  selectedId: string | null,
  token: string,
  createClient: (token: string) => WsClient,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const client = createClient(token);
    const refreshList = () =>
      void queryClient.invalidateQueries({ queryKey: ["dashboardFlights"] });
    const stops = [
      client.subscribe(TOPIC.flightsSearch, { onEvent: refreshList, onResync: refreshList }),
    ];
    if (selectedId) {
      const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: ["dashboardFlight", selectedId] });
        refreshList();
      };
      stops.push(
        client.subscribe(TOPIC.dashboard(selectedId), { onEvent: refresh, onResync: refresh }),
      );
    }
    return () => {
      for (const stop of stops) stop();
      client.close();
    };
  }, [selectedId, token, createClient, queryClient]);
}
